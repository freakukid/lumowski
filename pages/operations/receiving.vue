<template>
  <div class="receiving-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <NuxtLink to="/operations" class="back-link">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>Back to Operations</span>
        </NuxtLink>

        <div class="header-content">
          <!-- Header Icon -->
          <div class="header-icon">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 11v4m0 0l-2-2m2 2l2-2"
              />
            </svg>
          </div>

          <div class="header-text">
            <h1 class="page-title">New Receiving</h1>
            <p class="page-subtitle">Record incoming inventory</p>
          </div>
        </div>
      </div>

      <!-- Loading Schema -->
      <div v-if="isSchemaLoading" class="loading-state">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p>Loading...</p>
      </div>

      <template v-else>
        <!-- Quantity Column Reminder -->
        <div v-if="showQuantityReminder" class="setup-reminder">
          <div class="reminder-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="reminder-content">
            <p class="reminder-text">
              <strong>Quantity column required.</strong>
              To use receiving operations, add a column with the "Quantity" role in your schema settings.
            </p>
            <NuxtLink to="/settings/schema" class="reminder-link">
              <span>Go to Schema Settings</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </NuxtLink>
          </div>
        </div>

        <!-- Form Content (Greyed out when quantity column not defined) -->
        <div :class="['form-content-wrapper', { disabled: showQuantityReminder }]">
        <!-- Error Message -->
        <div v-if="errorMessage" class="error-message">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Top Row: Select Items (left) | Items to Receive (right) -->
        <div class="form-layout">
          <!-- Left Column: Item Selector -->
          <div class="form-section">
            <div class="section-header">
              <div class="section-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <span class="section-title">Select Items</span>
            </div>

            <OperationsItemSelector
              v-model="selectedItemIds"
              :columns="columns"
            />
          </div>

          <!-- Right Column: Items to Receive -->
          <div class="form-section items-to-receive-section">
            <div class="section-header">
              <div class="section-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <span class="section-title">Items to Receive</span>
              <span v-if="selectedItems.length > 0" class="section-count">{{ selectedItems.length }} items</span>
            </div>

            <!-- Item Cards or Empty State -->
            <div v-if="selectedItems.length > 0" class="items-list">
              <OperationsReceivingItemCard
                v-for="item in selectedItems"
                :key="item.id"
                :item="item"
                :quantity="itemQuantities[item.id] || 1"
                :columns="columns"
                :cost-column="costColumn"
                :cost-per-item="itemCosts[item.id]"
                @update:quantity="updateItemQuantity(item.id, $event)"
                @update:cost-per-item="updateItemCost(item.id, $event)"
                @remove="removeItem(item.id)"
              />
            </div>
            <div v-else class="empty-items-state">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <p class="empty-text">Select items from the left to add them here</p>
            </div>
          </div>
        </div>

        <!-- Bottom Row: Details Section (full width) -->
        <div class="details-section">
          <div class="section-header">
            <div class="section-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span class="section-title">Details</span>
          </div>

          <div class="details-fields">
            <!-- Date -->
            <div class="form-group">
              <label for="receiving-date" class="form-label">
                Date <span class="required">*</span>
              </label>
              <UiDatePicker
                id="receiving-date"
                v-model="formData.date"
                placeholder="Select date"
                :required="true"
                :clearable="false"
              />
            </div>

            <!-- Reference -->
            <div class="form-group">
              <label for="reference" class="form-label">Reference</label>
              <input
                id="reference"
                v-model="formData.reference"
                type="text"
                placeholder="e.g., PO-001"
                class="input"
              />
            </div>

            <!-- Supplier -->
            <div class="form-group">
              <label for="supplier" class="form-label">Supplier</label>
              <input
                id="supplier"
                v-model="formData.supplier"
                type="text"
                placeholder="e.g., Acme Corp"
                class="input"
              />
            </div>

            <!-- Notes -->
            <div class="form-group form-group-notes">
              <label for="notes" class="form-label">Notes</label>
              <textarea
                id="notes"
                v-model="formData.notes"
                rows="3"
                placeholder="Additional notes..."
                class="input textarea"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Summary and Submit -->
        <div class="summary-section">
          <div class="summary-stats">
            <div class="stat">
              <span class="stat-label">Items</span>
              <span class="stat-value">{{ selectedItems.length }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Total Quantity</span>
              <span class="stat-value stat-value-primary">+{{ totalQuantity }}</span>
            </div>
            <div v-if="hasCostTracking" class="stat">
              <span class="stat-label">Total Cost</span>
              <span class="stat-value stat-value-cost">{{ formatCurrency(totalCost) }}</span>
            </div>
          </div>

          <div class="form-actions">
            <NuxtLink to="/operations" class="btn btn-secondary">
              Cancel
            </NuxtLink>
            <button
              type="button"
              :disabled="!canSubmit || isSubmitting"
              class="btn btn-primary"
              @click="handleSubmit"
            >
              <svg
                v-if="isSubmitting"
                class="animate-spin w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>{{ isSubmitting ? 'Creating...' : 'Create Receiving' }}</span>
            </button>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DynamicInventoryItem } from '~/types/schema'
import { useInventoryStore } from '~/stores/inventory'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const { fetchSchema, isLoading: isSchemaLoading } = useSchema()
const { sortedColumns: columns } = useInventory()
const inventoryStore = useInventoryStore()
const { isLoading: isSubmitting, createReceiving } = useReceiving()
const { formatCurrency } = useCurrency()

/**
 * Gets today's date in YYYY-MM-DD format for form default value.
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Form state
const selectedItemIds = ref<string[]>([])
const itemQuantities = ref<Record<string, number>>({})
const itemCosts = ref<Record<string, number | undefined>>({})
const formData = ref({
  date: getTodayDate(),
  reference: '',
  supplier: '',
  notes: '',
})
const errorMessage = ref('')

/**
 * Cost column definition (only present when cost tracking is enabled).
 */
const costColumn = computed(() => columns.value.find((c) => c.role === 'cost'))

/**
 * Quantity column definition (required for receiving operations).
 */
const quantityColumn = computed(() => columns.value.find((c) => c.role === 'quantity'))

/**
 * Whether to show the quantity column reminder notice.
 */
const showQuantityReminder = computed(() => !isSchemaLoading.value && !quantityColumn.value)

/**
 * Whether cost tracking is enabled for this business.
 */
const hasCostTracking = computed(() => !!costColumn.value)

/**
 * Updates the cost for a specific item.
 */
function updateItemCost(itemId: string, cost: number | undefined): void {
  itemCosts.value[itemId] = cost
}

/**
 * Calculates total cost across all selected items.
 */
const totalCost = computed(() => {
  if (!hasCostTracking.value) return 0
  return selectedItems.value.reduce((sum, item) => {
    const qty = itemQuantities.value[item.id] || 1
    const cost = itemCosts.value[item.id]
    return cost !== undefined ? sum + qty * cost : sum
  }, 0)
})

/**
 * Computed array of selected inventory items.
 * Uses the inventory store which is populated by ItemSelector's onItemsFetched callback.
 */
const selectedItems = computed<DynamicInventoryItem[]>(() => {
  return inventoryStore.items.filter((item) => selectedItemIds.value.includes(item.id))
})

/**
 * Calculates total quantity to be received across all selected items.
 */
const totalQuantity = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    return sum + (itemQuantities.value[item.id] || 1)
  }, 0)
})

/**
 * Determines if the form can be submitted.
 */
const canSubmit = computed(() => {
  return selectedItems.value.length > 0 && formData.value.date
})

/**
 * Initialize quantity to 1 when item is selected and clean up on removal.
 */
watch(selectedItemIds, (newIds, oldIds) => {
  // Find newly added items
  const addedIds = newIds.filter((id) => !oldIds?.includes(id))
  addedIds.forEach((id) => {
    if (!itemQuantities.value[id]) {
      itemQuantities.value[id] = 1
    }
  })

  // Clean up quantities and costs for removed items
  const removedIds = oldIds?.filter((id) => !newIds.includes(id)) || []
  removedIds.forEach((id) => {
    delete itemQuantities.value[id]
    delete itemCosts.value[id]
  })
})

/**
 * Updates the quantity for a specific item.
 */
function updateItemQuantity(itemId: string, quantity: number): void {
  itemQuantities.value[itemId] = quantity
}

/**
 * Removes an item from the selection.
 */
function removeItem(itemId: string): void {
  selectedItemIds.value = selectedItemIds.value.filter((id) => id !== itemId)
}

/**
 * Handles form submission.
 */
async function handleSubmit(): Promise<void> {
  errorMessage.value = ''

  const receivingItems = selectedItems.value.map((item) => ({
    itemId: item.id,
    quantity: itemQuantities.value[item.id] || 1,
    // Only include costPerItem if cost tracking is enabled and a cost was entered
    ...(hasCostTracking.value && itemCosts.value[item.id] !== undefined
      ? { costPerItem: itemCosts.value[item.id] }
      : {}),
  }))

  const result = await createReceiving({
    date: formData.value.date,
    reference: formData.value.reference || undefined,
    supplier: formData.value.supplier || undefined,
    notes: formData.value.notes || undefined,
    items: receivingItems,
  })

  if (result.success) {
    router.push('/operations')
  } else {
    errorMessage.value = result.error || 'Failed to create receiving operation'
  }
}

// Fetch schema on mount (items are fetched by ItemSelector with infinite scroll)
onMounted(async () => {
  await fetchSchema()
})
</script>

<style scoped>
.receiving-page {
  @apply min-h-screen py-8 px-4 relative;
  background: rgb(var(--color-surface-50));
  overflow-x: hidden;
}

.page-container {
  @apply max-w-5xl mx-auto relative z-10;
  width: 100%;
  min-width: 0;
}

.page-header {
  @apply mb-8 space-y-4;
}

.back-link {
  @apply min-h-[44px] inline-flex items-center gap-2 px-2 -ml-2 text-sm font-medium mb-4 transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

.header-content {
  @apply flex items-center gap-4;
}

.header-icon {
  @apply flex items-center justify-center flex-shrink-0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-600)));
  color: white;
  box-shadow: 0 4px 12px rgba(var(--color-accent-500), 0.3);
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

.page-title {
  @apply text-2xl md:text-3xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

.error-message {
  @apply flex items-center gap-2 p-4 rounded-xl mb-6 text-sm;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
  border: 1px solid rgba(var(--color-error-500), 0.2);
}

/* Form Layout - Top Row (Select Items | Items to Receive) */
.form-layout {
  @apply grid gap-6 mb-6;
}

@media (min-width: 768px) {
  .form-layout {
    @apply grid-cols-2;
  }
}

.form-section {
  @apply p-5 md:p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  min-width: 0;
  width: 100%;
  /* Enable flex children (ItemSelector) to fill remaining height */
  display: flex;
  flex-direction: column;
}

/* Desktop: constrain form-section height to prevent infinite scroll loading */
@media (min-width: 768px) {
  .form-layout > .form-section {
    min-height: 400px;
    max-height: calc(100vh - 400px);
    overflow: hidden;
  }
}

@media (max-width: 767px) {
  .form-section {
    @apply p-4;
  }
}

/* Items to Receive Section (right column) */
.items-to-receive-section {
  overflow-y: auto;
}

.items-list {
  @apply space-y-3 flex-1 overflow-y-auto;
}

/* Empty State for Items to Receive */
.empty-items-state {
  @apply flex flex-col items-center justify-center flex-1 py-8 text-center;
  color: rgb(var(--color-surface-400));
}

.empty-items-state svg {
  @apply mb-3 opacity-50;
}

.empty-text {
  @apply text-sm;
}

.section-header {
  @apply flex items-center gap-3 mb-4 pb-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.section-icon {
  @apply flex items-center justify-center w-9 h-9 rounded-lg;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.section-title {
  @apply font-semibold flex-1;
  color: rgb(var(--color-surface-700));
}

.section-count {
  @apply text-sm px-2 py-0.5 rounded-full;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

/* Details Section (full width below the two columns) */
.details-section {
  @apply p-5 md:p-6 rounded-2xl mb-6;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

@media (max-width: 767px) {
  .details-section {
    @apply p-4;
  }
}

/* Details Fields - Grid layout for wider screens */
.details-fields {
  @apply grid gap-4;
}

@media (min-width: 640px) {
  .details-fields {
    @apply grid-cols-2 gap-x-6 gap-y-4;
  }
}

@media (min-width: 1024px) {
  .details-fields {
    @apply grid-cols-4;
  }
}

/* Notes field spans full width on larger screens */
@media (min-width: 640px) {
  .form-group-notes {
    @apply col-span-2;
  }
}

@media (min-width: 1024px) {
  .form-group-notes {
    @apply col-span-4;
  }
}

/* Form Fields */
.form-fields {
  @apply space-y-4;
}

.form-group {
  @apply flex flex-col gap-1.5;
}

.form-label {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

.required {
  color: rgb(var(--color-error-500));
}

.textarea {
  @apply resize-none;
}

/* Summary Section */
.summary-section {
  @apply flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.summary-stats {
  @apply flex gap-6;
}

.stat {
  @apply flex flex-col;
}

.stat-label {
  @apply text-xs font-medium;
  color: rgb(var(--color-surface-500));
}

.stat-value {
  @apply text-xl font-bold;
  color: rgb(var(--color-surface-900));
}

.stat-value-primary {
  color: rgb(var(--color-accent-500));
}

.stat-value-cost {
  color: rgb(var(--color-primary-600));
}

.form-actions {
  @apply flex gap-3;
}

.btn {
  @apply px-5 min-h-[44px] flex items-center justify-center gap-2 rounded-xl font-semibold transition-all;
}

.btn-secondary {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.btn-secondary:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.btn-primary {
  color: white;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

.btn-primary:disabled {
  @apply opacity-50 cursor-not-allowed;
  transform: none;
}

/* Setup Reminder Notice */
.setup-reminder {
  @apply flex items-start gap-4 p-4 rounded-xl mb-6;
  background: rgba(var(--color-warning-500), 0.08);
  border: 1px solid rgba(var(--color-warning-500), 0.2);
}

.reminder-icon {
  @apply flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg;
  background: rgba(var(--color-warning-500), 0.12);
  color: rgb(var(--color-warning-600));
}

.reminder-content {
  @apply flex-1 min-w-0;
}

.reminder-text {
  @apply text-sm leading-relaxed mb-2;
  color: rgb(var(--color-surface-700));
}

.reminder-text strong {
  color: rgb(var(--color-warning-700));
}

.reminder-link {
  @apply inline-flex items-center gap-1.5 text-sm font-semibold transition-colors min-h-[44px] -mb-2;
  color: rgb(var(--color-warning-600));
}

.reminder-link:hover {
  color: rgb(var(--color-warning-700));
}

.reminder-link:focus {
  @apply outline-none;
  border-radius: 4px;
  box-shadow: var(--focus-ring);
}

/* Form Disabled State - Applied when quantity column is not defined */
/* Wrapper class for disabling the entire form */
.form-content-wrapper {
  position: relative;
  transition: opacity 200ms ease-in-out;
}

.form-content-wrapper.disabled {
  @apply opacity-50 pointer-events-none select-none;
}

.form-content-wrapper.disabled .error-message {
  @apply opacity-60;
}

.form-content-wrapper.disabled .form-layout,
.form-content-wrapper.disabled .details-section,
.form-content-wrapper.disabled .summary-section {
  @apply opacity-75 cursor-not-allowed;
}

/* Visual feedback for disabled inputs within disabled form */
.form-content-wrapper.disabled input,
.form-content-wrapper.disabled textarea,
.form-content-wrapper.disabled select,
.form-content-wrapper.disabled button {
  @apply cursor-not-allowed;
}

/* Prevent interactions with disabled form elements */
.form-content-wrapper.disabled * {
  pointer-events: none !important;
}
</style>
