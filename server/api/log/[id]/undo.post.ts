import { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import type { DynamicInventoryItem } from '~/types/schema'
import type { LogChange } from '~/types/log'
import { managerRoute } from '~/server/utils/apiMiddleware'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'

/**
 * Response structure for the undo operation
 */
interface UndoResponse {
  success: boolean
  message: string
  item?: DynamicInventoryItem
}

export default managerRoute(async (event, { auth, businessId }): Promise<UndoResponse> => {
  // Validate log ID parameter
  const id = requireIdParam(event, 'id', 'Log ID is required')

  // Fetch the log entry
  const log = await prisma.inventoryLog.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!log) {
    throw createError({
      statusCode: 404,
      message: 'Log entry not found',
    })
  }

  // Verify the log belongs to the user's business
  if (log.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to undo this action',
    })
  }

  // Check if action is undoable
  if (!log.undoable) {
    throw createError({
      statusCode: 400,
      message: 'This action cannot be undone',
    })
  }

  // Check if already undone
  if (log.undoneAt) {
    throw createError({
      statusCode: 400,
      message: 'This action has already been undone',
    })
  }

  // Get schema for item name lookup and validation
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId },
  })
  const columns = parseColumnDefinitions(schema?.columns)

  // --- EXECUTE UNDO OPERATION BASED ON ACTION TYPE ---

  switch (log.action) {
    case 'ITEM_DELETED': {
      // Restore item from snapshot
      if (!log.snapshot || typeof log.snapshot !== 'object') {
        throw createError({
          statusCode: 400,
          message: 'Cannot undo: no snapshot available',
        })
      }

      const snapshot = log.snapshot as { data: Record<string, unknown>; createdById: string }

      // Validate snapshot data against current schema before restoration
      if (columns.length > 0) {
        const validationResult = validateInventoryData(snapshot.data, columns, false)
        if (!validationResult.success) {
          throw createError({
            statusCode: 400,
            message: `Cannot restore item: schema has changed. Validation errors: ${validationResult.errors?.join(', ')}`,
          })
        }
      }

      // Use transaction to ensure atomicity of restore + log marking
      const result = await prisma.$transaction(async (tx) => {
        // Create the restored item
        const restoredItem = await tx.inventoryItem.create({
          data: {
            data: snapshot.data as unknown as Prisma.InputJsonValue,
            businessId,
            createdById: snapshot.createdById,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        // Mark the original log entry as undone
        const updatedLog = await tx.inventoryLog.update({
          where: { id },
          data: {
            undoneAt: new Date(),
            undoneById: auth.userId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            undoneBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return { restoredItem, updatedLog }
      })

      // Emit socket events for real-time updates
      emitInventoryCreated(businessId, result.restoredItem)
      emitLogUndone(businessId, result.updatedLog)

      // Map the Prisma result to our typed response
      const typedItem: DynamicInventoryItem = {
        id: result.restoredItem.id,
        data: result.restoredItem.data as Record<string, unknown>,
        businessId: result.restoredItem.businessId,
        createdById: result.restoredItem.createdById,
        createdAt: result.restoredItem.createdAt.toISOString(),
        updatedAt: result.restoredItem.updatedAt.toISOString(),
        createdBy: result.restoredItem.createdBy,
      }

      return {
        success: true,
        message: 'Item restored successfully',
        item: typedItem,
      }
    }

    case 'ITEM_UPDATED': {
      // Revert to previous values
      if (!log.changes || !log.itemId) {
        throw createError({
          statusCode: 400,
          message: 'Cannot undo: no changes or item ID available',
        })
      }

      // Check if item still exists
      const existingItem = await prisma.inventoryItem.findUnique({
        where: { id: log.itemId },
      })

      if (!existingItem) {
        throw createError({
          statusCode: 400,
          message: 'Cannot undo: item no longer exists',
        })
      }

      // Verify item belongs to same business
      if (existingItem.businessId !== businessId) {
        throw createError({
          statusCode: 403,
          message: 'You do not have permission to modify this item',
        })
      }

      const currentData = existingItem.data as Record<string, unknown>
      const changes = log.changes as unknown as LogChange[]

      // Build the reverted data
      const revertedData = { ...currentData }
      for (const change of changes) {
        revertedData[change.field] = change.oldValue
      }

      // Use transaction to ensure atomicity of update + log marking
      const result = await prisma.$transaction(async (tx) => {
        // Update the item with reverted data
        const updatedItem = await tx.inventoryItem.update({
          where: { id: log.itemId! },
          data: { data: revertedData as unknown as Prisma.InputJsonValue },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        // Mark the original log entry as undone
        const updatedLog = await tx.inventoryLog.update({
          where: { id },
          data: {
            undoneAt: new Date(),
            undoneById: auth.userId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            undoneBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        return { updatedItem, updatedLog }
      })

      // Emit socket events for real-time updates
      emitInventoryUpdated(businessId, result.updatedItem)
      emitLogUndone(businessId, result.updatedLog)

      // Map the Prisma result to our typed response
      const typedItem: DynamicInventoryItem = {
        id: result.updatedItem.id,
        data: result.updatedItem.data as Record<string, unknown>,
        businessId: result.updatedItem.businessId,
        createdById: result.updatedItem.createdById,
        createdAt: result.updatedItem.createdAt.toISOString(),
        updatedAt: result.updatedItem.updatedAt.toISOString(),
        createdBy: result.updatedItem.createdBy,
      }

      return {
        success: true,
        message: 'Changes reverted successfully',
        item: typedItem,
      }
    }

    default:
      throw createError({
        statusCode: 400,
        message: 'This action type cannot be undone',
      })
  }
})
