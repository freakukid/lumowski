import { ref } from 'vue'
import type { Operation, SaleOperationInput } from '~/types/operation'
import { extractApiError } from '~/composables/useApiError'
import { useAuthFetch } from '~/composables/useAuthFetch'

/**
 * Composable for creating sale operations.
 *
 * Provides functionality to submit new sale operations to the API.
 * Supports both single payment and split payment modes.
 *
 * @example Single payment mode
 * ```typescript
 * const { isLoading, createSale } = useSale()
 *
 * const result = await createSale({
 *   date: '2024-01-15',
 *   paymentMethod: 'CASH',
 *   notes: 'Optional sale notes',
 *   items: [
 *     { itemId: 'item-1', quantity: 2 },
 *     { itemId: 'item-2', quantity: 1, discount: 10, discountType: 'percent' }
 *   ]
 * })
 *
 * if (result.success) {
 *   console.log('Created sale:', result.data)
 * }
 * ```
 *
 * @example Split payment mode
 * ```typescript
 * const result = await createSale({
 *   date: '2024-01-15',
 *   payments: [
 *     { method: 'CASH', amount: 50 },
 *     { method: 'CARD', amount: 30, cardType: 'VISA' }
 *   ],
 *   items: [{ itemId: 'item-1', quantity: 1 }]
 * })
 * ```
 */
export const useSale = () => {
  const { authFetch } = useAuthFetch()
  const isLoading = ref(false)

  /**
   * Creates a new sale operation.
   *
   * @param input - The sale operation input data
   * @returns Result object with success status and created operation or error message
   */
  const createSale = async (input: SaleOperationInput) => {
    isLoading.value = true
    try {
      const operation = await authFetch<Operation>('/api/operations/sale', {
        method: 'POST',
        body: input,
      })
      return { success: true, data: operation }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to create sale') }
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    createSale,
  }
}
