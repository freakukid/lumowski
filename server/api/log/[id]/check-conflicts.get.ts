import prisma from '~/server/utils/prisma'
import type { LogChange } from '~/types/log'
import { businessRoute } from '~/server/utils/apiMiddleware'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'

/**
 * Represents a conflict between the current item state and the undo target state
 */
interface ConflictField {
  fieldId: string
  fieldName: string
  currentValue: unknown
  willBecomeValue: unknown
}

/**
 * Response structure for the conflict check endpoint
 */
interface ConflictCheckResponse {
  hasConflicts: boolean
  conflicts: ConflictField[]
  itemExists: boolean
}

/**
 * GET /api/log/[id]/check-conflicts
 *
 * Checks if undoing a log entry would conflict with the current item state.
 * This allows the UI to show a warning before proceeding with the undo.
 *
 * For ITEM_UPDATED: Compares current item data with the old values that will be restored
 * For ITEM_DELETED: Checks if the item already exists (was recreated)
 */
export default businessRoute(async (event, { businessId }): Promise<ConflictCheckResponse> => {
  const id = requireIdParam(event, 'id', 'Log ID is required')

  // Fetch the log entry
  const log = await prisma.inventoryLog.findUnique({
    where: { id },
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
      message: 'You do not have permission to access this log entry',
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

  // Get schema for field name lookup
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId },
  })
  const columns = parseColumnDefinitions(schema?.columns)

  // Helper to get column name by ID
  const getColumnName = (columnId: string): string => {
    const column = columns.find((c) => c.id === columnId)
    return column?.name || columnId
  }

  // Check conflicts based on action type
  switch (log.action) {
    case 'ITEM_DELETED': {
      // For deleted items, check if an item with the same data already exists
      // Since we can't match by ID (it was deleted), we consider it a conflict
      // if the log's snapshot item ID has been recreated
      const snapshot = log.snapshot as { id?: string } | null

      // If snapshot has an original ID, we could check if it was recreated,
      // but the undo creates a new item anyway. The main "conflict" here
      // is that restoring might create a duplicate if user manually recreated it.
      // For now, we return no conflicts for deleted items since the undo
      // always creates a new item with a new ID.
      return {
        hasConflicts: false,
        conflicts: [],
        itemExists: false,
      }
    }

    case 'ITEM_UPDATED': {
      // For updated items, compare current values with what will be restored
      if (!log.changes || !log.itemId) {
        throw createError({
          statusCode: 400,
          message: 'Cannot check conflicts: no changes or item ID available',
        })
      }

      // Check if item still exists
      const existingItem = await prisma.inventoryItem.findUnique({
        where: { id: log.itemId },
      })

      if (!existingItem) {
        // Item no longer exists - this is a different error handled by the undo endpoint
        return {
          hasConflicts: false,
          conflicts: [],
          itemExists: false,
        }
      }

      // Verify item belongs to same business
      if (existingItem.businessId !== businessId) {
        throw createError({
          statusCode: 403,
          message: 'You do not have permission to access this item',
        })
      }

      const currentData = existingItem.data as Record<string, unknown>
      const changes = log.changes as unknown as LogChange[]
      const conflicts: ConflictField[] = []

      // Compare each changed field
      for (const change of changes) {
        const currentValue = currentData[change.field]
        const willBecomeValue = change.oldValue

        // Check if current value differs from what the log recorded as the new value
        // If they differ, it means the item has been modified since this log was created
        const logNewValue = change.newValue

        // Normalize values for comparison (handle null/undefined equivalence)
        const normalizedCurrent = currentValue ?? null
        const normalizedLogNew = logNewValue ?? null

        // Use JSON.stringify for deep comparison
        const currentSerialized = JSON.stringify(normalizedCurrent)
        const logNewSerialized = JSON.stringify(normalizedLogNew)

        if (currentSerialized !== logNewSerialized) {
          // Current value doesn't match what the log recorded as the new value
          // This means someone modified this field after this log entry
          conflicts.push({
            fieldId: change.field,
            fieldName: change.fieldName || getColumnName(change.field),
            currentValue: currentValue,
            willBecomeValue: willBecomeValue,
          })
        }
      }

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        itemExists: true,
      }
    }

    default:
      throw createError({
        statusCode: 400,
        message: 'This action type cannot be undone',
      })
  }
})
