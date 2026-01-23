import { useAuthFetch } from '~/composables/useAuthFetch'
import { extractApiError } from '~/composables/useApiError'
import type { InventoryLog, LogFilters, LogListResponse, ConflictCheckResponse } from '~/types/log'
import type { DynamicInventoryItem } from '~/types/schema'

/**
 * Response structure for the undo operation
 */
interface UndoResponse {
  success: boolean
  message: string
  item?: DynamicInventoryItem
}

export function useLog() {
  const { authFetch } = useAuthFetch()
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch logs with filters and pagination
   */
  async function fetchLogs(
    filters: LogFilters = {},
    page = 1,
    limit = 20
  ): Promise<LogListResponse | null> {
    loading.value = true
    error.value = null

    try {
      // Build query object for authFetch (handles undefined values automatically)
      const query: Record<string, string | number | undefined> = {
        page,
        limit,
        action: filters.action,
        userId: filters.userId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        search: filters.search,
      }

      const response = await authFetch<LogListResponse>('/api/log', { query })
      return response
    } catch (err) {
      const errorMessage = extractApiError(err, 'Failed to fetch logs')
      error.value = errorMessage
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch a single log entry
   */
  async function fetchLog(id: string): Promise<InventoryLog | null> {
    loading.value = true
    error.value = null

    try {
      const response = await authFetch<InventoryLog>(`/api/log/${id}`)
      return response
    } catch (err) {
      const errorMessage = extractApiError(err, 'Failed to fetch log entry')
      error.value = errorMessage
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Undo a log action
   */
  async function undoLog(id: string): Promise<UndoResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = await authFetch<UndoResponse>(`/api/log/${id}/undo`, {
        method: 'POST',
      })
      return response
    } catch (err) {
      const errorMessage = extractApiError(err, 'Failed to undo action')
      error.value = errorMessage
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Check for conflicts before undoing a log action.
   * Returns information about any fields that have changed since the log was created.
   */
  async function checkUndoConflicts(id: string): Promise<ConflictCheckResponse | null> {
    loading.value = true
    error.value = null

    try {
      const response = await authFetch<ConflictCheckResponse>(`/api/log/${id}/check-conflicts`)
      return response
    } catch (err) {
      const errorMessage = extractApiError(err, 'Failed to check undo conflicts')
      error.value = errorMessage
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    fetchLogs,
    fetchLog,
    undoLog,
    checkUndoConflicts,
  }
}
