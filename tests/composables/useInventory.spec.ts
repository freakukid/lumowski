import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { DynamicInventoryItem, ColumnDefinition, Pagination } from '~/types/schema'

vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

const mockAuthFetch = vi.fn()
vi.mock('~/composables/useAuthFetch', () => ({
  useAuthFetch: () => ({ authFetch: mockAuthFetch }),
}))

vi.mock('~/composables/useApiError', () => ({
  extractApiError: (error: unknown, fallback: string) => {
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>
      if (typeof err.data === 'object' && err.data !== null) {
        const data = err.data as Record<string, unknown>
        if (typeof data.message === 'string') return data.message
      }
      if (typeof err.message === 'string') return err.message
    }
    return fallback
  },
}))

const mockInventoryStore = {
  items: [] as DynamicInventoryItem[],
  currentItem: null as DynamicInventoryItem | null,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } as Pagination,
  isLoading: false,
  hasInitiallyLoaded: false,
  search: '',
  schema: [] as ColumnDefinition[],
  lowStockItems: [] as DynamicInventoryItem[],
  hasSchema: false,
  sortedColumns: [] as ColumnDefinition[],
  setLoading: vi.fn((l: boolean) => { mockInventoryStore.isLoading = l }),
  setItems: vi.fn((i: DynamicInventoryItem[]) => { mockInventoryStore.items = i }),
  setPagination: vi.fn((p: Pagination) => { mockInventoryStore.pagination = p }),
  setCurrentItem: vi.fn((i: DynamicInventoryItem | null) => { mockInventoryStore.currentItem = i }),
  addItem: vi.fn((i: DynamicInventoryItem) => { mockInventoryStore.items.unshift(i); mockInventoryStore.pagination.total++ }),
  updateItem: vi.fn(),
  removeItem: vi.fn((id: string) => { mockInventoryStore.items = mockInventoryStore.items.filter(i => i.id !== id) }),
  setInitiallyLoaded: vi.fn((l: boolean) => { mockInventoryStore.hasInitiallyLoaded = l }),
  setSearch: vi.fn((s: string) => { mockInventoryStore.search = s }),
}

vi.mock('~/stores/inventory', () => ({
  useInventoryStore: () => mockInventoryStore,
}))

import { useInventory } from '~/composables/useInventory'

function createItem(id: string, data: Record<string, unknown> = {}): DynamicInventoryItem {
  return { id, data, businessId: 'b1', createdById: 'u1', createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' }
}

function createPagination(o: Partial<Pagination> = {}): Pagination {
  return { page: 1, limit: 20, total: 0, totalPages: 0, ...o }
}

function resetMockStore(): void {
  mockInventoryStore.items = []
  mockInventoryStore.currentItem = null
  mockInventoryStore.pagination = createPagination()
  mockInventoryStore.isLoading = false
  mockInventoryStore.hasInitiallyLoaded = false
  mockInventoryStore.search = ''
  mockInventoryStore.schema = []
  mockInventoryStore.lowStockItems = []
  mockInventoryStore.hasSchema = false
  mockInventoryStore.sortedColumns = []
}

describe('fetchItems', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should fetch items successfully', async () => {
    const items = [createItem('1', { name: 'Widget' })]
    const pagination = createPagination({ total: 1, totalPages: 1 })
    mockAuthFetch.mockResolvedValueOnce({ items, pagination })
    const inv = useInventory()
    const result = await inv.fetchItems()
    expect(result.success).toBe(true)
    expect(mockInventoryStore.setItems).toHaveBeenCalledWith(items)
    expect(mockInventoryStore.setPagination).toHaveBeenCalledWith(pagination)
  })

  it('should set loading state during fetch', async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination() })
    const inv = useInventory()
    await inv.fetchItems()
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(true)
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(false)
  })

  it('should mark initially loaded after first fetch', async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination() })
    const inv = useInventory()
    await inv.fetchItems()
    expect(mockInventoryStore.setInitiallyLoaded).toHaveBeenCalledWith(true)
  })

  it('should pass pagination parameters to API', async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination() })
    const inv = useInventory()
    await inv.fetchItems({ page: 2, limit: 50 })
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', {
      query: { page: 2, limit: 50, search: undefined, searchColumns: undefined },
    })
  })

  it('should pass search params', async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination() })
    const inv = useInventory()
    await inv.fetchItems({ search: 'widget', searchColumns: ['col1', 'col2'] })
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', {
      query: { page: undefined, limit: undefined, search: 'widget', searchColumns: 'col1,col2' },
    })
  })

  it('should handle empty searchColumns array', async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination() })
    const inv = useInventory()
    await inv.fetchItems({ searchColumns: [] })
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', {
      query: expect.objectContaining({ searchColumns: undefined }),
    })
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))
    const inv = useInventory()
    const result = await inv.fetchItems()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('should return fallback error on unknown error', async () => {
    mockAuthFetch.mockRejectedValueOnce('unknown')
    const inv = useInventory()
    const result = await inv.fetchItems()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to fetch items')
  })

  it('should handle API error with data.message', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Custom API error' } })
    const inv = useInventory()
    const result = await inv.fetchItems()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Custom API error')
  })

  it('should not call setInitiallyLoaded if already loaded', async () => {
    mockInventoryStore.hasInitiallyLoaded = true
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination() })
    const inv = useInventory()
    await inv.fetchItems()
    expect(mockInventoryStore.setInitiallyLoaded).not.toHaveBeenCalled()
  })
})

describe('fetchItem', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should fetch single item', async () => {
    const item = createItem('1', { name: 'Widget' })
    mockAuthFetch.mockResolvedValueOnce(item)
    const inv = useInventory()
    const result = await inv.fetchItem('1')
    expect(result.success).toBe(true)
    expect(result.data).toEqual(item)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory/1')
    expect(mockInventoryStore.setCurrentItem).toHaveBeenCalledWith(item)
  })

  it('should set loading state during fetch', async () => {
    mockAuthFetch.mockResolvedValueOnce(createItem('1'))
    const inv = useInventory()
    await inv.fetchItem('1')
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(true)
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(false)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Not found' } })
    const inv = useInventory()
    const result = await inv.fetchItem('999')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not found')
  })

  it('should set loading to false on error', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Error'))
    const inv = useInventory()
    await inv.fetchItem('1')
    expect(mockInventoryStore.setLoading).toHaveBeenLastCalledWith(false)
  })
})

describe('createItem', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should create item', async () => {
    const item = createItem('new-1', { name: 'Widget' })
    mockAuthFetch.mockResolvedValueOnce(item)
    const inv = useInventory()
    const result = await inv.createItem({ name: 'Widget' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual(item)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', { method: 'POST', body: { data: { name: 'Widget' } } })
    expect(mockInventoryStore.addItem).toHaveBeenCalledWith(item)
  })

  it('should set loading state during creation', async () => {
    mockAuthFetch.mockResolvedValueOnce(createItem('1'))
    const inv = useInventory()
    await inv.createItem({ name: 'Widget' })
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(true)
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(false)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Validation failed'))
    const inv = useInventory()
    const result = await inv.createItem({})
    expect(result.success).toBe(false)
    expect(result.error).toBe('Validation failed')
  })

  it('should handle API validation errors', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Name is required' } })
    const inv = useInventory()
    const result = await inv.createItem({})
    expect(result.success).toBe(false)
    expect(result.error).toBe('Name is required')
  })
})

describe('updateItem', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should update item', async () => {
    const item = createItem('1', { name: 'Updated' })
    mockAuthFetch.mockResolvedValueOnce(item)
    const inv = useInventory()
    const result = await inv.updateItem('1', { name: 'Updated' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual(item)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory/1', { method: 'PUT', body: { data: { name: 'Updated' } } })
    expect(mockInventoryStore.updateItem).toHaveBeenCalledWith(item)
  })

  it('should set loading state during update', async () => {
    mockAuthFetch.mockResolvedValueOnce(createItem('1'))
    const inv = useInventory()
    await inv.updateItem('1', { name: 'Updated' })
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(true)
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(false)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Update failed'))
    const inv = useInventory()
    const result = await inv.updateItem('1', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('Update failed')
  })

  it('should handle 404 error for non-existent item', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Item not found' }, statusCode: 404 })
    const inv = useInventory()
    const result = await inv.updateItem('999', { name: 'Updated' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Item not found')
  })
})

describe('deleteItem', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should delete item', async () => {
    mockAuthFetch.mockResolvedValueOnce(undefined)
    const inv = useInventory()
    const result = await inv.deleteItem('1')
    expect(result.success).toBe(true)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory/1', { method: 'DELETE' })
    expect(mockInventoryStore.removeItem).toHaveBeenCalledWith('1')
  })

  it('should set loading state during deletion', async () => {
    mockAuthFetch.mockResolvedValueOnce(undefined)
    const inv = useInventory()
    await inv.deleteItem('1')
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(true)
    expect(mockInventoryStore.setLoading).toHaveBeenCalledWith(false)
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Delete failed'))
    const inv = useInventory()
    const result = await inv.deleteItem('1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Delete failed')
  })

  it('should handle permission error', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Not authorized' }, statusCode: 403 })
    const inv = useInventory()
    const result = await inv.deleteItem('1')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Not authorized')
  })
})

describe('clearCurrentItem', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should clear current item', () => {
    const inv = useInventory()
    inv.clearCurrentItem()
    expect(mockInventoryStore.setCurrentItem).toHaveBeenCalledWith(null)
  })
})

describe('setSearch', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should set search', () => {
    const inv = useInventory()
    inv.setSearch('widget')
    expect(mockInventoryStore.setSearch).toHaveBeenCalledWith('widget')
  })

  it('should handle empty search string', () => {
    const inv = useInventory()
    inv.setSearch('')
    expect(mockInventoryStore.setSearch).toHaveBeenCalledWith('')
  })
})

describe('computed state', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should expose items', () => {
    mockInventoryStore.items = [createItem('1'), createItem('2')]
    const inv = useInventory()
    expect(inv.items.value).toHaveLength(2)
  })

  it('should expose currentItem', () => {
    const item = createItem('1', { name: 'Widget' })
    mockInventoryStore.currentItem = item
    const inv = useInventory()
    expect(inv.currentItem.value).toEqual(item)
  })

  it('should expose pagination', () => {
    mockInventoryStore.pagination = createPagination({ total: 100, totalPages: 5 })
    const inv = useInventory()
    expect(inv.pagination.value.total).toBe(100)
    expect(inv.pagination.value.totalPages).toBe(5)
  })

  it('should expose isLoading', () => {
    mockInventoryStore.isLoading = true
    const inv = useInventory()
    expect(inv.isLoading.value).toBe(true)
  })

  it('should expose hasInitiallyLoaded', () => {
    mockInventoryStore.hasInitiallyLoaded = true
    const inv = useInventory()
    expect(inv.hasInitiallyLoaded.value).toBe(true)
  })

  it('should expose lowStockItems', () => {
    mockInventoryStore.lowStockItems = [createItem('1', { quantity: 2 })]
    const inv = useInventory()
    expect(inv.lowStockItems.value).toHaveLength(1)
  })

  it('should expose search', () => {
    mockInventoryStore.search = 'test search'
    const inv = useInventory()
    expect(inv.search.value).toBe('test search')
  })

  it('should expose schema', () => {
    const cols: ColumnDefinition[] = [{ id: 'c1', name: 'Name', type: 'text', order: 0 }]
    mockInventoryStore.schema = cols
    const inv = useInventory()
    expect(inv.schema.value).toEqual(cols)
  })

  it('should expose hasSchema', () => {
    mockInventoryStore.hasSchema = true
    const inv = useInventory()
    expect(inv.hasSchema.value).toBe(true)
  })

  it('should expose sortedColumns', () => {
    const cols: ColumnDefinition[] = [{ id: 'c1', name: 'Name', type: 'text', order: 0 }]
    mockInventoryStore.sortedColumns = cols
    const inv = useInventory()
    expect(inv.sortedColumns.value).toEqual(cols)
  })
})

describe('edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should handle concurrent fetches', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({ items: [createItem('1')], pagination: createPagination() })
      .mockResolvedValueOnce({ items: [createItem('2')], pagination: createPagination() })
    const inv = useInventory()
    const [result1, result2] = await Promise.all([
      inv.fetchItems({ page: 1 }),
      inv.fetchItems({ page: 2 }),
    ])
    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
  })

  it('should handle empty items array', async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination({ total: 0, totalPages: 0 }) })
    const inv = useInventory()
    const result = await inv.fetchItems()
    expect(result.success).toBe(true)
    expect(result.data?.items).toHaveLength(0)
  })

  it('should handle special characters in search', async () => {
    mockAuthFetch.mockResolvedValueOnce({ items: [], pagination: createPagination() })
    const inv = useInventory()
    await inv.fetchItems({ search: 'widget & gadget' })
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', {
      query: expect.objectContaining({ search: 'widget & gadget' }),
    })
  })

  it('should handle unicode in item data', async () => {
    const unicodeData = { name: '\u65E5\u672C\u8A9E' }
    mockAuthFetch.mockResolvedValueOnce(createItem('1', unicodeData))
    const inv = useInventory()
    const result = await inv.createItem(unicodeData)
    expect(result.success).toBe(true)
  })

  it('should recover after failed fetch', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))
    const inv = useInventory()
    const failedResult = await inv.fetchItems()
    expect(failedResult.success).toBe(false)

    mockAuthFetch.mockResolvedValueOnce({ items: [createItem('1')], pagination: createPagination() })
    const successResult = await inv.fetchItems()
    expect(successResult.success).toBe(true)
  })
})
