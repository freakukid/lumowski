import { defineStore } from 'pinia'
import type { ColumnDefinition, DynamicInventoryItem, Pagination } from '~/types/schema'

interface InventoryState {
  schema: ColumnDefinition[]
  items: DynamicInventoryItem[]
  currentItem: DynamicInventoryItem | null
  pagination: Pagination
  isLoading: boolean
  hasInitiallyLoaded: boolean
  search: string
}

export const useInventoryStore = defineStore('inventory', {
  state: (): InventoryState => ({
    schema: [],
    items: [],
    currentItem: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
    isLoading: false,
    hasInitiallyLoaded: false,
    search: '',
  }),

  getters: {
    // Find column by role
    getColumnByRole: (state) => (role: string) =>
      state.schema.find((c) => c.role === role),

    // Low stock items (if quantity and minQuantity roles exist)
    lowStockItems: (state) => {
      const qtyCol = state.schema.find((c) => c.role === 'quantity')
      const minCol = state.schema.find((c) => c.role === 'minQuantity')

      if (!qtyCol || !minCol) return []

      return state.items.filter((item) => {
        const qty = Number(item.data[qtyCol.id]) || 0
        const min = Number(item.data[minCol.id]) || 0
        return qty <= min
      })
    },

    // Total inventory value (if price and quantity roles exist)
    totalValue: (state) => {
      const priceCol = state.schema.find((c) => c.role === 'price')
      const qtyCol = state.schema.find((c) => c.role === 'quantity')

      if (!priceCol || !qtyCol) return null

      return state.items.reduce((sum, item) => {
        const price = Number(item.data[priceCol.id]) || 0
        const qty = Number(item.data[qtyCol.id]) || 0
        return sum + price * qty
      }, 0)
    },

    // Has schema defined
    hasSchema: (state) => state.schema.length > 0,

    // Sorted columns by order
    sortedColumns: (state) => [...state.schema].sort((a, b) => a.order - b.order),
  },

  actions: {
    setSchema(columns: ColumnDefinition[]) {
      this.schema = columns
    },

    setItems(items: DynamicInventoryItem[]) {
      this.items = items
    },

    setPagination(pagination: Pagination) {
      this.pagination = pagination
    },

    setCurrentItem(item: DynamicInventoryItem | null) {
      this.currentItem = item
    },

    addItem(item: DynamicInventoryItem) {
      this.items.unshift(item)
      this.pagination.total++
    },

    updateItem(updatedItem: DynamicInventoryItem) {
      const index = this.items.findIndex((item) => item.id === updatedItem.id)
      if (index !== -1) {
        this.items[index] = updatedItem
      }
      if (this.currentItem?.id === updatedItem.id) {
        this.currentItem = updatedItem
      }
    },

    removeItem(id: string) {
      this.items = this.items.filter((item) => item.id !== id)
      // Ensure total never goes negative
      if (this.pagination.total > 0) {
        this.pagination.total--
      }
      if (this.currentItem?.id === id) {
        this.currentItem = null
      }
    },

    /**
     * Resets pagination to initial state.
     * Should be called when all items are cleared (e.g., schema reset).
     */
    resetPagination() {
      this.pagination = {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      }
    },

    setSearch(search: string) {
      this.search = search
    },

    setLoading(loading: boolean) {
      this.isLoading = loading
    },

    setInitiallyLoaded(loaded: boolean) {
      this.hasInitiallyLoaded = loaded
    },
  },
})
