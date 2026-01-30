<template>
  <div class="item-selector">
    <!-- Search Input (unified with barcode) -->
    <div class="search-wrapper" :class="searchWrapperClass">
      <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        ref="inputRef"
        type="search"
        :value="searchValue"
        :placeholder="placeholderText"
        class="search-input"
        :class="searchInputClass"
        :disabled="props.isBarcodeLoading"
        @input="handleSearchInput"
        @keydown.enter="handleEnterKey"
      />

      <!-- Loading spinner (when looking up barcode) -->
      <div v-if="props.isBarcodeLoading" class="input-loading">
        <UiSpinner size="sm" />
      </div>

      <!-- Camera button (mobile only, when barcode enabled, not loading) -->
      <button
        v-else-if="props.barcodeEnabled"
        type="button"
        class="camera-btn"
        aria-label="Scan barcode with camera"
        @click="emit('camera-click')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>

    <!-- Barcode Error message (below input) -->
    <Transition name="error-fade">
      <p v-if="props.barcodeError" class="barcode-error" role="alert">
        {{ props.barcodeError }}
      </p>
    </Transition>

    <!-- Items List -->
    <div
      ref="scrollContainerRef"
      class="items-list"
    >
      <!-- Top Spacer for virtual scrolling -->
      <div
        v-if="virtualWindow.topSpacerHeight.value > 0"
        :style="{ height: `${virtualWindow.topSpacerHeight.value}px` }"
        class="spacer"
      ></div>

      <!-- Loading indicator for loading more at top (only after initial load) -->
      <div
        v-if="hasLoadedOnce && virtualWindow.state.value.loadingState === 'loading-up'"
        class="loading-indicator"
      >
        <UiSpinner size="sm" />
        <span>Loading...</span>
      </div>

      <!-- Initial Loading State -->
      <div
        v-if="!hasLoadedOnce && virtualWindow.isLoading.value"
        class="loading-state"
      >
        <UiSpinner size="md" />
        <span>Loading items...</span>
      </div>

      <!-- Search Loading State - show while searching instead of "No items found" -->
      <div
        v-else-if="virtualWindow.isLoading.value && virtualWindow.isEmpty.value"
        class="loading-indicator"
      >
        <UiSpinner size="sm" />
        <span>Searching...</span>
      </div>

      <!-- Empty State - only show when NOT loading -->
      <div
        v-else-if="virtualWindow.isEmpty.value"
        class="no-items"
      >
        <p>{{ virtualWindow.state.value.searchQuery ? 'No items match your search' : 'No items available' }}</p>
      </div>

      <!-- Item Rows -->
      <template v-else>
        <div
          v-for="item in virtualWindow.items.value"
          :key="item.id"
          class="item-row"
          :class="{
            'item-row-selected': isSelected(item.id),
            'item-row-out-of-stock': isOutOfStock(item)
          }"
          :aria-disabled="isOutOfStock(item)"
          @click="handleItemClick(item)"
        >
          <!-- Checkbox -->
          <div class="item-checkbox">
            <div :class="['checkbox', { checked: isSelected(item.id) }]">
              <svg
                v-if="isSelected(item.id)"
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <!-- Item Info -->
          <div class="item-info">
            <span class="item-name">{{ getItemName(item) }}</span>
            <div class="item-details">
              <span class="item-quantity">
                Stock: {{ getItemQuantity(item) }}
              </span>
              <!-- Out of Stock badge (takes priority over Low Stock) -->
              <span
                v-if="isOutOfStock(item)"
                class="out-of-stock-badge"
                role="status"
                aria-label="Out of stock"
              >
                <svg
                  class="out-of-stock-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
                <span class="out-of-stock-text">Out of Stock</span>
              </span>
              <!-- Low Stock badge (only shown when item is not out of stock) -->
              <span
                v-else-if="checkLowStock(item)"
                class="low-stock-badge"
                role="status"
                aria-label="Low stock warning"
              >
                <svg
                  class="low-stock-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span class="low-stock-text">Low Stock</span>
              </span>
              <span class="item-price">
                {{ formatCurrency(getItemPrice(item)) }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- Loading indicator for loading more at bottom (only after initial load) -->
      <div
        v-if="hasLoadedOnce && virtualWindow.state.value.loadingState === 'loading-down'"
        class="loading-indicator"
      >
        <UiSpinner size="sm" />
        <span>Loading...</span>
      </div>

      <!-- Bottom Spacer for virtual scrolling -->
      <div
        v-if="virtualWindow.bottomSpacerHeight.value > 0"
        :style="{ height: `${virtualWindow.bottomSpacerHeight.value}px` }"
        class="spacer"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'
import { useVirtualWindow } from '~/composables/useVirtualWindow'
import { useAuthFetch } from '~/composables/useAuthFetch'
import { useInventoryStore } from '~/stores/inventory'

const props = defineProps<{
  /**
   * Array of selected item IDs
   */
  modelValue: string[]
  /**
   * Column definitions for displaying item info
   */
  columns: ColumnDefinition[]
  /**
   * Whether barcode functionality is enabled (barcode column exists)
   */
  barcodeEnabled?: boolean
  /**
   * Loading state for barcode lookup
   */
  isBarcodeLoading?: boolean
  /**
   * Error message for barcode lookup
   */
  barcodeError?: string
}>()

const emit = defineEmits<{
  /**
   * Emitted when selection changes
   */
  'update:modelValue': [value: string[]]
  /**
   * Emitted when Enter pressed on barcode-like input
   */
  'barcode-submit': [barcode: string]
  /**
   * Emitted when camera button clicked
   */
  'camera-click': []
  /**
   * Emitted when user starts typing (to clear barcode error)
   */
  'clear-barcode-error': []
}>()

const { authFetch } = useAuthFetch()
const inventoryStore = useInventoryStore()

// Find the name column for search filtering
const nameColumn = computed(() =>
  props.columns.find((col) => col.role === 'name')
)

// Find the barcode column for search filtering
const barcodeColumn = computed(() =>
  props.columns.find((col) => col.role === 'barcode')
)

// Build searchColumns to include both name and barcode columns
const searchColumns = computed(() => {
  const columns: string[] = []
  if (nameColumn.value) columns.push(nameColumn.value.id)
  if (barcodeColumn.value) columns.push(barcodeColumn.value.id)
  return columns.length > 0 ? columns.join(',') : undefined
})

// Track if we've loaded at least once (for initial loading state)
const hasLoadedOnce = ref(false)

// Input element ref for exposed methods
const inputRef = ref<HTMLInputElement | null>(null)

// Local search value for barcode detection
const searchValue = ref('')

// Animation states
const isSuccess = ref(false)
const isError = ref(false)

/**
 * Dynamic placeholder based on barcode functionality.
 */
const placeholderText = computed(() =>
  props.barcodeEnabled ? 'Search or scan barcode...' : 'Search items...'
)

/**
 * Classes for the search wrapper element.
 */
const searchWrapperClass = computed(() => ({
  'is-loading': props.isBarcodeLoading,
  'is-success': isSuccess.value,
  'is-error': isError.value,
}))

/**
 * Classes for the search input element.
 */
const searchInputClass = computed(() => ({
  'animate-success': isSuccess.value,
  'has-camera': props.barcodeEnabled && !props.isBarcodeLoading,
}))

// Initialize virtual window with inventory fetch function
const virtualWindow = useVirtualWindow<DynamicInventoryItem>({
  maxItems: 40,
  pageSize: 20,
  scrollThreshold: 200,
  estimatedItemHeight: 72, // Approximate height of each item row
  searchDebounce: 300,
  fetchFn: async (params) => {
    // Search both name and barcode columns for operations
    const response = await authFetch<{
      items: DynamicInventoryItem[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>('/api/inventory', {
      query: {
        page: params.page,
        limit: params.limit,
        search: params.search,
        searchColumns: searchColumns.value, // Name and barcode column IDs
      },
    })
    return response
  },
  // Sync fetched items to the global store so the receiving page can access them
  // for display in the selected items section (names, quantities, prices, etc.)
  onItemsFetched: (items) => {
    inventoryStore.mergeItems(items)
  },
})

// Bind the scroll container ref
const scrollContainerRef = virtualWindow.scrollContainerRef

// Use shared composables for item display, stock status, and currency formatting
const columnsRef = computed(() => props.columns)
const { getItemName, getItemQuantity, getItemPrice } = useItemDisplay(columnsRef)
const { checkLowStock } = useStockStatus(columnsRef)
const { formatCurrency } = useCurrency()

/**
 * Determines if the input looks like a barcode (no spaces, 4+ chars).
 * Used to decide whether to emit barcode-submit on Enter.
 */
function looksLikeBarcode(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length < 4) return false
  if (trimmed.includes(' ')) return false
  return true
}

/**
 * Handles search input changes.
 */
function handleSearchInput(event: Event): void {
  const target = event.target as HTMLInputElement
  searchValue.value = target.value
  virtualWindow.setSearch(target.value)

  // Clear barcode error when typing
  if (props.barcodeError) {
    emit('clear-barcode-error')
  }
}

/**
 * Handles Enter key press.
 * If barcode enabled and input looks like a barcode, emits barcode-submit.
 */
function handleEnterKey(): void {
  const value = searchValue.value.trim()
  if (!value) return

  // If barcode enabled and input looks like barcode, emit barcode-submit
  if (props.barcodeEnabled && looksLikeBarcode(value)) {
    emit('barcode-submit', value)
  }
  // Otherwise, input already filtered the list - no additional action needed
}

/**
 * Checks if an item is currently selected.
 */
function isSelected(itemId: string): boolean {
  return props.modelValue.includes(itemId)
}

/**
 * Toggles an item's selection state.
 */
function toggleItem(itemId: string): void {
  if (isSelected(itemId)) {
    emit('update:modelValue', props.modelValue.filter((id) => id !== itemId))
  } else {
    emit('update:modelValue', [...props.modelValue, itemId])
  }
}

/**
 * Checks if an item is out of stock (quantity = 0).
 */
function isOutOfStock(item: DynamicInventoryItem): boolean {
  return getItemQuantity(item) === 0
}

/**
 * Handles item click - toggles selection regardless of stock status.
 * Unlike cashier, operations (receiving) can select out-of-stock items.
 */
function handleItemClick(item: DynamicInventoryItem): void {
  toggleItem(item.id)
}

// Fetch initial items on mount
onMounted(async () => {
  await virtualWindow.refresh()
  hasLoadedOnce.value = true
})

// ─────────────────────────────────────────────────────────────────────────────
// Exposed Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Focus the input field programmatically.
 */
function focus(): void {
  inputRef.value?.focus()
}

/**
 * Clear the input value.
 */
function clear(): void {
  searchValue.value = ''
  virtualWindow.setSearch('')
}

/**
 * Trigger success animation and clear input.
 * Used after a successful barcode lookup.
 */
function showSuccess(): void {
  isSuccess.value = true
  clear()
  setTimeout(() => {
    isSuccess.value = false
  }, 600)
}

/**
 * Trigger error animation.
 * Used when a barcode lookup fails.
 */
function showError(): void {
  isError.value = true
  setTimeout(() => {
    isError.value = false
  }, 400)
}

defineExpose({ focus, clear, showSuccess, showError })
</script>

<style scoped>
.item-selector {
  @apply flex flex-col;
  min-width: 0;
  width: 100%;
  /* Use flex: 1 to fill parent flex container (more reliable than h-full) */
  flex: 1;
  /* Prevent shrinking below content minimum */
  min-height: 0;
}

.search-wrapper {
  @apply relative mb-4;
}

.search-icon {
  @apply absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5;
  color: rgb(var(--color-surface-400));
}

.search-input {
  @apply w-full pl-11 pr-4 min-h-[44px] rounded-xl text-sm font-medium transition-all outline-none;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.search-input::placeholder {
  color: rgb(var(--color-surface-400));
}

.search-input:focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.search-input:disabled {
  @apply cursor-wait opacity-70;
}

/* Camera button - mobile only */
.camera-btn {
  @apply absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center;
  @apply w-10 h-10 rounded-lg transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.camera-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

/* Hide camera button on desktop */
@media (min-width: 768px) {
  .camera-btn {
    @apply hidden;
  }
}

/* Adjust input padding when camera visible */
.search-input.has-camera {
  @apply pr-14;
}

@media (min-width: 768px) {
  .search-input.has-camera {
    @apply pr-4;
  }
}

/* Loading spinner position */
.input-loading {
  @apply absolute right-3.5 top-1/2 -translate-y-1/2;
  color: rgb(var(--color-primary-500));
}

/* Success animation */
@keyframes success-flash {
  0% { background: rgba(var(--color-success-500), 0.05); border-color: rgb(var(--color-success-500)); }
  50% { background: rgba(var(--color-success-500), 0.15); }
  100% { background: rgba(var(--color-surface-50), 0.8); border-color: rgba(var(--color-surface-300), 0.5); }
}

.search-input.animate-success {
  animation: success-flash 600ms ease-out;
}

/* Error shake - apply to wrapper */
@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.search-wrapper.is-error {
  animation: error-shake 400ms ease-out;
}

/* Error message */
.barcode-error {
  @apply text-sm mt-1.5;
  color: rgb(var(--color-error-500));
}

.error-fade-enter-active, .error-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.error-fade-enter-from, .error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .search-input.animate-success,
  .search-wrapper.is-error {
    animation: none;
  }
}

.items-list {
  @apply flex-1 overflow-y-auto -mx-1 px-1;
  /* Mobile: cap height to prevent taking over the screen */
  max-height: 300px;
  /* Required for flex item with overflow to shrink properly */
  min-height: 0;
}

/* Desktop: remove max-height so flex-1 fills remaining space in parent */
@media (min-width: 768px) {
  .items-list {
    max-height: none;
  }
}

.spacer {
  @apply w-full flex-shrink-0;
}

.loading-indicator {
  @apply flex items-center justify-center gap-2 py-3 text-sm;
  color: rgb(var(--color-surface-500));
}

.loading-state {
  @apply flex flex-col items-center justify-center gap-3 py-8 text-sm;
  color: rgb(var(--color-surface-400));
}

.no-items {
  @apply py-8 text-center text-sm;
  color: rgb(var(--color-surface-400));
}

.item-row {
  @apply flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-2;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid transparent;
}

.item-row:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.item-row-selected {
  background: rgba(var(--color-primary-500), 0.08);
  border-color: rgba(var(--color-primary-500), 0.3);
}

.item-row-selected:hover {
  background: rgba(var(--color-primary-500), 0.12);
}

.item-checkbox {
  @apply flex-shrink-0;
}

.checkbox {
  @apply w-5 h-5 rounded flex items-center justify-center transition-all;
  background: rgba(var(--color-surface-200), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.8);
}

.checkbox.checked {
  background: rgb(var(--color-primary-500));
  border-color: rgb(var(--color-primary-500));
  color: white;
}

.item-info {
  @apply flex-1 min-w-0;
}

.item-name {
  @apply block font-medium truncate;
  color: rgb(var(--color-surface-900));
}

.item-details {
  @apply flex items-center gap-3 mt-0.5;
  flex-wrap: wrap;
  min-width: 0;
}

.item-quantity {
  @apply text-xs flex-shrink-0;
  color: rgb(var(--color-surface-500));
  white-space: nowrap;
}

.item-price {
  @apply text-xs font-semibold flex-shrink-0;
  color: rgb(var(--color-primary-600));
  white-space: nowrap;
}

.low-stock-badge {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold;
  background: var(--badge-warning-bg);
  color: var(--badge-warning-text);
  white-space: nowrap;
}

.low-stock-icon {
  @apply w-3 h-3 flex-shrink-0;
}

.low-stock-text {
  @apply leading-none;
}

/*
 * Out of Stock Row State
 * Items are fully clickable for operations (receiving) even when out of stock.
 * The class is kept for potential styling differentiation in the future.
 */
.item-row-out-of-stock:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

/* Out of Stock Badge */
.out-of-stock-badge {
  @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold;
  background: var(--badge-error-bg);
  color: var(--badge-error-text);
  white-space: nowrap;
}

.out-of-stock-icon {
  @apply w-3 h-3 flex-shrink-0;
}

.out-of-stock-text {
  @apply leading-none;
}
</style>
