import { getIO } from '~/server/plugins/socket'
import type { InventoryItem, InventoryLog, Operation } from '@prisma/client'

export function emitInventoryCreated(
  businessId: string,
  item: InventoryItem & { createdBy: { id: string; name: string } }
) {
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('inventory:created', item)
  }
}

export function emitInventoryUpdated(
  businessId: string,
  item: InventoryItem & { createdBy: { id: string; name: string } }
) {
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('inventory:updated', item)
  }
}

export function emitInventoryDeleted(businessId: string, id: string) {
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('inventory:deleted', id)
  }
}

export function emitLogCreated(
  businessId: string,
  log: InventoryLog & { user: { id: string; name: string } }
) {
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('log:created', log)
  }
}

export function emitLogUndone(
  businessId: string,
  log: InventoryLog & { user: { id: string; name: string }; undoneBy?: { id: string; name: string } | null }
) {
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('log:undone', log)
  }
}

/**
 * Emits an event when inventory is reset (all items and schema deleted).
 * Clients should clear their local state when receiving this event.
 */
export function emitInventoryReset(businessId: string) {
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('inventory:reset')
  }
}

/**
 * Emits an event when a new operation is created (e.g., receiving inventory).
 * Clients can use this to update operation lists in real-time.
 */
export function emitOperationCreated(
  businessId: string,
  operation: Operation & { user: { id: string; name: string } }
) {
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('operation:created', operation)
  }
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
  const io = getIO()
  if (io) {
    io.to(`business:${businessId}`).emit('operation:undone', operation)
  }
}

