import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, readonly } from 'vue'

/**
 * Tests for useAsyncOperation composable
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('readonly', readonly)

// Mock extractApiError
vi.mock('~/composables/useApiError', () => ({
  extractApiError: vi.fn((error, fallback) => {
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>
      if (typeof err.data === 'object' && err.data !== null) {
        const data = err.data as Record<string, unknown>
        if (typeof data.message === 'string') return data.message
      }
      if (typeof err.message === 'string') return err.message
    }
    return fallback
  }),
}))

// Import after mocks are set up
import { useAsyncOperation, type AsyncResult } from '~/composables/useAsyncOperation'

// ============================================================================
// Tests: execute function
// ============================================================================

describe('execute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('successful operations', () => {
    it('should return success result with data on successful operation', async () => {
      const { execute } = useAsyncOperation()
      const mockData = { id: 1, name: 'Test' }

      const result = await execute(async () => mockData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockData)
      }
    })

    it('should return correct type for string data', async () => {
      const { execute } = useAsyncOperation()

      const result = await execute(async () => 'hello')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('hello')
      }
    })

    it('should return correct type for number data', async () => {
      const { execute } = useAsyncOperation()

      const result = await execute(async () => 42)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(42)
      }
    })

    it('should return correct type for array data', async () => {
      const { execute } = useAsyncOperation()

      const result = await execute(async () => [1, 2, 3])

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([1, 2, 3])
      }
    })

    it('should return correct type for null data', async () => {
      const { execute } = useAsyncOperation()

      const result = await execute(async () => null)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeNull()
      }
    })

    it('should return correct type for undefined data', async () => {
      const { execute } = useAsyncOperation()

      const result = await execute(async () => undefined)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBeUndefined()
      }
    })
  })

  describe('failed operations', () => {
    it('should return error result on thrown Error', async () => {
      const { execute } = useAsyncOperation('Default error')

      const result = await execute(async () => {
        throw new Error('Something went wrong')
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Something went wrong')
      }
    })

    it('should use default fallback message when error has no message', async () => {
      const { execute } = useAsyncOperation('Default error')

      const result = await execute(async () => {
        throw {}
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Default error')
      }
    })

    it('should use custom fallback message for specific operation', async () => {
      const { execute } = useAsyncOperation('Default error')

      const result = await execute(
        async () => {
          throw {}
        },
        'Custom error message'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Custom error message')
      }
    })

    it('should extract API error with nested data.message', async () => {
      const { execute } = useAsyncOperation()

      const result = await execute(async () => {
        throw { data: { message: 'API validation error' } }
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('API validation error')
      }
    })

    it('should handle rejected promises', async () => {
      const { execute } = useAsyncOperation('Default error')

      const result = await execute(() => Promise.reject(new Error('Rejected')))

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Rejected')
      }
    })
  })
})

// ============================================================================
// Tests: isLoading state
// ============================================================================

describe('isLoading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be false initially', () => {
    const { isLoading } = useAsyncOperation()

    expect(isLoading.value).toBe(false)
  })

  it('should be true during operation execution', async () => {
    const { execute, isLoading } = useAsyncOperation()
    let capturedLoadingState = false

    await execute(async () => {
      capturedLoadingState = isLoading.value
      return 'done'
    })

    expect(capturedLoadingState).toBe(true)
  })

  it('should be false after successful operation', async () => {
    const { execute, isLoading } = useAsyncOperation()

    await execute(async () => 'done')

    expect(isLoading.value).toBe(false)
  })

  it('should be false after failed operation', async () => {
    const { execute, isLoading } = useAsyncOperation()

    await execute(async () => {
      throw new Error('Failed')
    })

    expect(isLoading.value).toBe(false)
  })
})

// ============================================================================
// Tests: error state
// ============================================================================

describe('error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be null initially', () => {
    const { error } = useAsyncOperation()

    expect(error.value).toBeNull()
  })

  it('should be null after successful operation', async () => {
    const { execute, error } = useAsyncOperation()

    await execute(async () => 'done')

    expect(error.value).toBeNull()
  })

  it('should contain error message after failed operation', async () => {
    const { execute, error } = useAsyncOperation()

    await execute(async () => {
      throw new Error('Something failed')
    })

    expect(error.value).toBe('Something failed')
  })

  it('should be cleared on new execution', async () => {
    const { execute, error } = useAsyncOperation()

    await execute(async () => {
      throw new Error('First error')
    })
    expect(error.value).toBe('First error')

    await execute(async () => 'success')
    expect(error.value).toBeNull()
  })

  it('should be replaced by new error on subsequent failure', async () => {
    const { execute, error } = useAsyncOperation()

    await execute(async () => {
      throw new Error('First error')
    })
    expect(error.value).toBe('First error')

    await execute(async () => {
      throw new Error('Second error')
    })
    expect(error.value).toBe('Second error')
  })
})

// ============================================================================
// Tests: default fallback message
// ============================================================================

describe('default fallback message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use "Operation failed" as default fallback', async () => {
    const { execute } = useAsyncOperation()

    const result = await execute(async () => {
      throw {}
    })

    if (!result.success) {
      expect(result.error).toBe('Operation failed')
    }
  })

  it('should use custom default fallback', async () => {
    const { execute } = useAsyncOperation('Custom default')

    const result = await execute(async () => {
      throw {}
    })

    if (!result.success) {
      expect(result.error).toBe('Custom default')
    }
  })
})

// ============================================================================
// Tests: concurrent operations
// ============================================================================

describe('concurrent operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle multiple concurrent executions', async () => {
    const { execute, isLoading } = useAsyncOperation()

    const promise1 = execute(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return 'first'
    })

    const promise2 = execute(async () => {
      await new Promise((r) => setTimeout(r, 25))
      return 'second'
    })

    const [result1, result2] = await Promise.all([promise1, promise2])

    expect(result1.success).toBe(true)
    expect(result2.success).toBe(true)
    expect(isLoading.value).toBe(false)
  })

  it('should reflect last operation result in error state', async () => {
    const { execute, error } = useAsyncOperation()

    const promise1 = execute(async () => {
      await new Promise((r) => setTimeout(r, 50))
      throw new Error('First error')
    })

    const promise2 = execute(async () => {
      await new Promise((r) => setTimeout(r, 25))
      return 'success'
    })

    await Promise.all([promise1, promise2])

    expect(error.value).toBe('First error')
  })
})

// ============================================================================
// Tests: AsyncResult type
// ============================================================================

describe('AsyncResult type', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should be type-safe for success case', async () => {
    const { execute } = useAsyncOperation()

    const result: AsyncResult<{ id: number }> = await execute(async () => ({
      id: 1,
    }))

    if (result.success) {
      expect(result.data.id).toBe(1)
    }
  })

  it('should be type-safe for error case', async () => {
    const { execute } = useAsyncOperation()

    const result: AsyncResult<{ id: number }> = await execute(async () => {
      throw new Error('Failed')
    })

    if (!result.success) {
      expect(typeof result.error).toBe('string')
    }
  })
})

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle synchronous-like async operations', async () => {
    const { execute } = useAsyncOperation()

    const result = await execute(async () => 'instant')

    expect(result.success).toBe(true)
  })

  it('should handle very long running operations', async () => {
    const { execute, isLoading } = useAsyncOperation()

    const startTime = Date.now()
    const result = await execute(async () => {
      await new Promise((r) => setTimeout(r, 100))
      return 'done'
    })
    const endTime = Date.now()

    expect(result.success).toBe(true)
    expect(endTime - startTime).toBeGreaterThanOrEqual(100)
    expect(isLoading.value).toBe(false)
  })

  it('should handle operation that throws non-Error object', async () => {
    const { execute } = useAsyncOperation('Fallback')

    const result = await execute(async () => {
      throw 'string error'
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Fallback')
    }
  })

  it('should handle operation that throws null', async () => {
    const { execute } = useAsyncOperation('Fallback')

    const result = await execute(async () => {
      throw null
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Fallback')
    }
  })

  it('should handle operation that throws undefined', async () => {
    const { execute } = useAsyncOperation('Fallback')

    const result = await execute(async () => {
      throw undefined
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('Fallback')
    }
  })
})
