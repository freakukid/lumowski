export type LogAction =
  | 'ITEM_CREATED'
  | 'ITEM_UPDATED'
  | 'ITEM_DELETED'
  | 'SCHEMA_UPDATED'

/**
 * Represents a conflict between the current item state and the undo target state
 */
export interface ConflictField {
  fieldId: string
  fieldName: string
  currentValue: unknown
  willBecomeValue: unknown
}

/**
 * Response structure for the conflict check endpoint
 */
export interface ConflictCheckResponse {
  hasConflicts: boolean
  conflicts: ConflictField[]
  itemExists: boolean
}

export interface LogChange {
  field: string       // Column ID
  fieldName: string   // Column display name
  oldValue: unknown
  newValue: unknown
}

export interface SchemaChange {
  type: 'added' | 'removed' | 'modified'
  columnId: string
  columnName: string
  details?: string
}

export interface InventoryLog {
  id: string
  action: LogAction
  itemId: string | null
  itemName: string | null
  snapshot: Record<string, unknown> | null
  changes: LogChange[] | null
  schemaChanges: SchemaChange[] | null
  undoable: boolean
  undoneAt: string | null
  undoneById: string | null
  createdAt: string
  businessId: string
  userId: string
  user: {
    id: string
    name: string
  }
  undoneBy?: {
    id: string
    name: string
  } | null
}

export interface LogFilters {
  action?: LogAction
  userId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface LogListResponse {
  logs: InventoryLog[]
  pagination: Pagination
}

export const LOG_ACTION_LABELS: Record<LogAction, string> = {
  ITEM_CREATED: 'Created',
  ITEM_UPDATED: 'Updated',
  ITEM_DELETED: 'Deleted',
  SCHEMA_UPDATED: 'Schema Changed',
}

export const LOG_ACTION_COLORS: Record<LogAction, { bg: string; text: string; icon: string }> = {
  ITEM_CREATED: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: 'text-green-500',
  },
  ITEM_UPDATED: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    icon: 'text-blue-500',
  },
  ITEM_DELETED: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    icon: 'text-red-500',
  },
  SCHEMA_UPDATED: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-700 dark:text-purple-400',
    icon: 'text-purple-500',
  },
}
