<template>
  <div class="inventory-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-info">
          <h1 class="page-title">Inventory</h1>
          <p class="page-subtitle">
            {{ pagination.total }} items total
            <span v-if="lowStockItems.length > 0" class="low-stock-badge">
              {{ lowStockItems.length }} low stock
            </span>
            <span v-if="isConnected" class="live-badge" title="Real-time updates enabled">
              Live
            </span>
          </p>
        </div>
        <div class="header-actions">
          <!-- Operations Button -->
          <NuxtLink to="/operations" class="action-btn-labeled">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Operations</span>
          </NuxtLink>

          <!-- Activity Log Button -->
          <NuxtLink to="/log" class="action-btn-labeled">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
            </svg>
            <span>Activity</span>
          </NuxtLink>

          <!-- More Actions Menu -->
          <UiActionsMenu>
            <!-- Customize Fields (visible if isOwner) -->
            <UiMenuItem v-if="authStore.isOwner" to="/settings/schema">
              <template #icon>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </template>
              Customize Fields
            </UiMenuItem>
            <!-- Import Inventory (visible if canManageInventory) -->
            <UiMenuItem v-if="authStore.canManageInventory" to="/import">
              <template #icon>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </template>
              Import Inventory
            </UiMenuItem>
            <!-- Export Inventory (visible if hasSchema and items exist) -->
            <UiMenuItem v-if="hasSchema && items.length > 0" @click="showExportModal = true">
              <template #icon>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </template>
              Export Inventory
            </UiMenuItem>
          </UiActionsMenu>

          <!-- Add Item Button - Mobile Only (hidden for employees) -->
          <NuxtLink v-if="hasSchema && authStore.canManageInventory" to="/inventory/new" class="ml-auto flex sm:hidden add-btn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Add</span>
            <span class="add-btn-text-item"> Item</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Initial Loading State (before first fetch completes) -->
      <div v-if="!hasInitiallyLoaded" class="loading-state">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading inventory...</p>
      </div>

      <!-- No Schema State (only shown after initial load confirms no schema) -->
      <div v-else-if="!hasSchema" class="empty-schema-state">
        <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <h2 class="empty-title">{{ authStore.isOwner ? 'Set Up Your Inventory' : 'Inventory Not Set Up' }}</h2>
        <p class="empty-description">
          {{ authStore.isOwner
            ? 'Define the columns for your inventory table to get started. You can add fields like name, quantity, price, and more.'
            : 'The inventory has not been set up yet. Please contact the owner to configure the inventory columns.'
          }}
        </p>
        <NuxtLink v-if="authStore.isOwner" to="/settings/schema" class="setup-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Set Up Columns</span>
        </NuxtLink>
      </div>

      <!-- Has Schema -->
      <template v-else>
        <!-- Search -->
        <div class="search-section">
          <div class="search-row">
            <div class="search-wrapper">
              <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="searchQuery"
                type="search"
                placeholder="Search items..."
                class="search-input"
                @input="debouncedSearch"
              />
            </div>
            <!-- Desktop Filter -->
            <div class="hidden sm:block">
              <SearchFilterDropdown
                :columns="sortedColumns"
                :filter-preference="filterPreference"
                :is-filter-active="isFilterActive"
                @update:mode="handleFilterModeChange"
                @toggle-column="handleFilterColumnToggle"
                @reset="handleFilterReset"
              />
            </div>
            <!-- Mobile Filter Button -->
            <div class="sm:hidden">
              <SearchFilterMobile
                :columns="sortedColumns"
                :filter-preference="filterPreference"
                :is-filter-active="isFilterActive"
                :teleport-target="mobileFilterTarget"
                @update:mode="handleFilterModeChange"
                @toggle-column="handleFilterColumnToggle"
                @reset="handleFilterReset"
              />
            </div>
            <!-- Add Item Button - Desktop Only -->
            <NuxtLink
              v-if="hasSchema && authStore.canManageInventory"
              to="/inventory/new"
              class="hidden sm:flex add-btn ml-auto"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Add Item</span>
            </NuxtLink>
          </div>
          <!-- Mobile Filter Expanded Content Target -->
          <div id="mobile-filter-target" ref="mobileFilterTargetRef" class="sm:hidden"></div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="loading-state">
          <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>Loading inventory...</p>
        </div>

        <!-- Content -->
        <div v-else>
          <!-- Desktop Table -->
          <div class="hidden sm:block">
            <InventoryDynamicInventoryTable
              :items="displayItems"
              :columns="sortedColumns"
              :current-sort-column="sortPreference.columnId"
              :sort-direction="sortPreference.direction"
              :show-actions="authStore.canManageInventory"
              @select="viewItem"
              @edit="editItem"
              @delete="confirmDelete"
              @sort="handleSort"
            />
          </div>

          <!-- Mobile Cards -->
          <div class="sm:hidden">
            <SortDropdown
              :columns="sortedColumns"
              :column-id="sortPreference.columnId"
              :direction="sortPreference.direction"
              @update:column-id="handleSortColumnChange"
              @toggle-direction="handleToggleDirection"
            />
            <InventoryDynamicInventoryCard
              :items="displayItems"
              :columns="sortedColumns"
              :show-actions="authStore.canManageInventory"
              @select="viewItem"
              @edit="editItem"
              @delete="confirmDelete"
            />
          </div>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="pagination">
            <button
              :disabled="pagination.page === 1"
              class="pagination-btn"
              @click="changePage(pagination.page - 1)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span class="hidden md:inline">Previous</span>
            </button>
            <span class="pagination-info">
              <span class="md:hidden">{{ pagination.page }}</span>
              <span class="hidden md:inline">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
            </span>
            <button
              :disabled="pagination.page === pagination.totalPages"
              class="pagination-btn"
              @click="changePage(pagination.page + 1)"
            >
              <span class="hidden md:inline">Next</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Delete Confirmation Modal -->
    <UiModal
      v-model="showDeleteModal"
      title="Delete Item"
      variant="danger"
      size="md"
      :close-on-backdrop="!isDeleting"
      :persistent="isDeleting"
    >
      <p class="modal-description">
        Are you sure you want to delete this item? This action cannot be undone.
      </p>

      <template #footer>
        <button class="btn btn-secondary" :disabled="isDeleting" @click="showDeleteModal = false">
          Cancel
        </button>
        <button class="btn btn-danger" :disabled="isDeleting" @click="handleDelete">
          <svg
            v-if="isDeleting"
            class="animate-spin w-4 h-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isDeleting ? 'Deleting...' : 'Delete' }}
        </button>
      </template>
    </UiModal>

    <!-- Export Modal -->
    <ExportModal
      v-model="showExportModal"
      :items="displayItems"
      :columns="sortedColumns"
      :total-items="pagination.total"
    />
  </div>
</template>

<script setup lang="ts">
import type { DynamicInventoryItem } from '~/types/schema'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const authStore = useAuthStore()
const { initAuth } = useAuth()
const {
  items,
  pagination,
  isLoading,
  hasInitiallyLoaded,
  lowStockItems,
  hasSchema,
  sortedColumns,
  fetchItems,
  deleteItem,
} = useInventory()
const { fetchSchema } = useSchema()
const { isConnected } = useSocket()
const inventoryStore = useInventoryStore()
const {
  sortPreference,
  initSort,
  setSort,
  toggleDirection,
} = useInventorySort()
const {
  filterPreference,
  isFilterActive,
  initFilter,
  setFilter,
  toggleColumn,
  resetFilter,
  getSearchColumnIds,
} = useSearchFilter()

const searchQuery = ref('')
const itemToDelete = ref<DynamicInventoryItem | null>(null)
const showDeleteModal = ref(false)
const showExportModal = ref(false)
const isDeleting = ref(false)
const mobileFilterTargetRef = ref<HTMLElement | null>(null)

// Computed property that returns the teleport target only when mounted
const mobileFilterTarget = computed(() => {
  return mobileFilterTargetRef.value ? '#mobile-filter-target' : null
})

// Display items - no client-side sorting, server handles it
const displayItems = computed(() => items.value)

// Initialize sorting and filtering when columns are loaded
watch(
  sortedColumns,
  (columns) => {
    if (columns.length > 0) {
      initSort(columns)
      initFilter(columns)
    }
  },
  { immediate: true }
)

// Handle column header click for sorting (re-fetches from server)
const handleSort = (columnId: string) => {
  setSort(columnId)
  const searchColumns = getSearchColumnIds(textColumns.value)
  fetchItems({
    page: 1,
    search: searchQuery.value,
    searchColumns,
    sortColumn: sortPreference.value.columnId,
    sortDirection: sortPreference.value.direction,
  })
}

// Handle mobile dropdown column change (re-fetches from server)
const handleSortColumnChange = (columnId: string | null) => {
  setSort(columnId)
  const searchColumns = getSearchColumnIds(textColumns.value)
  fetchItems({
    page: 1,
    search: searchQuery.value,
    searchColumns,
    sortColumn: columnId,
    sortDirection: sortPreference.value.direction,
  })
}

// Handle toggle direction (re-fetches from server)
const handleToggleDirection = () => {
  toggleDirection()
  const searchColumns = getSearchColumnIds(textColumns.value)
  fetchItems({
    page: 1,
    search: searchQuery.value,
    searchColumns,
    sortColumn: sortPreference.value.columnId,
    sortDirection: sortPreference.value.direction,
  })
}

// Refetch data when business changes
watch(
  () => authStore.businessId,
  async (newBusinessId, oldBusinessId) => {
    if (newBusinessId && oldBusinessId && newBusinessId !== oldBusinessId) {
      // Clear existing data and reset load state before fetching new business data
      inventoryStore.setItems([])
      inventoryStore.setSchema([])
      inventoryStore.setInitiallyLoaded(false)
      searchQuery.value = ''
      await fetchSchema()
      await fetchItems({
        sortColumn: sortPreference.value.columnId,
        sortDirection: sortPreference.value.direction,
      })
    }
  }
)

// Initialize auth and fetch data on mount
onMounted(async () => {
  await initAuth()
  await fetchSchema()
  // Fetch with current sort params (may be restored from localStorage by initSort)
  await fetchItems({
    sortColumn: sortPreference.value.columnId,
    sortDirection: sortPreference.value.direction,
  })
})

// Get text columns for search filter
const textColumns = computed(() => {
  return sortedColumns.value.filter((c) => c.type === 'text')
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    const searchColumns = getSearchColumnIds(textColumns.value)
    fetchItems({
      page: 1,
      search: searchQuery.value,
      searchColumns,
      sortColumn: sortPreference.value.columnId,
      sortDirection: sortPreference.value.direction,
    })
  }, 300)
}

const changePage = (page: number) => {
  const searchColumns = getSearchColumnIds(textColumns.value)
  fetchItems({
    page,
    search: searchQuery.value,
    searchColumns,
    sortColumn: sortPreference.value.columnId,
    sortDirection: sortPreference.value.direction,
  })
}

// Filter handlers
const handleFilterModeChange = (mode: 'all' | 'include' | 'exclude') => {
  setFilter(mode)
  // Re-fetch with new filter if there's a search query
  if (searchQuery.value) {
    debouncedSearch()
  }
}

const handleFilterColumnToggle = (columnId: string) => {
  toggleColumn(columnId)
  // Re-fetch with new filter if there's a search query
  if (searchQuery.value) {
    debouncedSearch()
  }
}

const handleFilterReset = () => {
  resetFilter()
  // Re-fetch with no filter if there's a search query
  if (searchQuery.value) {
    debouncedSearch()
  }
}

const viewItem = (item: DynamicInventoryItem) => {
  router.push(`/inventory/${item.id}`)
}

const editItem = (item: DynamicInventoryItem) => {
  router.push(`/inventory/${item.id}?edit=true`)
}

const confirmDelete = (item: DynamicInventoryItem) => {
  itemToDelete.value = item
  showDeleteModal.value = true
}

const handleDelete = async () => {
  if (itemToDelete.value) {
    isDeleting.value = true
    try {
      await deleteItem(itemToDelete.value.id)
      itemToDelete.value = null
      showDeleteModal.value = false
    } finally {
      isDeleting.value = false
    }
  }
}
</script>

<style scoped>
.inventory-page {
  @apply min-h-screen py-8 px-4;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-7xl mx-auto;
}

.page-header {
  @apply flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6;
}

.header-info {
  @apply space-y-1;
}

.page-title {
  @apply text-xl md:text-2xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm flex items-center gap-2 flex-wrap;
  color: rgb(var(--color-surface-500));
}

.low-stock-badge {
  @apply px-2 py-0.5 text-xs font-semibold rounded-full;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.live-badge {
  @apply px-2 py-0.5 text-xs font-semibold rounded-full;
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.header-actions {
  @apply flex items-center gap-3;
}

.action-btn {
  @apply w-11 h-11 min-w-[44px] flex items-center justify-center flex-shrink-0 rounded-xl transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.action-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.action-btn-labeled {
  @apply flex items-center gap-2 px-4 min-h-[44px] rounded-xl font-medium transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.action-btn-labeled:hover {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

.add-btn {
  @apply items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl font-semibold text-white transition-all flex-shrink-0;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

/* Empty Schema State */
.empty-schema-state {
  @apply flex flex-col items-center justify-center py-20 text-center;
}

.empty-icon {
  @apply w-20 h-20 mb-6;
  color: rgb(var(--color-surface-300));
}

.empty-title {
  @apply text-2xl font-bold mb-2;
  color: rgb(var(--color-surface-900));
}

.empty-description {
  @apply max-w-md mb-6;
  color: rgb(var(--color-surface-500));
}

.setup-btn {
  @apply flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.setup-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(var(--color-primary-500), 0.4);
}

/* Search */
.search-section {
  @apply mb-6;
}

.search-row {
  @apply flex items-start gap-3;
}

.search-wrapper {
  @apply relative flex-1 md:max-w-md;
}

.search-icon {
  @apply absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5;
  color: rgb(var(--color-surface-400));
}

.search-input {
  @apply w-full pl-12 pr-4 min-h-[48px] md:min-h-[44px] rounded-xl text-sm font-medium transition-all outline-none;
  background: rgba(var(--color-surface-100), 0.8);
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

/* Loading */
.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

/* Pagination */
.pagination {
  @apply flex items-center justify-between md:justify-center gap-4 mt-6;
}

.pagination-btn {
  @apply flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] p-3 md:px-4 md:py-2 rounded-lg font-medium transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.5);
}

.pagination-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.pagination-info {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

/* Modal Content */
.modal-description {
  color: rgb(var(--color-surface-600));
}

/* Buttons */
.btn {
  @apply px-4 min-h-[44px] flex items-center justify-center rounded-lg font-medium transition-all;
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

.btn-danger {
  background: rgb(var(--color-error-500));
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: rgb(var(--color-error-600));
}

.btn-danger:disabled {
  @apply opacity-50 cursor-not-allowed;
}

@media (max-width: 339px) {
  .add-btn-text-item {
    display: none;
  }
}
</style>
