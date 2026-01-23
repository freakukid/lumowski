import { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import type { ColumnDefinition } from '~/types/schema'
import type { LogChange, SchemaChange } from '~/types/log'
import type { InventoryItem, LogAction } from '@prisma/client'
import { emitLogCreated } from '~/server/utils/socket'

interface CreateLogParams {
  action: LogAction
  businessId: string
  userId: string
  itemId?: string
  itemName?: string
  snapshot?: Record<string, unknown>
  changes?: LogChange[]
  schemaChanges?: SchemaChange[]
  undoable?: boolean
}

/**
 * Create an inventory log entry
 */
export async function createInventoryLog(params: CreateLogParams) {
  const {
    action,
    businessId,
    userId,
    itemId,
    itemName,
    snapshot,
    changes,
    schemaChanges,
    undoable = true,
  } = params

  const log = await prisma.inventoryLog.create({
    data: {
      action,
      businessId,
      userId,
      itemId: itemId ?? null,
      itemName: itemName ?? null,
      snapshot: (snapshot ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      changes: (changes ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      schemaChanges: (schemaChanges ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      undoable,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // Emit socket event for real-time updates
  // Wrapped in try-catch to prevent silent failures from breaking the main operation
  try {
    emitLogCreated(businessId, log)
  } catch (error) {
    // Log the error but don't fail the operation - socket emission is non-critical
    console.error('Failed to emit log created event:', error)
  }

  return log
}

/**
 * Get a snapshot of an inventory item's data
 */
export function getItemSnapshot(
  item: InventoryItem & { createdBy?: { id: string; name: string } }
): Record<string, unknown> {
  return {
    id: item.id,
    data: item.data,
    businessId: item.businessId,
    createdById: item.createdById,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    createdBy: item.createdBy,
  }
}

/**
 * Get the item name from the data based on the column with 'name' role
 */
export function getItemName(
  data: Record<string, unknown>,
  columns: ColumnDefinition[]
): string | null {
  const nameColumn = columns.find((c) => c.role === 'name')
  if (!nameColumn) return null

  const value = data[nameColumn.id]
  return typeof value === 'string' ? value : null
}

/**
 * Calculate the differences between old and new item data
 */
export function diffChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  columns: ColumnDefinition[]
): LogChange[] {
  const changes: LogChange[] = []

  for (const column of columns) {
    const oldValue = oldData[column.id]
    const newValue = newData[column.id]

    // Check if values are different (handle nullish values)
    if (!isEqual(oldValue, newValue)) {
      changes.push({
        field: column.id,
        fieldName: column.name,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
      })
    }
  }

  return changes
}

/**
 * Calculate schema changes between old and new column definitions
 */
export function diffSchemaChanges(
  oldColumns: ColumnDefinition[],
  newColumns: ColumnDefinition[]
): SchemaChange[] {
  const changes: SchemaChange[] = []
  const oldColumnMap = new Map(oldColumns.map((c) => [c.id, c]))
  const newColumnMap = new Map(newColumns.map((c) => [c.id, c]))

  // Find added columns
  for (const newCol of newColumns) {
    if (!oldColumnMap.has(newCol.id)) {
      changes.push({
        type: 'added',
        columnId: newCol.id,
        columnName: newCol.name,
        details: `Type: ${newCol.type}`,
      })
    }
  }

  // Find removed columns
  for (const oldCol of oldColumns) {
    if (!newColumnMap.has(oldCol.id)) {
      changes.push({
        type: 'removed',
        columnId: oldCol.id,
        columnName: oldCol.name,
      })
    }
  }

  // Find modified columns
  for (const newCol of newColumns) {
    const oldCol = oldColumnMap.get(newCol.id)
    if (oldCol) {
      const modifications: string[] = []

      if (oldCol.name !== newCol.name) {
        modifications.push(`Name: "${oldCol.name}" → "${newCol.name}"`)
      }
      if (oldCol.type !== newCol.type) {
        modifications.push(`Type: ${oldCol.type} → ${newCol.type}`)
      }
      if (oldCol.role !== newCol.role) {
        modifications.push(`Role: ${oldCol.role || 'none'} → ${newCol.role || 'none'}`)
      }
      if (oldCol.required !== newCol.required) {
        modifications.push(`Required: ${oldCol.required} → ${newCol.required}`)
      }
      if (oldCol.order !== newCol.order) {
        modifications.push(`Order: ${oldCol.order} → ${newCol.order}`)
      }
      if (!arraysEqual(oldCol.options || [], newCol.options || [])) {
        modifications.push('Options changed')
      }

      if (modifications.length > 0) {
        changes.push({
          type: 'modified',
          columnId: newCol.id,
          columnName: newCol.name,
          details: modifications.join(', '),
        })
      }
    }
  }

  return changes
}

/**
 * Simple deep equality check for primitive values and arrays
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a === undefined || b === undefined) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    return arraysEqual(a, b)
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object)
    const bKeys = Object.keys(b as object)
    if (aKeys.length !== bKeys.length) return false

    for (const key of aKeys) {
      if (!isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false
      }
    }
    return true
  }

  return false
}

/**
 * Check if two arrays are equal
 */
function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!isEqual(a[i], b[i])) return false
  }
  return true
}
