import type { Operation, ReceivingOperationInput } from '~/types/operation'
import { extractApiError } from '~/composables/useApiError'

/**
 * Composable for creating receiving operations.
 *
 * Provides functionality to submit new receiving operations to the API.
 *
 * @example
 * ```typescript
 * const { isLoading, createReceiving } = useReceiving()
 *
 * const result = await createReceiving({
 *   date: '2024-01-15',
 *   reference: 'PO-001',
 *   supplier: 'Acme Corp',
 *   items: [
 *     { itemId: 'item-1', quantity: 10 },
 *     { itemId: 'item-2', quantity: 5 }
 *   ]
 * })
 *
 * if (result.success) {
 *   console.log('Created operation:', result.data)
 * }
 * ```
 */
export const useReceiving = () => {
  const { authFetch } = useAuthFetch()
  const isLoading = ref(false)

  /**
   * Creates a new receiving operation.
   *
   * @param input - The receiving operation input data
   * @returns Result object with success status and created operation or error message
   */
  const createReceiving = async (input: ReceivingOperationInput) => {
    isLoading.value = true
    try {
      const operation = await authFetch<Operation>('/api/operations/receiving', {
        method: 'POST',
        body: input,
      })
      return { success: true, data: operation }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to create receiving operation') }
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    createReceiving,
  }
}
