<template>
  <div class="item-selector">
    <!-- Search Input -->
    <div class="search-wrapper">
      <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        v-model="searchInput"
        type="search"
        placeholder="Search items..."
        class="search-input"
        @input="handleSearchInput"
      />
    </div>

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

      <!-- Empty State -->
      <div
        v-if="virtualWindow.isEmpty.value"
        class="no-items"
      >
        <p>{{ virtualWindow.state.value.searchQuery ? 'No items match your search' : 'No items available' }}</p>
      </div>

      <!-- Initial Loading State -->
      <div
        v-else-if="!hasLoadedOnce && virtualWindow.isLoading.value"
        class="loading-state"
      >
        <UiSpinner size="md" />
        <span>Loading items...</span>
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
}>()

const emit = defineEmits<{
  /**
   * Emitted when selection changes
   */
  'update:modelValue': [value: string[]]
}>()

const { authFetch } = useAuthFetch()
const inventoryStore = useInventoryStore()

// Find the name column for search filtering
const nameColumn = computed(() =>
  props.columns.find((col) => col.role === 'name')
)

// Local search input (not debounced)
const searchInput = ref('')

// Track if we've loaded at least once (for initial loading state)
const hasLoadedOnce = ref(false)

// Initialize virtual window with inventory fetch function
const virtualWindow = useVirtualWindow<DynamicInventoryItem>({
  maxItems: 40,
  pageSize: 20,
  scrollThreshold: 200,
  estimatedItemHeight: 72, // Approximate height of each item row
  searchDebounce: 300,
  fetchFn: async (params) => {
    // Only search the name column for operations (simpler, more relevant results)
    const searchColumns = nameColumn.value ? nameColumn.value.id : undefined
    const response = await authFetch<{
      items: DynamicInventoryItem[]
      pagination: { page: number; limit: number; total: number; totalPages: number }
    }>('/api/inventory', {
      query: {
        page: params.page,
        limit: params.limit,
        search: params.search,
        searchColumns: searchColumns, // Single column ID, not comma-separated
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
 * Handles search input changes.
 */
function handleSearchInput(event: Event): void {
  const target = event.target as HTMLInputElement
  virtualWindow.setSearch(target.value)
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
