import { getIO } from '~/server/plugins/socket'
import type { InventoryItem, InventoryLog, Operation } from '@prisma/client'

/**
 * Helper to safely emit events with proper error handling.
 * Returns false silently if the socket server is not available.
 */
function safeEmit(
  businessId: string,
  event: string,
  data?: unknown
): boolean {
  const io = getIO()
  if (!io) {
    return false
  }

  try {
    if (data !== undefined) {
      io.to(`business:${businessId}`).emit(event, data)
    } else {
      io.to(`business:${businessId}`).emit(event)
    }
    return true
  } catch (error) {
    console.error(`[Socket.io] Error emitting '${event}':`, error)
    return false
  }
}

export function emitInventoryCreated(
  businessId: string,
  item: InventoryItem & { createdBy: { id: string; name: string } }
) {
  safeEmit(businessId, 'inventory:created', item)
}

export function emitInventoryUpdated(
  businessId: string,
  item: InventoryItem & { createdBy: { id: string; name: string } }
) {
  safeEmit(businessId, 'inventory:updated', item)
}

export function emitInventoryDeleted(businessId: string, id: string) {
  safeEmit(businessId, 'inventory:deleted', id)
}

export function emitLogCreated(
  businessId: string,
  log: InventoryLog & { user: { id: string; name: string } }
) {
  safeEmit(businessId, 'log:created', log)
}

export function emitLogUndone(
  businessId: string,
  log: InventoryLog & { user: { id: string; name: string }; undoneBy?: { id: string; name: string } | null }
) {
  safeEmit(businessId, 'log:undone', log)
}

/**
 * Emits an event when inventory is reset (all items and schema deleted).
 * Clients should clear their local state when receiving this event.
 */
export function emitInventoryReset(businessId: string) {
  safeEmit(businessId, 'inventory:reset')
}

/**
 * Emits an event when a new operation is created (e.g., receiving inventory).
 * Clients can use this to update operation lists in real-time.
 */
export function emitOperationCreated(
  businessId: string,
  operation: Operation & { user: { id: string; name: string } }
) {
  safeEmit(businessId, 'operation:created', operation)
}

/**
 * Emits an event when an operation is undone.
 * Clients can use this to update operation details and lists in real-time.
 */
export function emitOperationUndone(
  businessId: string,
  operation: Operation & {
    user: { id: string; name: string }
    undoneBy?: { id: string; name: string } | null
  }
) {
  safeEmit(businessId, 'operation:undone', operation)
}

/**
 * Type definition for inventory items with creator info
 */
type InventoryItemWithCreator = InventoryItem & { createdBy: { id: string; name: string } }

/**
 * Safely emits socket events for operation creation and inventory updates.
 * Catches and logs any errors without throwing, as socket events are non-critical.
 *
 * This helper is designed for use after database transactions that:
 * 1. Create an operation (e.g., receiving, sale)
 * 2. Update one or more inventory items
 *
 * @param businessId - The business ID to emit events to
 * @param operation - The created operation to broadcast
 * @param updatedItems - Array of inventory items that were updated
 *
 * @example
 * // After a transaction completes successfully:
 * safeEmitInventoryUpdate(auth.businessId!, result.operation, result.updatedItems)
 */
export function safeEmitInventoryUpdate(
  businessId: string,
  operation: Operation & { user: { id: string; name: string } },
  updatedItems: InventoryItemWithCreator[]
): void {
  try {
    // Emit operation created event
    emitOperationCreated(businessId, operation)

    // Emit inventory updated events for each affected item
    for (const item of updatedItems) {
      emitInventoryUpdated(businessId, item)
    }
  } catch (error) {
    // Log the error but don't fail the operation - socket events are non-critical
    console.error('Failed to emit socket events:', error)
  }
}

/**
 * Safely emits socket events for operation undo and inventory updates.
 * Catches and logs any errors without throwing, as socket events are non-critical.
 *
 * This helper is designed for use after undo transactions that:
 * 1. Mark an operation as undone
 * 2. Revert one or more inventory item quantities
 *
 * @param businessId - The business ID to emit events to
 * @param operation - The undone operation to broadcast
 * @param updatedItems - Array of inventory items that were reverted
 *
 * @example
 * // After an undo transaction completes successfully:
 * safeEmitOperationUndo(auth.businessId!, result.operation, result.updatedItems)
 */
export function safeEmitOperationUndo(
  businessId: string,
  operation: Operation & {
    user: { id: string; name: string }
    undoneBy?: { id: string; name: string } | null
  },
  updatedItems: InventoryItemWithCreator[]
): void {
  try {
    // Emit operation undone event
    emitOperationUndone(businessId, operation)

    // Emit inventory updated events for each affected item
    for (const item of updatedItems) {
      emitInventoryUpdated(businessId, item)
    }
  } catch (error) {
    // Log the error but don't fail the operation - socket events are non-critical
    console.error('Failed to emit socket events:', error)
  }
}
