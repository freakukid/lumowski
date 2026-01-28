import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { ColumnDefinition } from '~/types/schema'

/**
 * Tests for useSearchFilter composable
 *
 * The composable provides:
 * - Filter state: filterPreference (mode, columnIds), isFilterActive
 * - Filter actions: initFilter, setFilter, toggleColumn, resetFilter, getSearchColumnIds
 * - localStorage persistence with key 'inventory-search-filter-preference'
 * - Zod validation for stored preferences
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
import { useSearchFilter } from '~/composables/useSearchFilter'

// ============================================================================
// Test Utilities
// ============================================================================

const STORAGE_KEY = 'inventory-search-filter-preference'

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

describe('useSearchFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('initialization', () => {
    it('should return filter composable with all expected properties', () => {
      const filter = useSearchFilter()

      expect(filter).toHaveProperty('filterPreference')
      expect(filter).toHaveProperty('isFilterActive')
      expect(filter).toHaveProperty('initFilter')
      expect(filter).toHaveProperty('setFilter')
      expect(filter).toHaveProperty('toggleColumn')
      expect(filter).toHaveProperty('resetFilter')
      expect(filter).toHaveProperty('getSearchColumnIds')
    })

    it('should start with default filter preference (all mode, empty columnIds)', () => {
      const filter = useSearchFilter()

      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })

    it('should start with isFilterActive as false', () => {
      const filter = useSearchFilter()

      expect(filter.isFilterActive.value).toBe(false)
    })
  })

  // ============================================================================
  // Tests: isFilterActive computed
  // ============================================================================

  describe('isFilterActive', () => {
    it('should be false when mode is all', () => {
      const filter = useSearchFilter()

      filter.setFilter('all', ['col-1'])

      expect(filter.isFilterActive.value).toBe(false)
    })

    it('should be false when mode is include but no columns selected', () => {
      const filter = useSearchFilter()

      filter.setFilter('include', [])

      expect(filter.isFilterActive.value).toBe(false)
    })

    it('should be false when mode is exclude but no columns selected', () => {
      const filter = useSearchFilter()

      filter.setFilter('exclude', [])

      expect(filter.isFilterActive.value).toBe(false)
    })

    it('should be true when mode is include with columns selected', () => {
      const filter = useSearchFilter()

      filter.setFilter('include', ['col-1'])

      expect(filter.isFilterActive.value).toBe(true)
    })

    it('should be true when mode is exclude with columns selected', () => {
      const filter = useSearchFilter()

      filter.setFilter('exclude', ['col-1', 'col-2'])

      expect(filter.isFilterActive.value).toBe(true)
    })
  })

  // ============================================================================
  // Tests: initFilter
  // ============================================================================

  describe('initFilter', () => {
    it('should load valid preference from localStorage', () => {
      const columns = [
        createColumn({ id: 'name' }),
        createColumn({ id: 'desc' }),
      ]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'include', columnIds: ['name'] })
      )

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value).toEqual({
        mode: 'include',
        columnIds: ['name'],
      })
    })

    it('should filter out invalid columnIds not in current schema', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'include', columnIds: ['name', 'deleted-column'] })
      )

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value.columnIds).toEqual(['name'])
    })

    it('should save to storage after filtering invalid columnIds', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'include', columnIds: ['name', 'deleted'] })
      )

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
        STORAGE_KEY,
        JSON.stringify({ mode: 'include', columnIds: ['name'] })
      )
    })

    it('should not save to storage if all columnIds are valid', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'include', columnIds: ['name'] })
      )
      vi.clearAllMocks()

      const filter = useSearchFilter()
      filter.initFilter(columns)

      // Should not call setItem since nothing was filtered out
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('should default to all mode on invalid JSON', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(STORAGE_KEY, 'not-valid-json{{{')

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })

    it('should default to all mode on invalid schema shape', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'invalid-mode', columnIds: 'not-an-array' })
      )

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })

    it('should handle empty columns array', () => {
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'include', columnIds: ['col-1'] })
      )

      const filter = useSearchFilter()
      filter.initFilter([])

      // All columnIds should be filtered out
      expect(filter.filterPreference.value.columnIds).toEqual([])
    })

    it('should handle no localStorage data', () => {
      const columns = [createColumn({ id: 'name' })]

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })

    it('should validate mode is one of all, include, exclude', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'unknown', columnIds: [] })
      )

      const filter = useSearchFilter()
      filter.initFilter(columns)

      // Invalid mode should fall back to default
      expect(filter.filterPreference.value.mode).toBe('all')
    })
  })

  // ============================================================================
  // Tests: setFilter
  // ============================================================================

  describe('setFilter', () => {
    it('should set mode and columnIds', () => {
      const filter = useSearchFilter()

      filter.setFilter('include', ['col-1', 'col-2'])

      expect(filter.filterPreference.value).toEqual({
        mode: 'include',
        columnIds: ['col-1', 'col-2'],
      })
    })

    it('should set only mode when columnIds not provided', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', ['existing-col'])

      filter.setFilter('exclude')

      expect(filter.filterPreference.value).toEqual({
        mode: 'exclude',
        columnIds: ['existing-col'], // Preserved
      })
    })

    it('should save to localStorage', () => {
      const filter = useSearchFilter()

      filter.setFilter('exclude', ['col-1'])

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ mode: 'exclude', columnIds: ['col-1'] })
      )
    })

    it('should handle empty columnIds array', () => {
      const filter = useSearchFilter()

      filter.setFilter('include', [])

      expect(filter.filterPreference.value.columnIds).toEqual([])
    })
  })

  // ============================================================================
  // Tests: toggleColumn
  // ============================================================================

  describe('toggleColumn', () => {
    it('should add column when not selected', () => {
      const filter = useSearchFilter()

      filter.toggleColumn('col-1')

      expect(filter.filterPreference.value.columnIds).toContain('col-1')
    })

    it('should remove column when already selected', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', ['col-1', 'col-2'])

      filter.toggleColumn('col-1')

      expect(filter.filterPreference.value.columnIds).not.toContain('col-1')
      expect(filter.filterPreference.value.columnIds).toContain('col-2')
    })

    it('should preserve mode when toggling', () => {
      const filter = useSearchFilter()
      filter.setFilter('exclude', [])

      filter.toggleColumn('col-1')

      expect(filter.filterPreference.value.mode).toBe('exclude')
    })

    it('should save to localStorage after toggling', () => {
      const filter = useSearchFilter()
      vi.clearAllMocks()

      filter.toggleColumn('col-1')

      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('should handle toggling multiple columns', () => {
      const filter = useSearchFilter()

      filter.toggleColumn('col-1')
      filter.toggleColumn('col-2')
      filter.toggleColumn('col-3')

      expect(filter.filterPreference.value.columnIds).toEqual(['col-1', 'col-2', 'col-3'])

      filter.toggleColumn('col-2')

      expect(filter.filterPreference.value.columnIds).toEqual(['col-1', 'col-3'])
    })
  })

  // ============================================================================
  // Tests: resetFilter
  // ============================================================================

  describe('resetFilter', () => {
    it('should reset to all mode with empty columnIds', () => {
      const filter = useSearchFilter()
      filter.setFilter('exclude', ['col-1', 'col-2'])

      filter.resetFilter()

      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })

    it('should save to localStorage after reset', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', ['col-1'])
      vi.clearAllMocks()

      filter.resetFilter()

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify({ mode: 'all', columnIds: [] })
      )
    })

    it('should set isFilterActive to false', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', ['col-1'])
      expect(filter.isFilterActive.value).toBe(true)

      filter.resetFilter()

      expect(filter.isFilterActive.value).toBe(false)
    })
  })

  // ============================================================================
  // Tests: getSearchColumnIds
  // ============================================================================

  describe('getSearchColumnIds', () => {
    it('should return null when mode is all', () => {
      const filter = useSearchFilter()
      filter.setFilter('all', ['col-1'])

      const textColumns = [
        createColumn({ id: 'col-1' }),
        createColumn({ id: 'col-2' }),
      ]

      const result = filter.getSearchColumnIds(textColumns)

      expect(result).toBeNull()
    })

    it('should return null when no columns selected', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', [])

      const textColumns = [createColumn({ id: 'col-1' })]

      const result = filter.getSearchColumnIds(textColumns)

      expect(result).toBeNull()
    })

    it('should return selected text columns for include mode', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', ['col-1', 'col-3'])

      const textColumns = [
        createColumn({ id: 'col-1' }),
        createColumn({ id: 'col-2' }),
        createColumn({ id: 'col-3' }),
      ]

      const result = filter.getSearchColumnIds(textColumns)

      expect(result).toEqual(['col-1', 'col-3'])
    })

    it('should filter out non-text columns in include mode', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', ['text-col', 'number-col'])

      const textColumns = [createColumn({ id: 'text-col' })]
      // number-col is not in textColumns, so it should be filtered

      const result = filter.getSearchColumnIds(textColumns)

      expect(result).toEqual(['text-col'])
    })

    it('should return all text columns except selected for exclude mode', () => {
      const filter = useSearchFilter()
      filter.setFilter('exclude', ['col-2'])

      const textColumns = [
        createColumn({ id: 'col-1' }),
        createColumn({ id: 'col-2' }),
        createColumn({ id: 'col-3' }),
      ]

      const result = filter.getSearchColumnIds(textColumns)

      expect(result).toEqual(['col-1', 'col-3'])
    })

    it('should return empty array when all text columns excluded', () => {
      const filter = useSearchFilter()
      filter.setFilter('exclude', ['col-1', 'col-2'])

      const textColumns = [
        createColumn({ id: 'col-1' }),
        createColumn({ id: 'col-2' }),
      ]

      const result = filter.getSearchColumnIds(textColumns)

      expect(result).toEqual([])
    })

    it('should handle empty textColumns array', () => {
      const filter = useSearchFilter()
      filter.setFilter('include', ['col-1'])

      const result = filter.getSearchColumnIds([])

      expect(result).toEqual([])
    })

    it('should handle exclude mode with non-existent columns', () => {
      const filter = useSearchFilter()
      filter.setFilter('exclude', ['nonexistent'])

      const textColumns = [
        createColumn({ id: 'col-1' }),
        createColumn({ id: 'col-2' }),
      ]

      const result = filter.getSearchColumnIds(textColumns)

      // nonexistent not in textColumns, so all text columns returned
      expect(result).toEqual(['col-1', 'col-2'])
    })
  })

  // ============================================================================
  // Tests: Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle rapid mode changes', () => {
      const filter = useSearchFilter()

      filter.setFilter('include', ['col-1'])
      filter.setFilter('exclude', ['col-2'])
      filter.setFilter('all', [])
      filter.setFilter('include', ['col-3'])

      expect(filter.filterPreference.value).toEqual({
        mode: 'include',
        columnIds: ['col-3'],
      })
    })

    it('should maintain separate instances', () => {
      const filter1 = useSearchFilter()
      const filter2 = useSearchFilter()

      filter1.setFilter('include', ['col-1'])

      // filter2 should have its own state
      expect(filter2.filterPreference.value.mode).toBe('all')
    })

    it('should handle columnIds with special characters', () => {
      const filter = useSearchFilter()

      filter.setFilter('include', ['col-with-dash', 'col_with_underscore', 'col.with.dots'])

      expect(filter.filterPreference.value.columnIds).toEqual([
        'col-with-dash',
        'col_with_underscore',
        'col.with.dots',
      ])
    })

    it('should handle duplicate columnIds in toggleColumn', () => {
      const filter = useSearchFilter()

      filter.toggleColumn('col-1')
      filter.toggleColumn('col-1')

      // Second toggle should remove it
      expect(filter.filterPreference.value.columnIds).toEqual([])
    })

    it('should handle very long columnIds list', () => {
      const filter = useSearchFilter()
      const manyColumns = Array.from({ length: 100 }, (_, i) => `col-${i}`)

      filter.setFilter('include', manyColumns)

      expect(filter.filterPreference.value.columnIds).toHaveLength(100)
    })
  })

  // ============================================================================
  // Tests: Zod Schema Validation
  // ============================================================================

  describe('Zod schema validation', () => {
    it('should reject non-object stored value', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(STORAGE_KEY, '"just-a-string"')

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })

    it('should reject array stored value', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(STORAGE_KEY, '["not", "an", "object"]')

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })

    it('should provide default empty array for missing columnIds', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify({ mode: 'all' }))

      const filter = useSearchFilter()
      filter.initFilter(columns)

      expect(filter.filterPreference.value.columnIds).toEqual([])
    })

    it('should reject non-string columnIds', () => {
      const columns = [createColumn({ id: 'name' })]
      localStorageMock.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: 'include', columnIds: [1, 2, 3] })
      )

      const filter = useSearchFilter()
      filter.initFilter(columns)

      // Should fail Zod validation and fall back to default
      expect(filter.filterPreference.value).toEqual({
        mode: 'all',
        columnIds: [],
      })
    })
  })
})
