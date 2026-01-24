import type { ColumnDefinition, SortDirection, SortPreference } from '~/types/schema'

const STORAGE_KEY = 'inventory-sort-preference'

export const useInventorySort = () => {
  const sortPreference = ref<SortPreference>({
    columnId: null,
    direction: 'asc',
  })

  /**
   * Initialize sort preference from localStorage or default to name column
   */
  const initSort = (columns: ColumnDefinition[]) => {
    // Try to load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SortPreference
        // Validate: either no sort (null is valid) or column ID exists in current schema
        if (parsed.columnId === null || columns.some((c) => c.id === parsed.columnId)) {
          sortPreference.value = parsed
          return
        }
      } catch {
        // Invalid JSON, fall through to default
      }
    }

    // Default: find name column and sort ascending
    const nameColumn = columns.find((c) => c.role === 'name')
    if (nameColumn) {
      sortPreference.value = {
        columnId: nameColumn.id,
        direction: 'asc',
      }
      saveToStorage()
    } else {
      // No name column - keep server order
      sortPreference.value = {
        columnId: null,
        direction: 'asc',
      }
    }
  }

  /**
   * Save current preference to localStorage
   */
  const saveToStorage = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortPreference.value))
  }

  /**
   * Set sort column and optionally direction
   * If same column clicked, toggle direction
   * If different column, set ascending
   */
  const setSort = (columnId: string | null, direction?: SortDirection) => {
    if (columnId === null) {
      // Reset to server order
      sortPreference.value = {
        columnId: null,
        direction: 'asc',
      }
    } else if (direction !== undefined) {
      // Explicit direction provided
      sortPreference.value = {
        columnId,
        direction,
      }
    } else if (sortPreference.value.columnId === columnId) {
      // Same column - toggle direction
      sortPreference.value = {
        columnId,
        direction: sortPreference.value.direction === 'asc' ? 'desc' : 'asc',
      }
    } else {
      // New column - default to ascending
      sortPreference.value = {
        columnId,
        direction: 'asc',
      }
    }
    saveToStorage()
  }

  /**
   * Toggle sort direction
   */
  const toggleDirection = () => {
    if (sortPreference.value.columnId !== null) {
      sortPreference.value = {
        ...sortPreference.value,
        direction: sortPreference.value.direction === 'asc' ? 'desc' : 'asc',
      }
      saveToStorage()
    }
  }

  return {
    // State
    sortPreference: computed(() => sortPreference.value),

    // Actions
    initSort,
    setSort,
    toggleDirection,
  }
}
