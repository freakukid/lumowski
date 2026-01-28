import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { ColumnDefinition, DynamicInventoryItem, Pagination } from '~/types/schema'

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
  schema: [] as ColumnDefinition[],
  items: [] as DynamicInventoryItem[],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } as Pagination,
  setSchema: vi.fn((cols: ColumnDefinition[]) => { mockInventoryStore.schema = cols }),
  setItems: vi.fn((items: DynamicInventoryItem[]) => { mockInventoryStore.items = items }),
  resetPagination: vi.fn(() => { mockInventoryStore.pagination = { page: 1, limit: 20, total: 0, totalPages: 0 } }),
}

vi.mock('~/stores/inventory', () => ({
  useInventoryStore: () => mockInventoryStore,
}))

import { useSchema } from '~/composables/useSchema'

function createColumn(id: string, name: string, type: ColumnDefinition['type'], order: number): ColumnDefinition {
  return { id, name, type, order }
}

function resetMockStore(): void {
  mockInventoryStore.schema = []
  mockInventoryStore.items = []
  mockInventoryStore.pagination = { page: 1, limit: 20, total: 0, totalPages: 0 }
}

describe('fetchSchema', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should fetch schema successfully', async () => {
    const columns = [createColumn('c1', 'Name', 'text', 0), createColumn('c2', 'Qty', 'number', 1)]
    mockAuthFetch.mockResolvedValueOnce({ columns })
    const schema = useSchema()
    const result = await schema.fetchSchema()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ columns })
    expect(mockInventoryStore.setSchema).toHaveBeenCalledWith(columns)
  })

  it('should handle empty columns', async () => {
    mockAuthFetch.mockResolvedValueOnce({ columns: [] })
    const schema = useSchema()
    const result = await schema.fetchSchema()
    expect(result.success).toBe(true)
    expect(mockInventoryStore.setSchema).toHaveBeenCalledWith([])
  })

  it('should handle null columns', async () => {
    mockAuthFetch.mockResolvedValueOnce({ columns: null })
    const schema = useSchema()
    const result = await schema.fetchSchema()
    expect(result.success).toBe(true)
    expect(mockInventoryStore.setSchema).toHaveBeenCalledWith([])
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))
    const schema = useSchema()
    const result = await schema.fetchSchema()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
    expect(schema.error.value).toBe('Network error')
  })

  it('should handle API error with data.message', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Custom error' } })
    const schema = useSchema()
    const result = await schema.fetchSchema()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Custom error')
  })
})

describe('fetchItemCount', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should fetch item count successfully', async () => {
    mockAuthFetch.mockResolvedValueOnce({ pagination: { total: 42 } })
    const schema = useSchema()
    const result = await schema.fetchItemCount()
    expect(result.success).toBe(true)
    expect(result.count).toBe(42)
    expect(schema.itemCount.value).toBe(42)
  })

  it('should call API with limit=1', async () => {
    mockAuthFetch.mockResolvedValueOnce({ pagination: { total: 10 } })
    const schema = useSchema()
    await schema.fetchItemCount()
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', { query: { limit: 1 } })
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))
    const schema = useSchema()
    const result = await schema.fetchItemCount()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('should handle zero count', async () => {
    mockAuthFetch.mockResolvedValueOnce({ pagination: { total: 0 } })
    const schema = useSchema()
    const result = await schema.fetchItemCount()
    expect(result.success).toBe(true)
    expect(result.count).toBe(0)
    expect(schema.itemCount.value).toBe(0)
  })
})

describe('updateSchema', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should update schema successfully', async () => {
    const columns = [createColumn('c1', 'Name', 'text', 0)]
    mockAuthFetch.mockResolvedValueOnce({ columns })
    const schema = useSchema()
    const result = await schema.updateSchema(columns)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ columns })
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/schema', { method: 'PUT', body: { columns } })
    expect(mockInventoryStore.setSchema).toHaveBeenCalledWith(columns)
  })

  it('should handle empty columns update', async () => {
    mockAuthFetch.mockResolvedValueOnce({ columns: [] })
    const schema = useSchema()
    const result = await schema.updateSchema([])
    expect(result.success).toBe(true)
    expect(mockInventoryStore.setSchema).toHaveBeenCalledWith([])
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Update failed'))
    const schema = useSchema()
    const result = await schema.updateSchema([])
    expect(result.success).toBe(false)
    expect(result.error).toBe('Update failed')
    expect(schema.error.value).toBe('Update failed')
  })

  it('should handle column with all properties', async () => {
    const columns: ColumnDefinition[] = [{
      id: 'c1',
      name: 'Category',
      type: 'select',
      role: 'name',
      options: ['A', 'B', 'C'],
      required: true,
      order: 0,
    }]
    mockAuthFetch.mockResolvedValueOnce({ columns })
    const schema = useSchema()
    const result = await schema.updateSchema(columns)
    expect(result.success).toBe(true)
  })
})

describe('resetInventory', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should reset inventory successfully', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      success: true,
      message: 'Reset complete',
      deletedItemsCount: 10,
      schemaDeleted: true,
      deletedLogsCount: 5,
      deletedOperationsCount: 2,
    })
    const schema = useSchema()
    const result = await schema.resetInventory()
    expect(result.success).toBe(true)
    expect(result.data?.deletedItemsCount).toBe(10)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/schema/reset', { method: 'POST' })
  })

  it('should clear local state after reset', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      success: true,
      message: 'Reset complete',
      deletedItemsCount: 10,
      schemaDeleted: true,
      deletedLogsCount: 5,
      deletedOperationsCount: 2,
    })
    const schema = useSchema()
    await schema.resetInventory()
    expect(mockInventoryStore.setSchema).toHaveBeenCalledWith([])
    expect(mockInventoryStore.setItems).toHaveBeenCalledWith([])
    expect(mockInventoryStore.resetPagination).toHaveBeenCalled()
  })

  it('should return error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Reset failed'))
    const schema = useSchema()
    const result = await schema.resetInventory()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Reset failed')
    expect(schema.error.value).toBe('Reset failed')
  })

  it('should handle permission error', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Only OWNER can reset' } })
    const schema = useSchema()
    const result = await schema.resetInventory()
    expect(result.success).toBe(false)
    expect(result.error).toBe('Only OWNER can reset')
  })
})

describe('computed state', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should expose schema from store', () => {
    const columns = [createColumn('c1', 'Name', 'text', 0)]
    mockInventoryStore.schema = columns
    const schema = useSchema()
    expect(schema.schema.value).toEqual(columns)
  })

  it('should expose columns (alias for schema)', () => {
    const columns = [createColumn('c1', 'Name', 'text', 0)]
    mockInventoryStore.schema = columns
    const schema = useSchema()
    expect(schema.columns.value).toEqual(columns)
  })

  it('should expose error', () => {
    const schema = useSchema()
    expect(schema.error.value).toBe(null)
  })

  it('should expose itemCount', () => {
    const schema = useSchema()
    expect(schema.itemCount.value).toBe(null)
  })
})

describe('edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockStore() })

  it('should handle schema with all column types', async () => {
    const columns: ColumnDefinition[] = [
      { id: 'c1', name: 'Name', type: 'text', order: 0 },
      { id: 'c2', name: 'Qty', type: 'number', order: 1 },
      { id: 'c3', name: 'Price', type: 'currency', order: 2 },
      { id: 'c4', name: 'Date', type: 'date', order: 3 },
      { id: 'c5', name: 'Status', type: 'select', options: ['A', 'B'], order: 4 },
    ]
    mockAuthFetch.mockResolvedValueOnce({ columns })
    const schema = useSchema()
    const result = await schema.updateSchema(columns)
    expect(result.success).toBe(true)
  })

  it('should handle schema with roles', async () => {
    const columns: ColumnDefinition[] = [
      { id: 'c1', name: 'Name', type: 'text', role: 'name', order: 0 },
      { id: 'c2', name: 'Qty', type: 'number', role: 'quantity', order: 1 },
      { id: 'c3', name: 'Min', type: 'number', role: 'minQuantity', order: 2 },
      { id: 'c4', name: 'Price', type: 'currency', role: 'price', order: 3 },
      { id: 'c5', name: 'Cost', type: 'currency', role: 'cost', order: 4 },
    ]
    mockAuthFetch.mockResolvedValueOnce({ columns })
    const schema = useSchema()
    const result = await schema.updateSchema(columns)
    expect(result.success).toBe(true)
  })

  it('should handle large item count', async () => {
    mockAuthFetch.mockResolvedValueOnce({ pagination: { total: 1000000 } })
    const schema = useSchema()
    const result = await schema.fetchItemCount()
    expect(result.success).toBe(true)
    expect(result.count).toBe(1000000)
  })

  it('should recover after failed fetch', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))
    const schema = useSchema()
    const failedResult = await schema.fetchSchema()
    expect(failedResult.success).toBe(false)

    mockAuthFetch.mockResolvedValueOnce({ columns: [] })
    const successResult = await schema.fetchSchema()
    expect(successResult.success).toBe(true)
    expect(schema.error.value).toBe(null)
  })

  it('should clear error on successful fetch after failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Error'))
    const schema = useSchema()
    await schema.fetchSchema()
    expect(schema.error.value).toBe('Error')

    mockAuthFetch.mockResolvedValueOnce({ columns: [] })
    await schema.fetchSchema()
    expect(schema.error.value).toBe(null)
  })
})
