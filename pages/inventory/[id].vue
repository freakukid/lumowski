<template>
  <div class="item-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <NuxtLink to="/" class="back-link">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Inventory</span>
        </NuxtLink>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading || !isCorrectItem" class="loading-state">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading item...</p>
      </div>

      <!-- Edit Mode -->
      <div v-else-if="isEditing && isCorrectItem && currentItem">
        <div class="header-content">
          <!-- Header Icon -->
          <div class="header-icon">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>

          <div class="header-text">
            <h1 class="page-title">Edit Item</h1>
            <p class="page-subtitle">Update item information</p>
          </div>
        </div>

        <div class="form-card">
          <!-- Card Header -->
          <div class="card-header">
            <div class="card-header-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span class="card-header-text">Item Details</span>
          </div>

          <InventoryDynamicInventoryForm
            :columns="sortedColumns"
            :item="currentItem"
            :is-loading="isLoading"
            @submit="handleUpdate"
            @cancel="isEditing = false"
          />
        </div>
      </div>

      <!-- View Mode -->
      <div v-else-if="isCorrectItem && currentItem">
        <div class="header-content">
          <!-- Header Icon -->
          <div class="header-icon view-header-icon">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>

          <div class="header-text">
            <h1 class="page-title">{{ itemName || 'Item Details' }}</h1>
            <p class="page-subtitle">Viewing item details</p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="view-actions">
          <button class="action-btn edit" @click="isEditing = true">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Edit</span>
          </button>
          <button class="action-btn delete" @click="showDeleteModal = true">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete</span>
          </button>
        </div>

        <!-- Item Details Card -->
        <div class="details-card">
          <!-- Card Header -->
          <div class="card-header">
            <div class="card-header-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span class="card-header-text">Item Details</span>
          </div>

          <dl class="details-list">
            <!-- Dynamic columns -->
            <div
              v-for="column in sortedColumns"
              :key="column.id"
              class="detail-row"
            >
              <dt class="detail-label">
                {{ column.name }}
                <span v-if="column.role" class="role-badge" :class="column.role">
                  {{ column.role }}
                </span>
              </dt>
              <dd class="detail-value">
                <InventoryDynamicCellRenderer
                  :value="currentItem.data[column.id]"
                  :column="column"
                  :is-low-stock="isItemLowStock"
                />
                <!-- Show min quantity hint if this is quantity -->
                <span v-if="column.role === 'quantity' && minQuantityColumn" class="quantity-hint">
                  (min: {{ currentItem.data[minQuantityColumn.id] ?? 0 }})
                </span>
              </dd>
            </div>

            <!-- System fields -->
            <div class="detail-row">
              <dt class="detail-label">Last Updated</dt>
              <dd class="detail-value">
                {{ formatDateTime(currentItem.updatedAt) }}
              </dd>
            </div>
            <div class="detail-row">
              <dt class="detail-label">Created</dt>
              <dd class="detail-value">
                {{ formatDateTime(currentItem.createdAt) }}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Not Found -->
      <div v-else class="empty-state">
        <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-xl font-bold mb-2">Item Not Found</h2>
        <p class="mb-4">The item you're looking for doesn't exist or has been deleted.</p>
        <NuxtLink to="/" class="back-btn">Back to Inventory</NuxtLink>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal-content">
          <h3 class="modal-title">Delete Item</h3>
          <p class="modal-description">
            Are you sure you want to delete this item? This action cannot be undone.
          </p>
          <div class="modal-actions">
            <button class="modal-btn cancel" @click="showDeleteModal = false">
              Cancel
            </button>
            <button class="modal-btn delete" @click="handleDelete">
              Delete
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition } from '~/types/schema'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const { currentItem, isLoading, sortedColumns, fetchItem, updateItem, deleteItem, clearCurrentItem } = useInventory()
const { fetchSchema } = useSchema()

const isEditing = ref(route.query.edit === 'true')
const showDeleteModal = ref(false)

// Track the currently loaded item ID to detect stale data
const loadedItemId = ref<string | null>(null)

// Computed to check if we're showing the correct item (prevents stale data flash)
const isCorrectItem = computed(() => {
  const routeId = route.params.id as string
  return currentItem.value?.id === routeId && loadedItemId.value === routeId
})

// Fetch item data for the given ID
const loadItem = async (id: string) => {
  // Clear previous item data immediately to prevent stale data flash
  clearCurrentItem()
  loadedItemId.value = null

  await fetchSchema()
  const result = await fetchItem(id)

  if (result.success) {
    loadedItemId.value = id
  }
}

// Fetch schema and item on mount
onMounted(() => {
  const id = route.params.id as string
  loadItem(id)
})

// Watch for route param changes (navigating between items)
watch(
  () => route.params.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      // Reset edit mode when navigating to a different item
      isEditing.value = route.query.edit === 'true'
      loadItem(newId as string)
    }
  }
)

// Get the name column value for display
const nameColumn = computed(() => sortedColumns.value.find((c: ColumnDefinition) => c.role === 'name'))
const quantityColumn = computed(() => sortedColumns.value.find((c: ColumnDefinition) => c.role === 'quantity'))
const minQuantityColumn = computed(() => sortedColumns.value.find((c: ColumnDefinition) => c.role === 'minQuantity'))

const itemName = computed(() => {
  if (!currentItem.value || !nameColumn.value) return null
  return currentItem.value.data[nameColumn.value.id] as string
})

// Check if item is low stock
const isItemLowStock = computed(() => {
  if (!currentItem.value || !quantityColumn.value || !minQuantityColumn.value) return false
  const qty = Number(currentItem.value.data[quantityColumn.value.id]) || 0
  const minQty = Number(currentItem.value.data[minQuantityColumn.value.id]) || 0
  return qty <= minQty
})

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleUpdate = async (data: Record<string, unknown>) => {
  const id = route.params.id as string
  const result = await updateItem(id, data)

  if (result.success) {
    isEditing.value = false
  }
}

const handleDelete = async () => {
  const id = route.params.id as string
  const result = await deleteItem(id)
  if (result.success) {
    router.push('/')
  }
}
</script>

<style scoped>
.item-page {
  @apply min-h-screen py-8 px-4;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-3xl mx-auto;
}

.page-header {
  @apply mb-10 space-y-4;
}

.back-link {
  @apply min-h-[44px] inline-flex items-center gap-2 px-2 -ml-2 text-sm font-medium transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

.page-title {
  @apply text-2xl md:text-3xl font-bold;
  color: rgb(var(--color-surface-900));
}

.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

.form-card {
  @apply p-5 md:p-8 rounded-3xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 10px 40px rgba(var(--color-surface-900), 0.06);
}

/* Header content with icon */
.header-content {
  @apply flex items-center gap-4 mb-6;
}

/* Header icon container */
.header-icon {
  @apply flex items-center justify-center flex-shrink-0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  color: white;
  box-shadow: 0 4px 12px rgba(var(--color-primary-500), 0.3);
}

@media (min-width: 768px) {
  .header-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }
}

.header-text {
  @apply flex flex-col gap-1;
}

.page-subtitle {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Card header section */
.card-header {
  @apply flex items-center gap-3 mb-6 pb-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.card-header-icon {
  @apply flex items-center justify-center w-9 h-9 rounded-lg;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.card-header-text {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}


.action-btn {
  @apply flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all;
}

.action-btn.edit {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}

.action-btn.edit:hover {
  background: rgba(var(--color-primary-500), 0.2);
}

.action-btn.delete {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.action-btn.delete:hover {
  background: rgba(var(--color-error-500), 0.2);
}

/* View Mode Actions */
.view-actions {
  @apply flex flex-wrap gap-3 mb-6;
}

/* View header icon (reuses header-icon styles) */
.view-header-icon {
  /* Uses same base styles as .header-icon */
}

/* Details Card */
.details-card {
  @apply p-5 md:p-8 rounded-3xl overflow-hidden;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 10px 40px rgba(var(--color-surface-900), 0.06);
}

.details-list {
  @apply divide-y;
  border-color: rgba(var(--color-surface-200), 0.8);
}

.detail-row {
  @apply py-3 md:py-4 flex flex-col md:grid md:grid-cols-3 md:gap-4 gap-1;
}

.detail-row:first-child {
  @apply pt-0;
}

.detail-row:last-child {
  @apply pb-0;
}

.detail-label {
  @apply text-xs md:text-sm font-semibold flex items-center gap-2;
  color: rgb(var(--color-surface-500));
}

.role-badge {
  @apply text-xs px-1.5 py-0.5 rounded font-medium;
}

.role-badge.name {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}

.role-badge.quantity {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.role-badge.minQuantity {
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.role-badge.price {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.role-badge.cost {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.detail-value {
  @apply text-sm md:col-span-2;
  color: rgb(var(--color-surface-900));
}

.quantity-hint {
  @apply ml-2 text-xs;
  color: rgb(var(--color-surface-400));
}

/* Empty State */
.empty-state {
  @apply flex flex-col items-center justify-center py-20 text-center;
  color: rgb(var(--color-surface-500));
}

.back-btn {
  @apply px-4 py-2 rounded-lg font-medium;
  background: rgb(var(--color-primary-500));
  color: white;
}

.back-btn:hover {
  background: rgb(var(--color-primary-600));
}

/* Modal */
.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center p-4 z-50;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  @apply p-6 rounded-2xl max-w-md w-full;
  background: rgb(var(--color-surface-50));
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
}

.modal-title {
  @apply text-lg font-bold mb-2;
  color: rgb(var(--color-surface-900));
}

.modal-description {
  @apply mb-6;
  color: rgb(var(--color-surface-600));
}

.modal-actions {
  @apply flex justify-end gap-3;
}

.modal-btn {
  @apply px-4 py-2 rounded-lg font-medium transition-all;
}

.modal-btn.cancel {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.modal-btn.cancel:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.modal-btn.delete {
  background: rgb(var(--color-error-500));
  color: white;
}

.modal-btn.delete:hover {
  background: rgb(var(--color-error-600));
}
</style>
