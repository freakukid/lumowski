import { ref } from 'vue'
import type { Operation, ReturnOperationInput, ReturnableItem, ReturnItemCondition } from '~/types/operation'
import { extractApiError } from '~/composables/useApiError'
import { useAuthFetch } from '~/composables/useAuthFetch'

/**
 * Data structure for tracking return item state in the UI.
 */
export interface ReturnItemData {
  selected: boolean
  quantity: number
  condition: ReturnItemCondition
}

/**
 * Creates default return item data with sensible initial values.
 * Use this when initializing return data for items.
 */
export const createDefaultReturnItemData = (): ReturnItemData => ({
  selected: false,
  quantity: 0,
  condition: 'resellable' as ReturnItemCondition,
})

/**
 * Composable for handling return operations.
 *
 * Provides functionality to process customer returns, fetch returnable items
 * from a sale, and retrieve return history for a sale.
 *
 * @example
 * ```typescript
 * const { isLoading, processReturn, getReturnableItems, getReturnsForSale } = useReturn()
 *
 * // Get items available for return from a sale
 * const result = await getReturnableItems('sale-123')
 * if (result.success) {
 *   console.log('Returnable items:', result.data)
 * }
 *
 * // Process a return
 * const returnResult = await processReturn({
 *   originalSaleId: 'sale-123',
 *   date: '2026-01-28',
 *   reason: 'Customer changed mind',
 *   refundMethod: 'CASH',
 *   items: [
 *     { itemId: 'item-1', quantity: 2, condition: 'resellable' }
 *   ]
 * })
 *
 * // Get all returns linked to a sale
 * const returnsResult = await getReturnsForSale('sale-123')
 * ```
 */
export const useReturn = () => {
  const { authFetch } = useAuthFetch()
  const isLoading = ref(false)

  /**
   * Processes a customer return.
   *
   * Creates a new RETURN operation linked to the original sale.
   * Restores inventory for resellable items and calculates refund amounts.
   *
   * @param input - The return operation input data
   * @returns Result object with success status and created operation or error message
   */
  const processReturn = async (input: ReturnOperationInput) => {
    isLoading.value = true
    try {
      const operation = await authFetch<Operation>('/api/operations/return', {
        method: 'POST',
        body: input,
      })
      return { success: true, data: operation }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to process return') }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Response structure from the returnable-items endpoint.
   * Contains metadata about the sale along with the items available for return.
   */
  interface ReturnableItemsResponse {
    saleId: string
    saleDate: string
    saleReference: string | null
    items: ReturnableItem[]
    isFullyReturned: boolean
  }

  /**
   * Fetches items available for return from a sale.
   *
   * Returns items from the original sale with quantities adjusted for any
   * previous returns. Items with zero available quantity are excluded.
   *
   * @param saleId - The ID of the original sale operation
   * @returns Result object with success status and returnable items or error message
   */
  const getReturnableItems = async (saleId: string) => {
    isLoading.value = true
    try {
      const response = await authFetch<ReturnableItemsResponse>(
        `/api/operations/${saleId}/returnable-items`
      )
      // Extract the items array from the wrapped response
      return { success: true, data: response.items }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to fetch returnable items') }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches all return operations linked to a sale.
   *
   * Useful for displaying return history on the sale details page.
   *
   * @param saleId - The ID of the original sale operation
   * @returns Result object with success status and return operations or error message
   */
  const getReturnsForSale = async (saleId: string) => {
    isLoading.value = true
    try {
      const returns = await authFetch<Operation[]>(
        `/api/operations/${saleId}/returns`
      )
      return { success: true, data: returns }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to fetch returns') }
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    processReturn,
    getReturnableItems,
    getReturnsForSale,
  }
}
