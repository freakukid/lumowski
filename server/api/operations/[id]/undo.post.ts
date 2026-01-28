import type { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import { managerRoute } from '~/server/utils/apiMiddleware'
import { safeEmitOperationUndo } from '~/server/utils/socket'
import { requireIdParam, requireOperationOwnership, parseColumnDefinitions, parseOperationItems } from '~/server/utils/apiHelpers'

/**
 * POST /api/operations/:id/undo
 * Undoes an operation, reverting inventory quantities and costs.
 *
 * Supported operation types:
 * - RECEIVING: subtracts the received quantities from inventory
 * - SALE: adds the sold quantities back to inventory
 *
 * Only MANAGER role (OWNER or BOSS) can undo operations. This is a destructive action that:
 * 1. Reverses quantity changes from current inventory
 * 2. Recalculates weighted average costs if cost tracking was used (RECEIVING only)
 * 3. Marks the operation as undone with timestamp and user info
 *
 * Returns 409 Conflict if the operation is already undone.
 */
export default managerRoute(async (event, { auth, businessId }) => {
  const id = requireIdParam(event, 'id', 'Operation ID is required')

  // Fetch the operation
  const operation = await prisma.operation.findUnique({
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

  if (!operation) {
    throw createError({
      statusCode: 404,
      message: 'Operation not found',
    })
  }

  // Verify business membership
  requireOperationOwnership(operation, businessId, 'undo')

  // Check if already undone
  if (operation.undoneAt) {
    throw createError({
      statusCode: 409,
      message: 'This operation has already been undone',
    })
  }

  // Get business schema to find quantity and cost columns
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId },
  })

  if (!schema || !schema.columns) {
    throw createError({
      statusCode: 400,
      message: 'Inventory schema not found',
    })
  }

  const columns = parseColumnDefinitions(schema.columns)
  const quantityColumn = columns.find((c) => c.role === 'quantity')
  const costColumn = columns.find((c) => c.role === 'cost')

  if (!quantityColumn) {
    throw createError({
      statusCode: 400,
      message: 'No quantity column defined in schema',
    })
  }

  const operationItems = parseOperationItems(operation.items)

  // Fetch all affected items
  const itemIds = operationItems.map((i) => i.itemId)
  const existingItems = await prisma.inventoryItem.findMany({
    where: {
      id: { in: itemIds },
      businessId,
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

  // Create a map for quick lookup
  const itemMap = new Map(existingItems.map((item) => [item.id, item]))

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    const updatedItems: Array<typeof existingItems[0]> = []

    // Process each item - reverse the operation
    for (const opItem of operationItems) {
      const item = itemMap.get(opItem.itemId)

      // Skip if item no longer exists (was deleted)
      if (!item) continue

      const data = item.data as Record<string, unknown>

      // Get current quantity
      const currentQty = typeof data[quantityColumn.id] === 'number'
        ? data[quantityColumn.id] as number
        : 0

      // Calculate new quantity based on operation type
      // RECEIVING: subtract (reverse of adding)
      // SALE: add back (reverse of subtracting)
      let newQty: number
      if (operation.type === 'SALE') {
        // Add back the sold quantity
        newQty = currentQty + opItem.quantity
      } else {
        // Subtract the received quantity (RECEIVING)
        newQty = Math.max(0, currentQty - opItem.quantity)
      }

      // Update the item's data
      const newData: Record<string, unknown> = {
        ...data,
        [quantityColumn.id]: newQty,
      }

      // Handle cost recalculation if cost tracking was used (only for RECEIVING operations)
      // Sales don't affect the cost - they only subtract quantity
      if (operation.type === 'RECEIVING' && costColumn && opItem.costPerItem !== undefined && opItem.previousCost !== undefined) {
        // Get current values
        const currentCost = typeof data[costColumn.id] === 'number'
          ? data[costColumn.id] as number
          : 0

        // Reverse weighted average cost calculation
        // To reverse: we need to remove the contribution of the received items
        // Formula: (currentQty * currentCost - receivedQty * receivedCost) / (currentQty - receivedQty)
        // But this can be problematic if quantities changed since the operation
        // Safer approach: if we're undoing to zero, reset cost to 0, otherwise try to restore previous cost
        if (newQty === 0) {
          newData[costColumn.id] = 0
        } else if (currentQty > opItem.quantity) {
          // There's still inventory left, try to reverse the weighted average
          // This removes the cost contribution of the received items
          const totalCostBefore = currentQty * currentCost
          const receivedCostContribution = opItem.quantity * opItem.costPerItem
          const remainingTotalCost = totalCostBefore - receivedCostContribution
          const reversedAvgCost = remainingTotalCost / newQty

          // If the calculation results in a reasonable value, use it
          // Otherwise fall back to previous cost
          if (reversedAvgCost >= 0 && isFinite(reversedAvgCost)) {
            newData[costColumn.id] = reversedAvgCost
          } else {
            newData[costColumn.id] = opItem.previousCost
          }
        } else {
          // Edge case: current qty equals or is less than what was received
          // Just restore the previous cost
          newData[costColumn.id] = opItem.previousCost
        }
      }

      // Update the item in the database
      const updatedItem = await tx.inventoryItem.update({
        where: { id: opItem.itemId },
        data: { data: newData as Prisma.InputJsonValue },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      updatedItems.push(updatedItem)
    }

    // Mark the operation as undone
    const updatedOperation = await tx.operation.update({
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

    return { operation: updatedOperation, updatedItems }
  })

  // Emit socket events for real-time updates
  safeEmitOperationUndo(businessId, result.operation, result.updatedItems)

  return {
    success: true,
    operation: result.operation,
  }
})
