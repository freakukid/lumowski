import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { ColumnDefinition } from '~/types/schema'

/**
 * Tests for useInventorySort composable
 *
 * The composable provides:
 * - Sort state: sortPreference (columnId, direction)
 * - Sort actions: initSort, setSort, toggleDirection
 * - localStorage persistence with key 'inventory-sort-preference'
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get store() {
      return store
    },
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

// Import after mocks are set up
import { useInventorySort } from '~/composables/useInventorySort'

// ============================================================================
// Test Utilities
// ============================================================================

const STORAGE_KEY = 'inventory-sort-preference'

function createColumn(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id: 'col-1',
    name: 'Column 1',
    type: 'text',
    order: 0,
    ...overrides,
  }
}

// ============================================================================
// Tests: Initialization
// ============================================================================

describe('useInventorySort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('initialization', () => {
    it('should return sort composable with all expected properties', () => {
      const sort = useInventorySort()

      expect(sort).toHaveProperty('sortPreference')
      expect(sort).toHaveProperty('initSort')
      expect(sort).toHaveProperty('setSort')
      expect(sort).toHaveProperty('toggleDirection')
    })

    it('should start with default sort preference (null columnId, asc direction)', () => {
      const sort = useInventorySort()

      expect(sort.sortPreference.value).toEqual({
        columnId: null,
        direction: 'asc',
      })
    })
  })

  // ============================================================================
  // Tests: initSort
  // ============================================================================

  describe('initSort', () => {
    it('should load valid preference from localStorage', () => {
      const columns = [
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'qty', role: 'quantity' }),
      ]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ columnId: 'qty', direction: 'desc' })
      )

      const sort = useInventorySort()
      sort.initSort(columns)

      expect(sort.sortPreference.value).toEqual({
        columnId: 'qty',
        direction: 'desc',
      })
    })

    it('should accept null columnId from localStorage', () => {
      const columns = [createColumn({ id: 'name', role: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ columnId: null, direction: 'asc' })
      )

      const sort = useInventorySort()
      sort.initSort(columns)

      expect(sort.sortPreference.value.columnId).toBeNull()
    })

    it('should default to name column if no stored preference', () => {
      const columns = [
        createColumn({ id: 'name', name: 'Name', role: 'name' }),
        createColumn({ id: 'qty', name: 'Quantity', role: 'quantity' }),
      ]

      const sort = useInventorySort()
      sort.initSort(columns)

      expect(sort.sortPreference.value).toEqual({
        columnId: 'name',
        direction: 'asc',
      })
    })

    it('should default to null columnId if no name column exists', () => {
      const columns = [
        createColumn({ id: 'qty', name: 'Quantity', role: 'quantity' }),
        createColumn({ id: 'price', name: 'Price', role: 'price' }),
      ]

      const sort = useInventorySort()
      sort.initSort(columns)

      expect(sort.sortPreference.value).toEqual({
        columnId: null,
        direction: 'asc',
      })
    })

    it('should ignore stored columnId that does not exist in current schema', () => {
      const columns = [createColumn({ id: 'name', role: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ columnId: 'deleted-column', direction: 'asc' })
      )

      const sort = useInventorySort()
      sort.initSort(columns)

      // Should fall back to name column
      expect(sort.sortPreference.value.columnId).toBe('name')
    })

    it('should handle invalid JSON in localStorage', () => {
      const columns = [createColumn({ id: 'name', role: 'name' })]
      localStorageMock.setItem(STORAGE_KEY, 'invalid-json{{{')

      const sort = useInventorySort()
      sort.initSort(columns)

      // Should default to name column
      expect(sort.sortPreference.value.columnId).toBe('name')
    })

    it('should save to storage after setting default', () => {
      const columns = [createColumn({ id: 'name', role: 'name' })]

      const sort = useInventorySort()
      sort.initSort(columns)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ columnId: 'name', direction: 'asc' })
      )
    })

    it('should handle empty columns array', () => {
      const sort = useInventorySort()
      sort.initSort([])

      expect(sort.sortPreference.value).toEqual({
        columnId: null,
        direction: 'asc',
      })
    })
  })

  // ============================================================================
  // Tests: setSort
  // ============================================================================

  describe('setSort', () => {
    it('should set sort column with explicit direction', () => {
      const sort = useInventorySort()

      sort.setSort('qty', 'desc')

      expect(sort.sortPreference.value).toEqual({
        columnId: 'qty',
        direction: 'desc',
      })
    })

    it('should toggle direction when same column clicked without explicit direction', () => {
      const sort = useInventorySort()
      sort.setSort('name', 'asc')

      // Click same column again
      sort.setSort('name')

      expect(sort.sortPreference.value.direction).toBe('desc')
    })

    it('should set ascending when different column clicked', () => {
      const sort = useInventorySort()
      sort.setSort('name', 'desc')

      // Click different column
      sort.setSort('qty')

      expect(sort.sortPreference.value).toEqual({
        columnId: 'qty',
        direction: 'asc',
      })
    })

    it('should reset to server order when columnId is null', () => {
      const sort = useInventorySort()
      sort.setSort('name', 'desc')

      sort.setSort(null)

      expect(sort.sortPreference.value).toEqual({
        columnId: null,
        direction: 'asc',
      })
    })

    it('should save to localStorage after setting sort', () => {
      const sort = useInventorySort()

      sort.setSort('qty', 'desc')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ columnId: 'qty', direction: 'desc' })
      )
    })

    it('should toggle from desc to asc on same column', () => {
      const sort = useInventorySort()
      sort.setSort('name', 'desc')

      sort.setSort('name')

      expect(sort.sortPreference.value.direction).toBe('asc')
    })
  })

  // ============================================================================
  // Tests: toggleDirection
  // ============================================================================

  describe('toggleDirection', () => {
    it('should toggle from asc to desc', () => {
      const sort = useInventorySort()
      sort.setSort('name', 'asc')

      sort.toggleDirection()

      expect(sort.sortPreference.value.direction).toBe('desc')
    })

    it('should toggle from desc to asc', () => {
      const sort = useInventorySort()
      sort.setSort('name', 'desc')

      sort.toggleDirection()

      expect(sort.sortPreference.value.direction).toBe('asc')
    })

    it('should not toggle if columnId is null', () => {
      const sort = useInventorySort()
      sort.setSort(null)

      sort.toggleDirection()

      // Direction should remain unchanged
      expect(sort.sortPreference.value.direction).toBe('asc')
    })

    it('should save to localStorage after toggling', () => {
      const sort = useInventorySort()
      sort.setSort('name', 'asc')
      vi.clearAllMocks()

      sort.toggleDirection()

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ columnId: 'name', direction: 'desc' })
      )
    })
  })
})
