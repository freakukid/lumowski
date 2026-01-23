import type { Operation, OperationListResponse } from '~/types/operation'
import { extractApiError } from '~/composables/useApiError'

interface FetchParams {
  page?: number
  limit?: number
}

/**
 * Composable for fetching and managing operations.
 *
 * Provides state and methods for listing operations with pagination support,
 * as well as fetching individual operation details.
 *
 * @example
 * ```typescript
 * const { operations, pagination, isLoading, fetchOperations, fetchOperation } = useOperations()
 *
 * // Fetch first page
 * await fetchOperations()
 *
 * // Fetch specific page
 * await fetchOperations({ page: 2, limit: 20 })
 *
 * // Fetch single operation
 * await fetchOperation('operation-id')
 * ```
 */
export const useOperations = () => {
  const { authFetch } = useAuthFetch()

  const operations = ref<Operation[]>([])
  const currentOperation = ref<Operation | null>(null)
  const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const isLoading = ref(false)
  const hasInitiallyLoaded = ref(false)

  /**
   * Fetches operations list with optional pagination parameters.
   *
   * @param params - Optional pagination parameters (page, limit)
   * @returns Result object with success status and data or error message
   */
  const fetchOperations = async (params: FetchParams = {}) => {
    isLoading.value = true
    try {
      const response = await authFetch<OperationListResponse>('/api/operations', {
        query: { page: params.page, limit: params.limit },
      })
      operations.value = response.operations
      pagination.value = response.pagination
      hasInitiallyLoaded.value = true
      return { success: true, data: response }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to fetch operations') }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches a single operation by ID.
   *
   * @param id - The operation ID to fetch
   * @returns Result object with success status and data or error message
   */
  const fetchOperation = async (id: string) => {
    isLoading.value = true
    try {
      const response = await authFetch<Operation>(`/api/operations/${id}`)
      currentOperation.value = response
      return { success: true, data: response }
    } catch (error: unknown) {
      currentOperation.value = null
      return { success: false, error: extractApiError(error, 'Failed to fetch operation') }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Undoes an operation by ID.
   * Only available to users with OWNER role.
   *
   * @param id - The operation ID to undo
   * @returns Result object with success status and updated operation or error message
   */
  const undoOperation = async (id: string) => {
    isLoading.value = true
    try {
      const response = await authFetch<{ success: boolean; operation: Operation }>(
        `/api/operations/${id}/undo`,
        { method: 'POST' }
      )
      if (response.success) {
        currentOperation.value = response.operation
      }
      return { success: true, data: response.operation }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to undo operation') }
    } finally {
      isLoading.value = false
    }
  }

  return {
    operations,
    currentOperation,
    pagination,
    isLoading,
    hasInitiallyLoaded,
    fetchOperations,
    fetchOperation,
    undoOperation,
  }
}
