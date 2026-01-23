import type { LogAction, LogChange, SchemaChange, InventoryLog } from '~/types/log'
import { LOG_ACTION_LABELS, LOG_ACTION_COLORS } from '~/types/log'

/**
 * Represents a group of logs for a specific date
 */
export interface LogGroup {
  dateKey: string      // ISO date string, e.g., "2026-01-21"
  displayDate: string  // Human-readable date, e.g., "Today", "Yesterday", "January 20"
  logs: InventoryLog[]
}

/**
 * Format a date key into a human-readable display string
 *
 * Rules:
 * - Today -> "Today"
 * - Yesterday -> "Yesterday"
 * - Within last 7 days -> Day name (e.g., "Monday")
 * - Current year -> "January 15"
 * - Previous years -> "December 28, 2025"
 */
export function formatGroupDate(dateKey: string): string {
  const date = new Date(dateKey + 'T00:00:00') // Parse as local date
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffTime = today.getTime() - targetDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  }

  if (diffDays === 1) {
    return 'Yesterday'
  }

  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' })
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
  }

  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * Group logs by their creation date
 * Returns an array of LogGroup objects sorted by date (most recent first)
 */
export function groupLogsByDate(logs: InventoryLog[]): LogGroup[] {
  if (!logs || logs.length === 0) {
    return []
  }

  // Group logs by date key (YYYY-MM-DD)
  const groupMap = new Map<string, InventoryLog[]>()

  for (const log of logs) {
    const date = new Date(log.createdAt)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    if (!groupMap.has(dateKey)) {
      groupMap.set(dateKey, [])
    }
    groupMap.get(dateKey)!.push(log)
  }

  // Convert map to array of LogGroup objects
  const groups: LogGroup[] = []
  for (const [dateKey, groupLogs] of groupMap) {
    groups.push({
      dateKey,
      displayDate: formatGroupDate(dateKey),
      logs: groupLogs,
    })
  }

  // Sort groups by date (most recent first)
  groups.sort((a, b) => b.dateKey.localeCompare(a.dateKey))

  return groups
}

export function useLogHelpers() {
  /**
   * Get the display label for a log action
   */
  function getActionLabel(action: LogAction): string {
    return LOG_ACTION_LABELS[action] || action
  }

  /**
   * Get the color classes for a log action
   */
  function getActionColors(action: LogAction) {
    return LOG_ACTION_COLORS[action] || {
      bg: 'bg-surface-100',
      text: 'text-surface-700',
      icon: 'text-surface-500',
    }
  }

  /**
   * Format a date for display
   */
  function formatDate(dateString: string, options?: { includeTime?: boolean }): string {
    const date = new Date(dateString)
    const { includeTime = true } = options || {}

    if (includeTime) {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  /**
   * Get relative time description (e.g., "2 hours ago")
   */
  function getRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return formatDate(dateString, { includeTime: false })
  }

  /**
   * Format a value for display in diffs
   */
  function formatValue(value: unknown): string {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toLocaleString()
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  /**
   * Get a summary description for a log entry
   */
  function getLogSummary(
    action: LogAction,
    itemName: string | null,
    changes: LogChange[] | null,
    schemaChanges: SchemaChange[] | null
  ): string {
    switch (action) {
      case 'ITEM_CREATED':
        return itemName ? `Created "${itemName}"` : 'Created an item'
      case 'ITEM_UPDATED':
        if (changes && changes.length > 0) {
          if (changes.length === 1) {
            return itemName
              ? `Updated "${itemName}" (${changes[0].fieldName})`
              : `Updated ${changes[0].fieldName}`
          }
          return itemName
            ? `Updated "${itemName}" (${changes.length} fields)`
            : `Updated ${changes.length} fields`
        }
        return itemName ? `Updated "${itemName}"` : 'Updated an item'
      case 'ITEM_DELETED':
        return itemName ? `Deleted "${itemName}"` : 'Deleted an item'
      case 'SCHEMA_UPDATED':
        if (schemaChanges && schemaChanges.length > 0) {
          const added = schemaChanges.filter((c) => c.type === 'added').length
          const removed = schemaChanges.filter((c) => c.type === 'removed').length
          const modified = schemaChanges.filter((c) => c.type === 'modified').length

          const parts: string[] = []
          if (added > 0) parts.push(`+${added}`)
          if (removed > 0) parts.push(`-${removed}`)
          if (modified > 0) parts.push(`~${modified}`)

          return `Schema changed (${parts.join(', ')} columns)`
        }
        return 'Schema changed'
      default:
        return 'Unknown action'
    }
  }

  /**
   * Check if a log entry can still be undone
   */
  function canUndo(log: {
    undoable: boolean
    undoneAt: string | null
    action: LogAction
  }): boolean {
    if (!log.undoable) return false
    if (log.undoneAt) return false
    // Only ITEM_DELETED and ITEM_UPDATED can be undone
    return log.action === 'ITEM_DELETED' || log.action === 'ITEM_UPDATED'
  }

  return {
    getActionLabel,
    getActionColors,
    formatDate,
    getRelativeTime,
    formatValue,
    getLogSummary,
    canUndo,
    groupLogsByDate,
    formatGroupDate,
  }
}
