import { ref, readonly } from 'vue'
import { extractApiError } from '~/composables/useApiError'

/**
 * Result type for async operations.
 * Discriminated union that ensures type-safe access to data or error.
 */
export type AsyncResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Composable that wraps async operations with loading state and error handling.
 *
 * Reduces the repeated try-catch-finally-loading pattern found across composables.
 * Provides a consistent interface for executing async operations while tracking
 * loading state and handling errors.
 *
 * @param errorFallback - Default error message when no specific message is available
 * @returns Object containing execute function, loading state, and last error
 *
 * @example
 * ```typescript
 * const { execute, isLoading, error } = useAsyncOperation('Failed to save')
 *
 * const result = await execute(async () => {
 *   return await authFetch('/api/resource', { method: 'POST', body: data })
 * })
 *
 * if (result.success) {
 *   console.log('Saved:', result.data)
 * } else {
 *   console.error('Error:', result.error)
 * }
 * ```
 */
export function useAsyncOperation(errorFallback: string = 'Operation failed') {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Executes an async operation with automatic loading state and error handling.
   *
   * @param operation - Async function to execute
   * @param customFallback - Optional fallback message for this specific operation
   * @returns Promise resolving to success/error result
   */
  async function execute<T>(
    operation: () => Promise<T>,
    customFallback?: string
  ): Promise<AsyncResult<T>> {
    isLoading.value = true
    error.value = null

    try {
      const data = await operation()
      return { success: true, data }
    } catch (err: unknown) {
      const message = extractApiError(err, customFallback ?? errorFallback)
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  return {
    execute,
    isLoading: readonly(isLoading),
    error: readonly(error),
  }
}
