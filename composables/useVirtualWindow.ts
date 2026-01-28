import type { ComputedRef, Ref } from 'vue'
import { nextTick } from 'vue'
import type { Pagination } from '~/types/schema'

// ============================================================================
// Types
// ============================================================================

export type VirtualWindowLoadingState = 'idle' | 'loading-up' | 'loading-down' | 'searching'

export interface VirtualWindowState {
  loadingState: VirtualWindowLoadingState
  currentPage: number
  totalPages: number
  total: number
  hasMoreUp: boolean
  hasMoreDown: boolean
  searchQuery: string
  /** Error message if fetch failed, null otherwise */
  error: string | null
}

export interface VirtualWindowOptions<T> {
  /**
   * Maximum number of items to keep in memory.
   * When exceeded, pages from the opposite direction are pruned.
   * @default 100
   */
  maxItems?: number

  /**
   * Number of items to fetch per page.
   * @default 20
   */
  pageSize?: number

  /**
   * Distance in pixels from the edge to trigger loading more items.
   * @default 200
   */
  scrollThreshold?: number

  /**
   * Estimated height of each item in pixels for spacer calculations.
   * @default 64
   */
  estimatedItemHeight?: number

  /**
   * Function to extract a unique key from an item.
   * @default item.id
   */
  getItemKey?: (item: T) => string

  /**
   * Function to fetch items from the server.
   */
  fetchFn: (params: { page: number; limit: number; search?: string }) => Promise<{
    items: T[]
    pagination: Pagination
  }>

  /**
   * Debounce delay for search input in milliseconds.
   * @default 300
   */
  searchDebounce?: number

  /**
   * Optional callback called when items are fetched.
   * Useful for syncing with external stores.
   */
  onItemsFetched?: (items: T[]) => void
}

export interface VirtualWindowReturn<T> {
  /** Computed list of items in display order */
  items: ComputedRef<T[]>

  /** Current state of the virtual window */
  state: Ref<VirtualWindowState>

  /** Whether any loading operation is in progress */
  isLoading: ComputedRef<boolean>

  /** Whether the item list is empty (after initial load) */
  isEmpty: ComputedRef<boolean>

  /** Ref to bind to the scroll container element */
  scrollContainerRef: Ref<HTMLElement | null>

  /** Height of the top spacer in pixels */
  topSpacerHeight: ComputedRef<number>

  /** Height of the bottom spacer in pixels */
  bottomSpacerHeight: ComputedRef<number>

  /** Set the search query (debounced) */
  setSearch: (query: string) => void

  /** Refresh the list (resets to page 1) */
  refresh: () => Promise<void>

  /** Manually load more items in the specified direction */
  loadMore: (direction: 'up' | 'down') => Promise<void>

  /** Reset the virtual window state */
  reset: () => void
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Simple debounce implementation since VueUse is not installed.
 */
function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

// ============================================================================
// Composable
// ============================================================================

export function useVirtualWindow<T extends { id: string }>(
  options: VirtualWindowOptions<T>
): VirtualWindowReturn<T> {
  const {
    maxItems = 100,
    pageSize = 20,
    scrollThreshold = 200,
    estimatedItemHeight = 64,
    getItemKey = (item: T) => item.id,
    fetchFn,
    searchDebounce = 300,
    onItemsFetched,
  } = options

  // ─────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────

  /** Map of item key -> item for efficient lookup */
  const itemsMap = ref<Map<string, T>>(new Map())

  /** Map of page number -> array of item keys in that page */
  const pageItems = ref<Map<number, string[]>>(new Map())

  /** Ordered list of loaded page numbers */
  const loadedPages = ref<number[]>([])

  /** Number of pages pruned from the top (for spacer calculation) */
  const prunedPagesTop = ref(0)

  /** Number of pages pruned from the bottom (for spacer calculation) */
  const prunedPagesBottom = ref(0)

  /** Reference to the scroll container element */
  const scrollContainerRef = ref<HTMLElement | null>(null)

  /** Current state of the virtual window */
  const state = ref<VirtualWindowState>({
    loadingState: 'idle',
    currentPage: 1,
    totalPages: 1,
    total: 0,
    hasMoreUp: false,
    hasMoreDown: false,
    searchQuery: '',
    error: null,
  })

  /** Flag to track if initial load has completed */
  const hasInitiallyLoaded = ref(false)

  /** Pending search query (before debounce executes) */
  const pendingSearchQuery = ref('')

  // ─────────────────────────────────────────────────────────────────────────
  // Computed Properties
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Ordered array of items based on loaded pages.
   * Uses a Set to track seen keys and prevent duplicates in the output.
   */
  const items = computed<T[]>(() => {
    const result: T[] = []
    const seenKeys = new Set<string>()
    const sortedPages = [...loadedPages.value].sort((a, b) => a - b)

    for (const pageNum of sortedPages) {
      const keys = pageItems.value.get(pageNum)
      if (keys) {
        for (const key of keys) {
          // Skip if we've already added this item (prevents duplicates)
          if (seenKeys.has(key)) {
            continue
          }
          const item = itemsMap.value.get(key)
          if (item) {
            seenKeys.add(key)
            // Type assertion needed due to Vue's ref unwrapping
            result.push(item as T)
          }
        }
      }
    }

    return result
  })

  /**
   * Whether any loading operation is in progress.
   */
  const isLoading = computed(() => state.value.loadingState !== 'idle')

  /**
   * Whether the list is empty after initial load.
   */
  const isEmpty = computed(() => hasInitiallyLoaded.value && items.value.length === 0)

  /**
   * Height of the top spacer in pixels.
   * Only accounts for pages that were PRUNED from the top, not pages that
   * haven't been loaded yet. This ensures scroll position is preserved when
   * pages are pruned without pre-allocating empty space.
   */
  const topSpacerHeight = computed(() => {
    if (!hasInitiallyLoaded.value) return 0

    // Only account for pages that were PRUNED from the top
    const prunedAbove = prunedPagesTop.value

    return prunedAbove * pageSize * estimatedItemHeight
  })

  /**
   * Height of the bottom spacer in pixels.
   * Only accounts for pages that were PRUNED from the bottom, not pages that
   * haven't been loaded yet. This ensures:
   * - The scroll container is only as tall as loaded content + pruned content
   * - When user scrolls to the actual bottom, more items load
   * - Scroll position is preserved when pages are pruned
   * - No massive pre-allocated empty space
   */
  const bottomSpacerHeight = computed(() => {
    if (!hasInitiallyLoaded.value) return 0

    // Only account for pages that were PRUNED from the bottom
    // NOT pages that haven't been loaded yet
    const prunedBelow = prunedPagesBottom.value

    return prunedBelow * pageSize * estimatedItemHeight
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Core Functions
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fetches a specific page of items.
   * On error, sets error state and stops further loading attempts.
   */
  async function fetchPage(page: number): Promise<{
    items: T[]
    pagination: Pagination
  } | null> {
    try {
      const result = await fetchFn({
        page,
        limit: pageSize,
        search: state.value.searchQuery || undefined,
      })

      // Notify external consumers about fetched items (e.g., for store sync)
      if (onItemsFetched && result.items.length > 0) {
        onItemsFetched(result.items)
      }

      return result
    } catch (error) {
      console.error('Failed to fetch page:', error)
      // Set error state and stop further loading attempts to prevent infinite loop
      state.value.hasMoreUp = false
      state.value.hasMoreDown = false
      state.value.error = error instanceof Error ? error.message : 'Failed to fetch'
      return null
    }
  }

  /**
   * Stores fetched items in the map and tracks page membership.
   * Ensures no duplicate keys are stored within a page's key list.
   */
  function storePageItems(page: number, fetchedItems: T[]): void {
    const keys: string[] = []
    const seenInPage = new Set<string>()

    for (const item of fetchedItems) {
      const key = getItemKey(item)
      // Skip duplicate keys within the same page
      if (seenInPage.has(key)) {
        continue
      }
      seenInPage.add(key)
      // Use type assertion to handle Vue's ref type system
      ;(itemsMap.value as Map<string, T>).set(key, item)
      keys.push(key)
    }

    pageItems.value.set(page, keys)

    if (!loadedPages.value.includes(page)) {
      loadedPages.value.push(page)
      loadedPages.value.sort((a, b) => a - b)
    }
  }

  /**
   * Prunes pages from the opposite end when maxItems is exceeded.
   */
  function pruneIfNeeded(direction: 'up' | 'down'): void {
    const totalItems = items.value.length

    if (totalItems <= maxItems) return

    const pagesToPrune = Math.ceil((totalItems - maxItems) / pageSize)
    const sortedPages = [...loadedPages.value].sort((a, b) => a - b)

    if (direction === 'down') {
      // Loading down, prune from top
      const pagesToRemove = sortedPages.slice(0, pagesToPrune)
      for (const page of pagesToRemove) {
        removePage(page)
        prunedPagesTop.value++
      }
    } else {
      // Loading up, prune from bottom
      const pagesToRemove = sortedPages.slice(-pagesToPrune)
      for (const page of pagesToRemove) {
        removePage(page)
        prunedPagesBottom.value++
      }
    }

    // Update hasMoreUp/hasMoreDown to reflect the new state after pruning
    // This ensures the scroll handler knows there are pages to load
    const newSortedPages = [...loadedPages.value].sort((a, b) => a - b)
    const lowestPage = newSortedPages[0] ?? 1
    const highestPage = newSortedPages[newSortedPages.length - 1] ?? 1
    state.value.hasMoreUp = lowestPage > 1
    state.value.hasMoreDown = highestPage < state.value.totalPages
  }

  /**
   * Removes a page and its items from the maps.
   */
  function removePage(page: number): void {
    const keys = pageItems.value.get(page)
    if (keys) {
      for (const key of keys) {
        // Only remove if no other page references this item
        let referencedElsewhere = false
        for (const [p, pageKeys] of pageItems.value) {
          if (p !== page && pageKeys.includes(key)) {
            referencedElsewhere = true
            break
          }
        }
        if (!referencedElsewhere) {
          itemsMap.value.delete(key)
        }
      }
    }

    pageItems.value.delete(page)
    loadedPages.value = loadedPages.value.filter((p) => p !== page)
  }

  /**
   * Updates the state with pagination info from the server.
   */
  function updatePaginationState(pagination: Pagination): void {
    state.value.totalPages = pagination.totalPages
    state.value.total = pagination.total

    const sortedPages = [...loadedPages.value].sort((a, b) => a - b)
    const lowestPage = sortedPages[0] ?? 1
    const highestPage = sortedPages[sortedPages.length - 1] ?? 1

    state.value.hasMoreUp = lowestPage > 1
    state.value.hasMoreDown = highestPage < pagination.totalPages
  }

  /**
   * Loads more items in the specified direction.
   */
  async function loadMore(direction: 'up' | 'down'): Promise<void> {
    // Don't retry if there's an error - prevents infinite loop
    if (state.value.error) {
      return
    }

    const sortedPages = [...loadedPages.value].sort((a, b) => a - b)
    const lowestPage = sortedPages[0] ?? 1
    const highestPage = sortedPages[sortedPages.length - 1] ?? 1

    // Prevent concurrent loads
    if (isLoading.value) {
      return
    }

    let targetPage: number

    if (direction === 'up') {
      targetPage = lowestPage - 1
      if (targetPage < 1) {
        return
      }

      state.value.loadingState = 'loading-up'
    } else {
      targetPage = highestPage + 1
      if (targetPage > state.value.totalPages) {
        return
      }

      state.value.loadingState = 'loading-down'
    }

    // Guard: Skip if page is already loaded (prevents duplicate loading)
    if (loadedPages.value.includes(targetPage)) {
      state.value.loadingState = 'idle'
      return
    }

    const result = await fetchPage(targetPage)

    if (result) {
      const prunedTopBefore = prunedPagesTop.value
      const prunedBottomBefore = prunedPagesBottom.value

      storePageItems(targetPage, result.items)
      updatePaginationState(result.pagination)
      pruneIfNeeded(direction)

      // Adjust pruned counters when loading previously pruned pages.
      // This is done AFTER pruneIfNeeded to correctly track the net change.
      // When loading up, we're restoring a page that was pruned from top.
      // When loading down, we're restoring a page that was pruned from bottom.
      if (direction === 'up' && prunedTopBefore > 0) {
        prunedPagesTop.value = Math.max(0, prunedPagesTop.value - 1)
      } else if (direction === 'down' && prunedBottomBefore > 0) {
        prunedPagesBottom.value = Math.max(0, prunedPagesBottom.value - 1)
      }
    }

    state.value.loadingState = 'idle'
  }

  /**
   * Checks if the scroll container needs more items to fill the viewport.
   * If there's no scrollbar but more items exist, automatically loads them.
   * This solves the classic infinite scroll problem where the initial load
   * doesn't fill the viewport, leaving the user unable to scroll to trigger more.
   */
  async function checkAndFillViewport(): Promise<void> {
    const container = scrollContainerRef.value
    if (!container) return

    // Stop if there's an error - prevents infinite loop
    if (state.value.error) return

    // Keep loading until we have a scrollbar or no more items
    while (state.value.hasMoreDown && !isLoading.value && !state.value.error) {
      // Check if the container has a scrollbar (content overflows)
      const hasScrollbar = container.scrollHeight > container.clientHeight

      if (hasScrollbar) {
        // Container has a scrollbar, user can scroll to trigger more loading
        break
      }

      // No scrollbar but more items exist - load the next page
      await loadMore('down')

      // Wait for DOM update before checking again
      await nextTick()
    }
  }

  /**
   * Refreshes the list, resetting to page 1.
   */
  async function refresh(): Promise<void> {
    state.value.loadingState = 'searching'
    // Clear error when starting fresh search
    state.value.error = null

    // Clear existing data
    itemsMap.value.clear()
    pageItems.value.clear()
    loadedPages.value = []
    prunedPagesTop.value = 0
    prunedPagesBottom.value = 0

    const result = await fetchPage(1)

    if (result) {
      storePageItems(1, result.items)
      updatePaginationState(result.pagination)
      state.value.currentPage = 1
    }

    hasInitiallyLoaded.value = true
    state.value.loadingState = 'idle'

    // After initial load, check if we need to load more items to fill the viewport.
    // Use nextTick to ensure DOM is updated before checking scroll dimensions.
    await nextTick()
    await checkAndFillViewport()
  }

  /**
   * Resets the virtual window state completely.
   */
  function reset(): void {
    itemsMap.value.clear()
    pageItems.value.clear()
    loadedPages.value = []
    prunedPagesTop.value = 0
    prunedPagesBottom.value = 0
    hasInitiallyLoaded.value = false
    state.value = {
      loadingState: 'idle',
      currentPage: 1,
      totalPages: 1,
      total: 0,
      hasMoreUp: false,
      hasMoreDown: false,
      searchQuery: '',
      error: null,
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Search Handling
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Executes the search with the current pending query.
   */
  async function executeSearch(): Promise<void> {
    const query = pendingSearchQuery.value
    if (query === state.value.searchQuery) return

    // Clear error when starting new search (refresh will also clear it, but this
    // ensures the error is cleared even before the async refresh completes)
    state.value.error = null
    state.value.searchQuery = query
    await refresh()
  }

  const debouncedSearch = debounce(executeSearch, searchDebounce)

  /**
   * Sets the search query with debouncing.
   */
  function setSearch(query: string): void {
    pendingSearchQuery.value = query
    debouncedSearch()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scroll Handling
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Handles scroll events to trigger loading more items.
   */
  function handleScroll(event: Event): void {
    const container = event.target as HTMLElement
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    // Determine if we can load more in each direction:
    // - hasMoreUp: there are pages on the server above the current window (lowestPage > 1)
    // - prunedPagesTop > 0: pages were pruned and need to be reloaded
    // - hasMoreDown: there are pages on the server below the current window
    // - prunedPagesBottom > 0: pages were pruned and need to be reloaded
    const canLoadUp = state.value.hasMoreUp || prunedPagesTop.value > 0
    const canLoadDown = state.value.hasMoreDown || prunedPagesBottom.value > 0

    // Calculate distance from the top of actual content (after the top spacer).
    // This ensures loading triggers when approaching the spacer, not after scrolling
    // through all the empty space.
    const currentTopSpacer = topSpacerHeight.value
    const currentBottomSpacer = bottomSpacerHeight.value
    const distanceFromContentTop = scrollTop - currentTopSpacer

    // Calculate distance from the bottom of actual content (before the bottom spacer).
    // This ensures loading triggers when approaching the bottom spacer (empty space),
    // not when reaching the absolute bottom of the container.
    // The bottom spacer represents pruned pages that need to be reloaded.
    const distanceFromContentBottom = distanceFromBottom - currentBottomSpacer

    // Check if near top of loaded content - load if there are server pages OR pruned pages above.
    // Trigger when user is within scrollThreshold of the top spacer (where content begins),
    // not when scrollTop itself is near 0. This prevents the user from having to scroll
    // through the entire empty spacer area before triggering the load.
    if (distanceFromContentTop < scrollThreshold && canLoadUp && !isLoading.value) {
      loadMore('up')
    }

    // Check if near bottom of loaded content - load if there are server pages OR pruned pages below.
    // Use distanceFromContentBottom to trigger when approaching the bottom spacer (pruned pages),
    // not when reaching the absolute bottom. This fixes the bug where scrolling down after
    // pages were pruned from bottom would show empty space instead of triggering a reload.
    if (distanceFromContentBottom < scrollThreshold && canLoadDown && !isLoading.value) {
      loadMore('down')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sets up scroll listener when container ref changes.
   * Using immediate: true ensures the listener is attached if the ref
   * is already set when the composable is initialized.
   * Also checks if we need to load more items to fill the viewport.
   */
  watch(scrollContainerRef, async (newEl, oldEl) => {
    if (oldEl) {
      oldEl.removeEventListener('scroll', handleScroll)
    }
    if (newEl) {
      newEl.addEventListener('scroll', handleScroll, { passive: true })

      // When the container is set and we've already loaded initial data,
      // check if we need to load more items to fill the viewport.
      // This handles the case where refresh() was called before the container was mounted.
      if (hasInitiallyLoaded.value) {
        await nextTick()
        await checkAndFillViewport()
      }
    }
  }, { immediate: true })

  /**
   * Cleanup on unmount.
   */
  onUnmounted(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.removeEventListener('scroll', handleScroll)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Return
  // ─────────────────────────────────────────────────────────────────────────

  return {
    items,
    state,
    isLoading,
    isEmpty,
    scrollContainerRef,
    topSpacerHeight,
    bottomSpacerHeight,
    setSearch,
    refresh,
    loadMore,
    reset,
  }
}
