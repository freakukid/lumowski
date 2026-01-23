import { z } from 'zod'
import type { ColumnDefinition, SearchFilterMode, SearchFilterPreference } from '~/types/schema'

const STORAGE_KEY = 'inventory-search-filter-preference'

// Zod schema for runtime validation of localStorage data
const SearchFilterPreferenceSchema = z.object({
  mode: z.enum(['all', 'include', 'exclude']),
  columnIds: z.array(z.string()).default([]),
})

export const useSearchFilter = () => {
  const filterPreference = ref<SearchFilterPreference>({
    mode: 'all',
    columnIds: [],
  })

  /**
   * Check if filter is active (not in 'all' mode or has selected columns)
   */
  const isFilterActive = computed(() => {
    return filterPreference.value.mode !== 'all' && filterPreference.value.columnIds.length > 0
  })

  /**
   * Initialize filter preference from localStorage
   * Validates stored data with Zod schema and columnIds against current schema
   */
  const initFilter = (columns: ColumnDefinition[]) => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const rawParsed = JSON.parse(stored)
        // Validate with Zod schema for type safety
        const parseResult = SearchFilterPreferenceSchema.safeParse(rawParsed)
        if (parseResult.success) {
          const parsed = parseResult.data
          // Use Set for O(1) column ID lookups instead of O(n) array.some()
          const columnIdSet = new Set(columns.map((c) => c.id))
          const validColumnIds = parsed.columnIds.filter((id) =>
            columnIdSet.has(id)
          )
          filterPreference.value = {
            mode: parsed.mode,
            columnIds: validColumnIds,
          }
          // Save back if we removed invalid columns
          if (validColumnIds.length !== parsed.columnIds.length) {
            saveToStorage()
          }
          return
        }
        // Invalid schema shape, fall through to default
      } catch {
        // Invalid JSON, fall through to default
      }
    }

    // Default: search all columns
    filterPreference.value = {
      mode: 'all',
      columnIds: [],
    }
  }

  /**
   * Save current preference to localStorage
   */
  const saveToStorage = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filterPreference.value))
  }

  /**
   * Set the filter mode and optionally selected columns
   */
  const setFilter = (mode: SearchFilterMode, columnIds?: string[]) => {
    filterPreference.value = {
      mode,
      columnIds: columnIds ?? filterPreference.value.columnIds,
    }
    saveToStorage()
  }

  /**
   * Toggle a column in the selection
   */
  const toggleColumn = (columnId: string) => {
    const currentIds = filterPreference.value.columnIds
    const isSelected = currentIds.includes(columnId)

    filterPreference.value = {
      ...filterPreference.value,
      columnIds: isSelected
        ? currentIds.filter((id) => id !== columnId)
        : [...currentIds, columnId],
    }
    saveToStorage()
  }

  /**
   * Reset filter to default (all columns)
   */
  const resetFilter = () => {
    filterPreference.value = {
      mode: 'all',
      columnIds: [],
    }
    saveToStorage()
  }

  /**
   * Get the column IDs to search based on current filter preference
   * Returns null if searching all columns (no filter)
   */
  const getSearchColumnIds = (allTextColumns: ColumnDefinition[]): string[] | null => {
    const { mode, columnIds } = filterPreference.value

    if (mode === 'all' || columnIds.length === 0) {
      return null // Search all columns
    }

    // Use Sets for O(1) lookups instead of O(n) array.includes()
    const textColumnIdSet = new Set(allTextColumns.map((c) => c.id))
    const selectedIdSet = new Set(columnIds)

    if (mode === 'include') {
      // Only search selected columns that are text columns
      return columnIds.filter((id) => textColumnIdSet.has(id))
    }

    if (mode === 'exclude') {
      // Search all text columns except selected ones
      return Array.from(textColumnIdSet).filter((id) => !selectedIdSet.has(id))
    }

    return null
  }

  return {
    // State
    filterPreference: computed(() => filterPreference.value),
    isFilterActive,

    // Actions
    initFilter,
    setFilter,
    toggleColumn,
    resetFilter,
    getSearchColumnIds,
  }
}
