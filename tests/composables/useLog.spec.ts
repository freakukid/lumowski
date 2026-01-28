import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, readonly } from 'vue'
import type { InventoryLog, LogListResponse, ConflictCheckResponse, LogFilters } from '~/types/log'
import type { DynamicInventoryItem } from '~/types/schema'

vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)

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

import { useLog } from '~/composables/useLog'

function createLog(id: string, action: InventoryLog['action']): InventoryLog {
  return {
    id,
    action,
    itemId: 'item-1',
    itemName: 'Test Item',
    snapshot: { name: 'Test' },
    changes: null,
    schemaChanges: null,
    undoable: true,
    undoneAt: null,
    undoneById: null,
    createdAt: '2024-01-15T10:00:00Z',
    businessId: 'b1',
    userId: 'u1',
    user: { id: 'u1', name: 'Test User' },
  }
}

function createLogListResponse(logs: InventoryLog[], total: number = logs.length): LogListResponse {
  return {
    logs,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) },
  }
}

describe('fetchLogs', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should fetch logs successfully', async () => {
    const logs = [createLog('1', 'ITEM_CREATED'), createLog('2', 'ITEM_UPDATED')]
    const response = createLogListResponse(logs, 2)
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.fetchLogs()
    expect(result).toEqual(response)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/log', { query: { page: 1, limit: 20, action: undefined, userId: undefined, startDate: undefined, endDate: undefined, search: undefined } })
  })

  it('should pass filters to API', async () => {
    const response = createLogListResponse([])
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const filters: LogFilters = { action: 'ITEM_CREATED', userId: 'u1', startDate: '2024-01-01', endDate: '2024-01-31', search: 'widget' }
    await log.fetchLogs(filters)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/log', { query: { page: 1, limit: 20, action: 'ITEM_CREATED', userId: 'u1', startDate: '2024-01-01', endDate: '2024-01-31', search: 'widget' } })
  })

  it('should pass pagination params', async () => {
    const response = createLogListResponse([])
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    await log.fetchLogs({}, 3, 50)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/log', { query: expect.objectContaining({ page: 3, limit: 50 }) })
  })

  it('should set loading during fetch', async () => {
    mockAuthFetch.mockResolvedValueOnce(createLogListResponse([]))
    const log = useLog()
    const fetchPromise = log.fetchLogs()
    expect(log.loading.value).toBe(true)
    await fetchPromise
    expect(log.loading.value).toBe(false)
  })

  it('should return null and set error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))
    const log = useLog()
    const result = await log.fetchLogs()
    expect(result).toBe(null)
    expect(log.error.value).toBe('Network error')
  })

  it('should handle empty logs array', async () => {
    const response = createLogListResponse([], 0)
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.fetchLogs()
    expect(result?.logs).toHaveLength(0)
    expect(result?.pagination.total).toBe(0)
  })

  it('should clear error on successful fetch', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Error'))
    const log = useLog()
    await log.fetchLogs()
    expect(log.error.value).toBe('Error')

    mockAuthFetch.mockResolvedValueOnce(createLogListResponse([]))
    await log.fetchLogs()
    expect(log.error.value).toBe(null)
  })
})

describe('fetchLog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should fetch single log successfully', async () => {
    const logEntry = createLog('1', 'ITEM_CREATED')
    mockAuthFetch.mockResolvedValueOnce(logEntry)
    const log = useLog()
    const result = await log.fetchLog('1')
    expect(result).toEqual(logEntry)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/log/1')
  })

  it('should set loading during fetch', async () => {
    mockAuthFetch.mockResolvedValueOnce(createLog('1', 'ITEM_CREATED'))
    const log = useLog()
    const fetchPromise = log.fetchLog('1')
    expect(log.loading.value).toBe(true)
    await fetchPromise
    expect(log.loading.value).toBe(false)
  })

  it('should return null and set error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Not found'))
    const log = useLog()
    const result = await log.fetchLog('999')
    expect(result).toBe(null)
    expect(log.error.value).toBe('Not found')
  })

  it('should handle API error with data.message', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'Log entry not found' } })
    const log = useLog()
    const result = await log.fetchLog('999')
    expect(result).toBe(null)
    expect(log.error.value).toBe('Log entry not found')
  })

  it('should set loading to false on error', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Error'))
    const log = useLog()
    await log.fetchLog('1')
    expect(log.loading.value).toBe(false)
  })
})

describe('undoLog', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should undo log successfully', async () => {
    const item: DynamicInventoryItem = { id: 'item-1', data: { name: 'Restored' }, businessId: 'b1', createdById: 'u1', createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' }
    const response = { success: true, message: 'Undo successful', item }
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.undoLog('1')
    expect(result).toEqual(response)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/log/1/undo', { method: 'POST' })
  })

  it('should set loading during undo', async () => {
    mockAuthFetch.mockResolvedValueOnce({ success: true, message: 'Done' })
    const log = useLog()
    const undoPromise = log.undoLog('1')
    expect(log.loading.value).toBe(true)
    await undoPromise
    expect(log.loading.value).toBe(false)
  })

  it('should return null and set error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Undo failed'))
    const log = useLog()
    const result = await log.undoLog('1')
    expect(result).toBe(null)
    expect(log.error.value).toBe('Undo failed')
  })

  it('should handle not undoable error', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'This action cannot be undone' } })
    const log = useLog()
    const result = await log.undoLog('1')
    expect(result).toBe(null)
    expect(log.error.value).toBe('This action cannot be undone')
  })

  it('should handle already undone error', async () => {
    mockAuthFetch.mockRejectedValueOnce({ data: { message: 'This action has already been undone' } })
    const log = useLog()
    const result = await log.undoLog('1')
    expect(result).toBe(null)
    expect(log.error.value).toBe('This action has already been undone')
  })
})

describe('checkUndoConflicts', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should check conflicts successfully with no conflicts', async () => {
    const response: ConflictCheckResponse = { hasConflicts: false, conflicts: [], itemExists: true }
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.checkUndoConflicts('1')
    expect(result).toEqual(response)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/log/1/check-conflicts')
  })

  it('should return conflicts when present', async () => {
    const response: ConflictCheckResponse = {
      hasConflicts: true,
      conflicts: [{ fieldId: 'f1', fieldName: 'Name', currentValue: 'New', willBecomeValue: 'Old' }],
      itemExists: true,
    }
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.checkUndoConflicts('1')
    expect(result?.hasConflicts).toBe(true)
    expect(result?.conflicts).toHaveLength(1)
    expect(result?.conflicts[0].fieldName).toBe('Name')
  })

  it('should handle item not exists', async () => {
    const response: ConflictCheckResponse = { hasConflicts: false, conflicts: [], itemExists: false }
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.checkUndoConflicts('1')
    expect(result?.itemExists).toBe(false)
  })

  it('should set loading during check', async () => {
    mockAuthFetch.mockResolvedValueOnce({ hasConflicts: false, conflicts: [], itemExists: true })
    const log = useLog()
    const checkPromise = log.checkUndoConflicts('1')
    expect(log.loading.value).toBe(true)
    await checkPromise
    expect(log.loading.value).toBe(false)
  })

  it('should return null and set error on failure', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Check failed'))
    const log = useLog()
    const result = await log.checkUndoConflicts('1')
    expect(result).toBe(null)
    expect(log.error.value).toBe('Check failed')
  })

  it('should set loading to false on error', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Error'))
    const log = useLog()
    await log.checkUndoConflicts('1')
    expect(log.loading.value).toBe(false)
  })
})

describe('state', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should expose loading as readonly', () => {
    const log = useLog()
    expect(log.loading.value).toBe(false)
  })

  it('should expose error as readonly', () => {
    const log = useLog()
    expect(log.error.value).toBe(null)
  })
})

describe('edge cases', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('should handle all log action types', async () => {
    const actions: InventoryLog['action'][] = ['ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_DELETED', 'SCHEMA_UPDATED']
    for (const action of actions) {
      const response = createLogListResponse([createLog('1', action)])
      mockAuthFetch.mockResolvedValueOnce(response)
      const log = useLog()
      const result = await log.fetchLogs({ action })
      expect(result?.logs[0].action).toBe(action)
    }
  })

  it('should handle log with changes', async () => {
    const logEntry = createLog('1', 'ITEM_UPDATED')
    logEntry.changes = [{ field: 'f1', fieldName: 'Name', oldValue: 'Old', newValue: 'New' }]
    mockAuthFetch.mockResolvedValueOnce(logEntry)
    const log = useLog()
    const result = await log.fetchLog('1')
    expect(result?.changes).toHaveLength(1)
    expect(result?.changes?.[0].fieldName).toBe('Name')
  })

  it('should handle log with schema changes', async () => {
    const logEntry = createLog('1', 'SCHEMA_UPDATED')
    logEntry.schemaChanges = [{ type: 'added', columnId: 'c1', columnName: 'New Column' }]
    mockAuthFetch.mockResolvedValueOnce(logEntry)
    const log = useLog()
    const result = await log.fetchLog('1')
    expect(result?.schemaChanges).toHaveLength(1)
    expect(result?.schemaChanges?.[0].type).toBe('added')
  })

  it('should handle undone log entry', async () => {
    const logEntry = createLog('1', 'ITEM_CREATED')
    logEntry.undoable = false
    logEntry.undoneAt = '2024-01-16T10:00:00Z'
    logEntry.undoneById = 'u2'
    logEntry.undoneBy = { id: 'u2', name: 'Other User' }
    mockAuthFetch.mockResolvedValueOnce(logEntry)
    const log = useLog()
    const result = await log.fetchLog('1')
    expect(result?.undoable).toBe(false)
    expect(result?.undoneAt).toBe('2024-01-16T10:00:00Z')
    expect(result?.undoneBy?.name).toBe('Other User')
  })

  it('should handle multiple conflicts', async () => {
    const response: ConflictCheckResponse = {
      hasConflicts: true,
      conflicts: [
        { fieldId: 'f1', fieldName: 'Name', currentValue: 'New1', willBecomeValue: 'Old1' },
        { fieldId: 'f2', fieldName: 'Qty', currentValue: 10, willBecomeValue: 5 },
        { fieldId: 'f3', fieldName: 'Price', currentValue: 29.99, willBecomeValue: 19.99 },
      ],
      itemExists: true,
    }
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.checkUndoConflicts('1')
    expect(result?.conflicts).toHaveLength(3)
  })

  it('should recover after failed fetch', async () => {
    mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))
    const log = useLog()
    const failedResult = await log.fetchLogs()
    expect(failedResult).toBe(null)
    expect(log.error.value).toBe('Network error')

    mockAuthFetch.mockResolvedValueOnce(createLogListResponse([]))
    const successResult = await log.fetchLogs()
    expect(successResult).not.toBe(null)
    expect(log.error.value).toBe(null)
  })

  it('should handle large page numbers', async () => {
    const response = createLogListResponse([], 1000)
    response.pagination.page = 50
    response.pagination.totalPages = 50
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    const result = await log.fetchLogs({}, 50, 20)
    expect(result?.pagination.page).toBe(50)
    expect(result?.pagination.totalPages).toBe(50)
  })

  it('should handle date range filters', async () => {
    const response = createLogListResponse([])
    mockAuthFetch.mockResolvedValueOnce(response)
    const log = useLog()
    await log.fetchLogs({ startDate: '2024-01-01T00:00:00Z', endDate: '2024-12-31T23:59:59Z' })
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/log', {
      query: expect.objectContaining({ startDate: '2024-01-01T00:00:00Z', endDate: '2024-12-31T23:59:59Z' }),
    })
  })
})
