import { useInventoryStore } from '~/stores/inventory'
import { useAuthFetch } from '~/composables/useAuthFetch'
import { extractApiError } from '~/composables/useApiError'
import { clearBarcodeCache } from '~/composables/useBarcode'
import type { DynamicInventoryItem, Pagination } from '~/types/schema'

interface FetchParams {
  page?: number
  limit?: number
  search?: string
  searchColumns?: string[] | null
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc'
}

interface FetchResponse {
  items: DynamicInventoryItem[]
  pagination: Pagination
}

export const useInventory = () => {
  const inventoryStore = useInventoryStore()
  const { authFetch } = useAuthFetch()

  const fetchItems = async (params: FetchParams = {}) => {
    inventoryStore.setLoading(true)
    try {
      const response = await authFetch<FetchResponse>('/api/inventory', {
        query: {
          page: params.page,
          limit: params.limit,
          search: params.search,
          searchColumns: params.searchColumns?.join(',') || undefined,
          sortColumn: params.sortColumn || undefined,
          sortDirection: params.sortDirection || undefined,
        },
      })

      inventoryStore.setItems(response.items)
      inventoryStore.setPagination(response.pagination)

      return { success: true, data: response }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to fetch items') }
    } finally {
      inventoryStore.setLoading(false)
      // Mark that the initial load has completed (regardless of success/failure)
      if (!inventoryStore.hasInitiallyLoaded) {
        inventoryStore.setInitiallyLoaded(true)
      }
    }
  }

  const fetchItem = async (id: string) => {
    inventoryStore.setLoading(true)
    try {
      const item = await authFetch<DynamicInventoryItem>(`/api/inventory/${id}`)

      inventoryStore.setCurrentItem(item)
      return { success: true, data: item }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to fetch item') }
    } finally {
      inventoryStore.setLoading(false)
    }
  }

  const createItem = async (data: Record<string, unknown>) => {
    inventoryStore.setLoading(true)
    try {
      const item = await authFetch<DynamicInventoryItem>('/api/inventory', {
        method: 'POST',
        body: { data },
      })

      inventoryStore.addItem(item)
      // Clear barcode cache since new item may have a barcode
      clearBarcodeCache()
      return { success: true, data: item }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to create item') }
    } finally {
      inventoryStore.setLoading(false)
    }
  }

  const updateItem = async (id: string, data: Record<string, unknown>) => {
    inventoryStore.setLoading(true)
    try {
      const item = await authFetch<DynamicInventoryItem>(`/api/inventory/${id}`, {
        method: 'PUT',
        body: { data },
      })

      inventoryStore.updateItem(item)
      // Clear barcode cache since item's barcode may have changed
      clearBarcodeCache()
      return { success: true, data: item }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to update item') }
    } finally {
      inventoryStore.setLoading(false)
    }
  }

  const deleteItem = async (id: string) => {
    inventoryStore.setLoading(true)
    try {
      await authFetch(`/api/inventory/${id}`, {
        method: 'DELETE',
      })

      inventoryStore.removeItem(id)
      // Clear barcode cache since deleted item's barcode should no longer resolve
      clearBarcodeCache()
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Failed to delete item') }
    } finally {
      inventoryStore.setLoading(false)
    }
  }

  /**
   * Clears the current item from the store.
   * Used to prevent stale data flash when navigating between items.
   */
  const clearCurrentItem = () => {
    inventoryStore.setCurrentItem(null)
  }

  return {
    // State
    items: computed(() => inventoryStore.items),
    currentItem: computed(() => inventoryStore.currentItem),
    pagination: computed(() => inventoryStore.pagination),
    isLoading: computed(() => inventoryStore.isLoading),
    hasInitiallyLoaded: computed(() => inventoryStore.hasInitiallyLoaded),
    lowStockItems: computed(() => inventoryStore.lowStockItems),
    search: computed(() => inventoryStore.search),
    schema: computed(() => inventoryStore.schema),
    hasSchema: computed(() => inventoryStore.hasSchema),
    sortedColumns: computed(() => inventoryStore.sortedColumns),

    // Actions
    fetchItems,
    fetchItem,
    createItem,
    updateItem,
    deleteItem,
    clearCurrentItem,
    setSearch: inventoryStore.setSearch,
  }
}
