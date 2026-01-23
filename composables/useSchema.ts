import { useInventoryStore } from '~/stores/inventory'
import { useAuthFetch } from '~/composables/useAuthFetch'
import { extractApiError } from '~/composables/useApiError'
import type { ColumnDefinition } from '~/types/schema'

export const useSchema = () => {
  const inventoryStore = useInventoryStore()
  const { authFetch } = useAuthFetch()

  // Initialize isLoading based on whether schema is already loaded
  // This prevents the loading state from being stuck when schema exists in store
  const isLoading = ref(inventoryStore.schema.length === 0)
  const error = ref<string | null>(null)
  const itemCount = ref<number | null>(null)

  const fetchSchema = async () => {
    isLoading.value = true
    error.value = null

    try {
      const response = await authFetch<{ columns: ColumnDefinition[] }>('/api/schema')
      inventoryStore.setSchema(response.columns || [])
      return { success: true, data: response }
    } catch (err: unknown) {
      error.value = extractApiError(err, 'Failed to fetch schema')
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetches the count of inventory items.
   * Uses limit=1 to minimize data transfer while still getting pagination.total.
   */
  const fetchItemCount = async () => {
    try {
      const response = await authFetch<{
        pagination: { total: number }
      }>('/api/inventory', {
        query: { limit: 1 },
      })
      itemCount.value = response.pagination.total
      return { success: true, count: response.pagination.total }
    } catch (err: unknown) {
      return { success: false, error: extractApiError(err, 'Failed to fetch item count') }
    }
  }

  const updateSchema = async (columns: ColumnDefinition[]) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await authFetch<{ columns: ColumnDefinition[] }>('/api/schema', {
        method: 'PUT',
        body: { columns },
      })
      inventoryStore.setSchema(response.columns || [])
      return { success: true, data: response }
    } catch (err: unknown) {
      error.value = extractApiError(err, 'Failed to update schema')
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Reset inventory - deletes ALL items and clears the schema.
   * This is a destructive operation that cannot be undone.
   * Only available to OWNER role.
   */
  const resetInventory = async () => {
    isLoading.value = true
    error.value = null

    try {
      const response = await authFetch<{
        success: boolean
        message: string
        deletedItemsCount: number
        schemaDeleted: boolean
        deletedLogsCount: number
        deletedOperationsCount: number
      }>('/api/schema/reset', {
        method: 'POST',
      })

      // Clear local state after successful reset
      inventoryStore.setSchema([])
      inventoryStore.setItems([])
      inventoryStore.resetPagination()

      return { success: true, data: response }
    } catch (err: unknown) {
      error.value = extractApiError(err, 'Failed to reset inventory')
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  return {
    schema: computed(() => inventoryStore.schema),
    columns: computed(() => inventoryStore.schema),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    itemCount: computed(() => itemCount.value),
    fetchSchema,
    fetchItemCount,
    updateSchema,
    resetInventory,
  }
}
