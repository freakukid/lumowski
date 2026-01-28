<template>
  <div class="sale-lookup" :class="{ 'sale-lookup-compact': isPreSelected && selectedSale }">
    <!-- Loading state for pre-selected sale -->
    <div v-if="isLoadingPreSelected" class="pre-selected-loading">
      <UiSpinner size="md" />
      <span>Loading sale details...</span>
    </div>

    <!-- Pre-selected sale display (compact mode) -->
    <template v-else-if="isPreSelected && selectedSale">
      <div class="pre-selected-sale">
        <div class="pre-selected-header">
          <div class="pre-selected-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="pre-selected-label">Original Sale</span>
        </div>
        <div class="pre-selected-card">
          <div class="pre-selected-info">
            <span class="pre-selected-reference">#{{ selectedSale.reference || selectedSale.id.slice(0, 8).toUpperCase() }}</span>
            <span class="pre-selected-details">
              {{ formatDate(selectedSale.date) }} | {{ formatCurrency(selectedSale.grandTotal || 0) }} | {{ selectedSale.items.length }} {{ selectedSale.items.length === 1 ? 'item' : 'items' }}
            </span>
          </div>
          <button type="button" class="change-sale-btn" @click="$emit('clear')">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Change Sale</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Standard lookup mode -->
    <template v-else>
      <div class="sale-lookup-header">
        <div class="sale-lookup-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <span class="sale-lookup-title">Find Original Sale</span>
      </div>

      <!-- Selected Sale Display -->
      <div v-if="selectedSale" class="selected-sale-display">
      <div class="selected-sale-header">
        <span class="selected-sale-label">Selected Sale</span>
        <button type="button" class="clear-selection-btn" @click="$emit('clear')">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Clear</span>
        </button>
      </div>
      <div class="selected-sale-card">
        <div class="sale-card-top">
          <span class="sale-reference">#{{ selectedSale.reference || selectedSale.id.slice(0, 8).toUpperCase() }}</span>
          <span class="sale-date">{{ formatDate(selectedSale.date) }}</span>
        </div>
        <div class="sale-card-bottom">
          <span class="sale-total">{{ formatCurrency(selectedSale.grandTotal || 0) }}</span>
          <span class="sale-items">{{ selectedSale.items.length }} {{ selectedSale.items.length === 1 ? 'item' : 'items' }}</span>
          <span class="sale-payment">{{ formatPaymentMethod(selectedSale.paymentMethod) }}</span>
        </div>
      </div>
    </div>

    <!-- Search Section (hidden when sale is selected) -->
    <template v-else>
      <!-- Search Input -->
      <div class="search-input-section">
        <div class="search-input-wrapper">
          <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input input"
            placeholder="Search by receipt # or customer..."
            @keyup.enter="handleSearch"
          />
        </div>
        <button
          type="button"
          class="search-btn btn btn-primary"
          :disabled="isSearching"
          @click="handleSearch"
        >
          <UiSpinner v-if="isSearching" size="sm" />
          <span v-else>Search</span>
        </button>
      </div>

      <!-- Date Range Filter -->
      <div class="date-filter-section">
        <span class="filter-label">Or filter by date:</span>
        <div class="date-range-inputs">
          <UiDatePicker
            v-model="dateFrom"
            placeholder="From"
            :clearable="true"
            class="date-input"
          />
          <span class="date-separator">to</span>
          <UiDatePicker
            v-model="dateTo"
            placeholder="To"
            :clearable="true"
            class="date-input"
          />
          <button
            type="button"
            class="filter-btn btn btn-secondary"
            :disabled="isSearching || (!dateFrom && !dateTo)"
            @click="handleDateFilter"
          >
            Filter
          </button>
          <button
            v-if="dateFrom || dateTo"
            type="button"
            class="clear-date-btn btn btn-secondary"
            :disabled="isSearching"
            @click="handleClearDateFilter"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="errorMessage" class="error-message">
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Search Results / Recent Sales -->
      <div class="sales-list-section">
        <div class="sales-list-header">
          <span class="sales-list-title">
            {{ hasSearched ? 'Search Results' : 'Recent Sales' }}
          </span>
          <span v-if="sales.length > 0" class="sales-count">{{ sales.length }}</span>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="sales-list-loading">
          <UiSpinner />
          <span>Loading sales...</span>
        </div>

        <!-- Empty State -->
        <div v-else-if="sales.length === 0" class="sales-list-empty">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>{{ hasSearched ? 'No sales found matching your search' : 'No recent sales available' }}</p>
        </div>

        <!-- Sales List -->
        <div v-else class="sales-list">
          <button
            v-for="sale in sales"
            :key="sale.id"
            type="button"
            class="sale-list-item"
            @click="$emit('select', sale)"
          >
            <div class="sale-item-left">
              <span class="sale-item-reference">#{{ sale.reference || sale.id.slice(0, 8).toUpperCase() }}</span>
              <span class="sale-item-date">{{ formatDateShort(sale.date) }}</span>
            </div>
            <div class="sale-item-right">
              <span class="sale-item-total">{{ formatCurrency(sale.grandTotal || 0) }}</span>
              <span class="sale-item-payment">{{ formatPaymentMethod(sale.paymentMethod) }}</span>
            </div>
            <svg class="sale-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Operation } from '~/types/operation'

interface Props {
  /** Currently selected sale (if any) */
  selectedSale: Operation | null
  /** Whether the sale was pre-selected via URL query parameter */
  isPreSelected?: boolean
  /** Whether the pre-selected sale is currently being loaded */
  isLoadingPreSelected?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select': [sale: Operation]
  'clear': []
}>()

const { authFetch } = useAuthFetch()
const { formatCurrency } = useCurrency()
const { formatDate, formatDateShort } = useDate()
const { formatPaymentMethod } = usePaymentFormatting()

// State
const searchQuery = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const sales = ref<Operation[]>([])
const isLoading = ref(false)
const isSearching = ref(false)
const errorMessage = ref('')
const hasSearched = ref(false)

/**
 * Loads recent sales on mount.
 */
async function loadRecentSales(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await authFetch<{ operations: Operation[] }>('/api/operations', {
      query: {
        type: 'SALE',
        limit: 10,
        excludeUndone: true,
      },
    })
    sales.value = response.operations
  } catch (error) {
    console.error('Failed to load recent sales:', error)
    errorMessage.value = 'Failed to load recent sales'
  } finally {
    isLoading.value = false
  }
}

/**
 * Handles search by reference, ID, or customer.
 * If search is empty, reloads the recent sales list.
 */
async function handleSearch(): Promise<void> {
  const trimmedQuery = searchQuery.value.trim()

  // If search is empty, reload recent sales
  if (!trimmedQuery) {
    hasSearched.value = false
    await loadRecentSales()
    return
  }

  isSearching.value = true
  hasSearched.value = true
  errorMessage.value = ''

  try {
    const response = await authFetch<{ operations: Operation[] }>('/api/operations', {
      query: {
        type: 'SALE',
        search: trimmedQuery,
        limit: 20,
        excludeUndone: true,
      },
    })
    sales.value = response.operations
  } catch (error) {
    console.error('Search failed:', error)
    errorMessage.value = 'Search failed. Please try again.'
  } finally {
    isSearching.value = false
  }
}

/**
 * Handles date range filtering.
 */
async function handleDateFilter(): Promise<void> {
  if (!dateFrom.value && !dateTo.value) return

  isSearching.value = true
  hasSearched.value = true
  errorMessage.value = ''

  try {
    const response = await authFetch<{ operations: Operation[] }>('/api/operations', {
      query: {
        type: 'SALE',
        ...(dateFrom.value && { dateFrom: dateFrom.value }),
        ...(dateTo.value && { dateTo: dateTo.value }),
        limit: 50,
        excludeUndone: true,
      },
    })
    sales.value = response.operations
  } catch (error) {
    console.error('Filter failed:', error)
    errorMessage.value = 'Filter failed. Please try again.'
  } finally {
    isSearching.value = false
  }
}

/**
 * Clears the date filters and reloads the recent sales list.
 */
async function handleClearDateFilter(): Promise<void> {
  dateFrom.value = ''
  dateTo.value = ''
  hasSearched.value = false
  await loadRecentSales()
}

// Load recent sales on mount, but only if not pre-selected from query parameter
onMounted(() => {
  // Skip loading recent sales if a sale is being pre-selected from URL
  if (!props.isPreSelected && !props.isLoadingPreSelected) {
    loadRecentSales()
  }
})
</script>

<style scoped>
.sale-lookup {
  @apply p-5 md:p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.sale-lookup-header {
  @apply flex items-center gap-3 mb-4 pb-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.sale-lookup-icon {
  @apply flex items-center justify-center w-9 h-9 rounded-lg;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.sale-lookup-title {
  @apply font-semibold;
  color: rgb(var(--color-surface-700));
}

/* Selected Sale Display */
.selected-sale-display {
  @apply space-y-3;
}

.selected-sale-header {
  @apply flex items-center justify-between;
}

.selected-sale-label {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

.clear-selection-btn {
  @apply inline-flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-lg transition-colors min-h-[44px];
  color: rgb(var(--color-surface-500));
  background: rgba(var(--color-surface-200), 0.5);
}

.clear-selection-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

.selected-sale-card {
  @apply p-4 rounded-xl;
  background: rgba(var(--color-warning-500), 0.08);
  border: 2px solid rgba(var(--color-warning-500), 0.3);
}

.sale-card-top {
  @apply flex items-center justify-between gap-3 mb-2;
}

.sale-reference {
  @apply text-lg font-bold;
  color: rgb(var(--color-warning-700));
}

.sale-date {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.sale-card-bottom {
  @apply flex flex-wrap items-center gap-3 text-sm;
}

.sale-total {
  @apply font-semibold;
  color: rgb(var(--color-surface-700));
}

.sale-items {
  color: rgb(var(--color-surface-500));
}

.sale-payment {
  @apply px-2 py-0.5 rounded-full text-xs font-medium;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

/* Search Input Section */
.search-input-section {
  @apply flex gap-2 mb-4;
}

.search-input-wrapper {
  @apply relative flex-1;
}

.search-icon {
  @apply absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5;
  color: rgb(var(--color-surface-400));
}

.search-input {
  @apply w-full pl-10 min-h-[44px];
}

.search-btn {
  @apply px-4 min-h-[44px];
}

/* Date Filter Section */
.date-filter-section {
  @apply mb-4 p-3 rounded-xl;
  background: rgba(var(--color-surface-50), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.5);
}

.filter-label {
  @apply text-xs font-medium block mb-2;
  color: rgb(var(--color-surface-500));
}

.date-range-inputs {
  @apply flex flex-wrap items-center gap-2;
}

.date-input {
  @apply flex-1 min-w-[120px];
}

.date-separator {
  @apply text-sm;
  color: rgb(var(--color-surface-400));
}

.filter-btn {
  @apply px-3 min-h-[44px];
}

.clear-date-btn {
  @apply px-3 min-h-[44px];
}

/* Error Message */
.error-message {
  @apply flex items-center gap-2 p-3 rounded-lg mb-4 text-sm;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

/* Sales List Section */
.sales-list-section {
  @apply mt-4;
}

.sales-list-header {
  @apply flex items-center justify-between gap-2 mb-3;
}

.sales-list-title {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

.sales-count {
  @apply text-xs px-2 py-0.5 rounded-full;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.sales-list-loading,
.sales-list-empty {
  @apply flex flex-col items-center justify-center text-center py-6;
  color: rgb(var(--color-surface-400));
}

.sales-list-loading {
  @apply flex-row gap-2;
}

.sales-list-empty svg {
  @apply mb-2;
  opacity: 0.5;
}

.sales-list-empty p {
  @apply text-sm;
}

/* Sales List Items */
.sales-list {
  @apply space-y-2 max-h-[300px] overflow-y-auto pr-1;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--color-surface-400), 0.5) transparent;
}

.sale-list-item {
  @apply flex items-center gap-3 w-full p-3 rounded-xl cursor-pointer transition-all text-left min-h-[44px];
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid transparent;
}

.sale-list-item:hover {
  background: rgba(var(--color-surface-200), 0.5);
  border-color: rgba(var(--color-warning-500), 0.3);
}

.sale-item-left {
  @apply flex flex-col flex-1 min-w-0;
}

.sale-item-reference {
  @apply text-sm font-semibold truncate;
  color: rgb(var(--color-surface-700));
}

.sale-item-date {
  @apply text-xs;
  color: rgb(var(--color-surface-400));
}

.sale-item-right {
  @apply flex flex-col items-end;
}

.sale-item-total {
  @apply text-sm font-bold;
  color: rgb(var(--color-surface-800));
}

.sale-item-payment {
  @apply text-xs;
  color: rgb(var(--color-surface-400));
}

.sale-item-arrow {
  @apply w-4 h-4 flex-shrink-0;
  color: rgb(var(--color-surface-400));
}

/* Button styles */
.btn {
  @apply flex items-center justify-center gap-2 rounded-xl font-semibold transition-all;
}

.btn-primary {
  color: white;
  background: linear-gradient(135deg, rgb(var(--color-warning-500)), rgb(var(--color-warning-600)));
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(var(--color-warning-500), 0.3);
}

.btn-primary:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.btn-secondary {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.5);
}

.btn-secondary:disabled {
  @apply opacity-50 cursor-not-allowed;
}

/* Focus visible styles for accessibility */
.btn:focus-visible,
button:focus-visible,
.sale-list-item:focus-visible,
.clear-selection-btn:focus-visible,
.change-sale-btn:focus-visible {
  outline: 2px solid rgb(var(--color-warning-500));
  outline-offset: 2px;
}

/* Compact mode for pre-selected sale */
.sale-lookup-compact {
  @apply p-4;
}

/* Pre-selected loading state */
.pre-selected-loading {
  @apply flex items-center justify-center gap-3 py-6;
  color: rgb(var(--color-surface-500));
}

/* Pre-selected sale display */
.pre-selected-sale {
  @apply space-y-3;
}

.pre-selected-header {
  @apply flex items-center gap-2;
}

.pre-selected-icon {
  @apply flex items-center justify-center w-8 h-8 rounded-lg;
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.pre-selected-label {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-600));
}

.pre-selected-card {
  @apply flex items-center justify-between gap-4 p-3 rounded-xl;
  background: rgba(var(--color-success-500), 0.06);
  border: 1px solid rgba(var(--color-success-500), 0.2);
}

.pre-selected-info {
  @apply flex flex-col gap-0.5 min-w-0;
}

.pre-selected-reference {
  @apply text-base font-bold truncate;
  color: rgb(var(--color-surface-800));
}

.pre-selected-details {
  @apply text-xs truncate;
  color: rgb(var(--color-surface-500));
}

.change-sale-btn {
  @apply inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors flex-shrink-0 min-h-[36px];
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.change-sale-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

@media (max-width: 479px) {
  .pre-selected-card {
    @apply flex-col items-start gap-3;
  }

  .change-sale-btn {
    @apply w-full justify-center;
  }
}
</style>
