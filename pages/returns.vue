<template>
  <div class="returns-page">
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
          <!-- Header Icon - WARNING COLOR -->
          <div class="header-icon header-icon-warning">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>

          <div class="header-text">
            <h1 class="page-title">Returns</h1>
            <p class="page-subtitle">Process a customer return</p>
          </div>
        </div>
      </div>

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

      <!-- Sale Lookup Section -->
      <ReturnsSaleLookup
        :selected-sale="selectedSale"
        :is-pre-selected="isPreSelectedFromQuery"
        :is-loading-pre-selected="isLoadingPreSelectedSale"
        @select="handleSaleSelect"
        @clear="handleSaleClear"
      />

      <!-- Return Content (visible after sale is selected) -->
      <Transition name="slide-fade">
        <div v-if="selectedSale" class="return-content">
          <!-- Loading Returnable Items -->
          <div
            v-if="isLoadingItems"
            class="loading-state"
            role="status"
            aria-live="polite"
          >
            <UiSpinner size="lg" />
            <p>Loading returnable items...</p>
          </div>

          <template v-else>
            <!-- Return Items Section -->
            <ReturnsReturnItemList
              :items="returnableItems"
              :return-data="returnData"
              @update:return-data="returnData = $event"
            />

            <!-- Return Details Section -->
            <Transition name="slide-fade">
              <div v-if="hasSelectedItems" class="return-details-section">
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
                  <span class="section-title">Return Details</span>
                </div>

                <div class="details-form">
                  <!-- Date -->
                  <div class="form-group">
                    <label for="return-date" class="form-label">
                      Date <span class="required">*</span>
                    </label>
                    <UiDatePicker
                      id="return-date"
                      v-model="returnDate"
                      placeholder="Select date"
                      :required="true"
                      :clearable="false"
                    />
                  </div>

                  <!-- Reason -->
                  <div class="form-group">
                    <label for="return-reason" class="form-label">
                      Reason <span class="required">*</span>
                    </label>
                    <select
                      id="return-reason"
                      v-model="returnReason"
                      class="select"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Changed mind">Changed mind</option>
                      <option value="Wrong item">Wrong item</option>
                      <option value="Defective product">Defective product</option>
                      <option value="Damaged in transit">Damaged in transit</option>
                      <option value="Did not match description">Did not match description</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <!-- Refund Method -->
                  <div class="form-group form-group-wide">
                    <ReturnsRefundMethodSelector
                      v-model="refundMethod"
                      :original-method="selectedSale.paymentMethod"
                      :original-card-type="selectedSale.cardType"
                      :card-type="selectedCardType"
                      :show-card-type-error="showCardTypeError"
                      @update:card-type="selectedCardType = $event"
                    />
                  </div>

                  <!-- Notes -->
                  <div class="form-group form-group-wide">
                    <label for="return-notes" class="form-label">Notes</label>
                    <textarea
                      id="return-notes"
                      v-model="returnNotes"
                      rows="2"
                      placeholder="Additional notes about this return..."
                      class="input textarea"
                    ></textarea>
                  </div>
                </div>
              </div>
            </Transition>

            <!-- Summary Section -->
            <Transition name="slide-fade">
              <ReturnsReturnSummary
                v-if="hasSelectedItems"
                :return-items="summaryItems"
                :refund-method="refundMethod"
                :card-type="selectedCardType"
                :refund-subtotal="totalRefund"
                :tax-rate="selectedSale?.taxRate ?? 0"
                :can-submit="canSubmit"
                :is-submitting="isSubmitting"
                @submit="handleSubmit"
                @cancel="handleCancel"
              />
            </Transition>
          </template>
        </div>
      </Transition>
    </div>

    <!-- Success Modal -->
    <UiModal
      v-model="showSuccessModal"
      title="Return Processed"
      variant="success"
      size="md"
    >
      <div class="success-content">
        <div class="success-icon-container">
          <div class="success-icon">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h3 class="success-title">Return Completed!</h3>
        <p class="success-amount">-{{ formatCurrency(totalRefundWithTax) }}</p>
        <p class="success-message">
          The return has been processed and inventory has been updated.
        </p>
      </div>

      <template #footer>
        <div class="success-actions">
          <button
            type="button"
            class="btn btn-secondary"
            @click="handleNewReturn"
          >
            Process Another
          </button>
          <NuxtLink
            v-if="completedReturn"
            :to="`/operations/${completedReturn.id}`"
            class="btn btn-primary"
          >
            View Return Details
          </NuxtLink>
        </div>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import type {
  Operation,
  ReturnableItem,
  ReturnItemCondition,
  RefundMethod,
  CardType,
} from '~/types/operation'
import { createDefaultReturnItemData, type ReturnItemData } from '~/composables/useReturn'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { isLoading: isSubmitting, processReturn, getReturnableItems } = useReturn()
const { formatCurrency } = useCurrency()
const { authFetch } = useAuthFetch()
const { calculateItemRefund } = useReturnCalculations()

// Initialize socket connection for real-time updates
useSocket()

// State
const selectedSale = ref<Operation | null>(null)
const returnableItems = ref<ReturnableItem[]>([])
const returnData = ref<Map<string, ReturnItemData>>(new Map())
const isLoadingItems = ref(false)
const errorMessage = ref('')
const isPreSelectedFromQuery = ref(false)
const isLoadingPreSelectedSale = ref(false)

// Return details form state
const returnDate = ref(getTodayDate())
const returnReason = ref('')
const refundMethod = ref<RefundMethod>('ORIGINAL_METHOD')
const selectedCardType = ref<CardType | undefined>(undefined)
const returnNotes = ref('')
const showCardTypeError = ref(false)

// Success modal state
const showSuccessModal = ref(false)
const completedReturn = ref<Operation | null>(null)

/**
 * Gets today's date in YYYY-MM-DD format.
 */
function getTodayDate(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

/**
 * Business name from auth store.
 */
const businessName = computed(() => authStore.businessName || 'Business')

/**
 * Whether any items are selected for return.
 */
const hasSelectedItems = computed(() => {
  for (const [, data] of returnData.value) {
    if (data.selected && data.quantity > 0) {
      return true
    }
  }
  return false
})

/**
 * Map of returnable items by itemId for O(1) lookups.
 */
const returnableItemsMap = computed(() => {
  return new Map(returnableItems.value.map(item => [item.itemId, item]))
})

/**
 * Items formatted for the summary component.
 * Includes defensive checks to ensure all values are valid numbers.
 */
const summaryItems = computed(() => {
  const items: {
    itemId: string
    itemName: string
    quantity: number
    refundAmount: number
    condition: ReturnItemCondition
  }[] = []

  for (const [itemId, data] of returnData.value) {
    if (data.selected && data.quantity > 0) {
      const item = returnableItemsMap.value.get(itemId)
      if (item) {
        const refundAmount = calculateItemRefund(
          data.quantity,
          item.pricePerItem,
          item.discount,
          item.discountType,
          item.originalQty
        )
        items.push({
          itemId,
          itemName: item.itemName,
          quantity: data.quantity,
          // Defensive check: ensure refundAmount is a valid number
          refundAmount: Number.isFinite(refundAmount) ? refundAmount : 0,
          condition: data.condition,
        })
      }
    }
  }

  return items
})

/**
 * Total refund subtotal (item amounts before tax).
 * Includes defensive check to ensure result is a valid number.
 */
const totalRefund = computed(() => {
  const sum = summaryItems.value.reduce((acc, item) => acc + (item.refundAmount || 0), 0)
  return Number.isFinite(sum) ? sum : 0
})

/**
 * Total refund amount including tax.
 * Uses the original sale's tax rate to calculate the tax on the refund.
 * Includes defensive checks to ensure result is a valid number.
 */
const totalRefundWithTax = computed(() => {
  const subtotal = totalRefund.value
  const rawTaxRate = selectedSale.value?.taxRate ?? 0
  const taxRate = Number.isFinite(rawTaxRate) ? rawTaxRate : 0
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  return Number.isFinite(total) ? total : 0
})

/**
 * Whether the form can be submitted.
 */
const canSubmit = computed(() => {
  if (!selectedSale.value) return false
  if (!hasSelectedItems.value) return false
  if (!returnDate.value) return false
  if (!returnReason.value) return false
  if (refundMethod.value === 'CARD' && !selectedCardType.value) return false
  return true
})

/**
 * Handles sale selection.
 */
async function handleSaleSelect(sale: Operation): Promise<void> {
  selectedSale.value = sale
  returnData.value = new Map()
  errorMessage.value = ''
  isLoadingItems.value = true

  const result = await getReturnableItems(sale.id)

  if (result.success && result.data) {
    returnableItems.value = result.data

    // Initialize return data for each item
    for (const item of result.data) {
      returnData.value.set(item.itemId, createDefaultReturnItemData())
    }
  } else {
    errorMessage.value = result.error || 'Failed to load returnable items'
    returnableItems.value = []
  }

  isLoadingItems.value = false
}

/**
 * Handles clearing the selected sale.
 * If the sale was pre-selected from a query parameter, also clear that state
 * and update the URL to remove the saleId parameter.
 */
function handleSaleClear(): void {
  selectedSale.value = null
  returnableItems.value = []
  returnData.value = new Map()
  resetForm()

  // If this was a pre-selected sale, clear that state and update URL
  if (isPreSelectedFromQuery.value) {
    isPreSelectedFromQuery.value = false
    // Remove the saleId query parameter from URL without full navigation
    router.replace({ query: {} })
  }
}

/**
 * Resets the return form to initial state.
 */
function resetForm(): void {
  returnDate.value = getTodayDate()
  returnReason.value = ''
  refundMethod.value = 'ORIGINAL_METHOD'
  selectedCardType.value = undefined
  returnNotes.value = ''
  showCardTypeError.value = false
  errorMessage.value = ''
}

/**
 * Handles form submission.
 */
async function handleSubmit(): Promise<void> {
  if (!selectedSale.value) return
  errorMessage.value = ''

  // Validate card type if card refund is selected
  if (refundMethod.value === 'CARD' && !selectedCardType.value) {
    showCardTypeError.value = true
    errorMessage.value = 'Please select a card type'
    return
  }

  showCardTypeError.value = false

  // Build return items
  const items = summaryItems.value.map(item => ({
    itemId: item.itemId,
    quantity: item.quantity,
    condition: item.condition,
  }))

  const result = await processReturn({
    originalSaleId: selectedSale.value.id,
    date: returnDate.value,
    reason: returnReason.value,
    refundMethod: refundMethod.value,
    ...(refundMethod.value === 'CARD' && selectedCardType.value
      ? { cardType: selectedCardType.value }
      : {}),
    notes: returnNotes.value || undefined,
    items,
  })

  if (result.success && result.data) {
    completedReturn.value = result.data
    showSuccessModal.value = true
  } else {
    errorMessage.value = result.error || 'Failed to process return'
  }
}

/**
 * Handles cancel action.
 */
function handleCancel(): void {
  router.push('/operations')
}

/**
 * Handles starting a new return after success.
 */
function handleNewReturn(): void {
  showSuccessModal.value = false
  completedReturn.value = null

  // Reset for next return
  handleSaleClear()
}

// Initialize auth on mount and handle query parameters
onMounted(async () => {
  const { initAuth } = useAuth()
  await initAuth()

  // Check for saleId query parameter (from "Process Return" button on operations detail page)
  const saleIdFromQuery = route.query.saleId as string
  if (saleIdFromQuery) {
    // Mark as pre-selected and show loading state
    isPreSelectedFromQuery.value = true
    isLoadingPreSelectedSale.value = true

    // Fetch the sale and auto-select it
    try {
      const operation = await authFetch<Operation>(`/api/operations/${saleIdFromQuery}`)
      if (operation && operation.type === 'SALE') {
        await handleSaleSelect(operation)
      } else {
        errorMessage.value = 'The specified operation is not a sale or could not be found'
        isPreSelectedFromQuery.value = false
      }
    } catch (error) {
      console.error('Failed to fetch sale from query:', error)
      errorMessage.value = 'Failed to load the specified sale'
      isPreSelectedFromQuery.value = false
    } finally {
      isLoadingPreSelectedSale.value = false
    }
  }
})

// Reset card type error when refund method changes
watch(refundMethod, (newMethod) => {
  if (newMethod !== 'CARD') {
    showCardTypeError.value = false
    selectedCardType.value = undefined
  }
})
</script>

<style scoped>
.returns-page {
  @apply min-h-screen py-8 px-4 relative;
  background: rgb(var(--color-surface-50));
  overflow-x: hidden;
}

.page-container {
  @apply max-w-4xl mx-auto relative z-10 space-y-6;
  width: 100%;
  min-width: 0;
}

.page-header {
  @apply mb-2 space-y-4;
}

.back-link {
  @apply min-h-[44px] inline-flex items-center gap-2 px-2 -ml-2 text-sm font-medium mb-4 transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-warning-600));
}

.header-content {
  @apply flex items-center gap-4;
}

.header-icon {
  @apply flex items-center justify-center flex-shrink-0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  color: white;
}

@media (min-width: 768px) {
  .header-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }
}

.header-icon-warning {
  background: linear-gradient(135deg, rgb(var(--color-warning-500)), rgb(var(--color-warning-600)));
  box-shadow: 0 4px 12px rgba(var(--color-warning-500), 0.3);
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

.error-message {
  @apply flex items-center gap-2 p-4 rounded-xl text-sm;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
  border: 1px solid rgba(var(--color-error-500), 0.2);
}

.loading-state {
  @apply flex flex-col items-center justify-center py-12 gap-4;
  color: rgb(var(--color-surface-400));
}

.return-content {
  @apply space-y-6;
}

/* Return Details Section */
.return-details-section {
  @apply p-5 md:p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.section-header {
  @apply flex items-center gap-3 mb-4 pb-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.section-icon {
  @apply flex items-center justify-center w-9 h-9 rounded-lg;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.section-title {
  @apply font-semibold;
  color: rgb(var(--color-surface-700));
}

.details-form {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .details-form {
    grid-template-columns: 1fr 1fr;
  }

  .form-group-wide {
    grid-column: span 2;
  }
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

/* Slide-fade transition */
.slide-fade-enter-active {
  transition: all 200ms ease-out;
}

.slide-fade-leave-active {
  transition: all 150ms ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Success Modal */
.success-content {
  @apply text-center py-4;
}

.success-icon-container {
  @apply flex justify-center mb-4;
}

.success-icon {
  @apply w-16 h-16 rounded-full flex items-center justify-center;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.success-title {
  @apply text-xl font-bold mb-2;
  color: rgb(var(--color-surface-800));
}

.success-amount {
  @apply text-3xl font-bold mb-3;
  color: rgb(var(--color-warning-600));
}

.success-message {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.success-actions {
  @apply flex gap-3 justify-center w-full;
}

@media (max-width: 479px) {
  .success-actions {
    @apply flex-col;
  }
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
  background: linear-gradient(135deg, rgb(var(--color-warning-500)), rgb(var(--color-warning-600)));
  box-shadow: 0 4px 12px rgba(var(--color-warning-500), 0.3);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(var(--color-warning-500), 0.4);
}

/* Focus visible styles for accessibility */
.btn:focus-visible,
button:focus-visible {
  outline: 2px solid rgb(var(--color-warning-500));
  outline-offset: 2px;
}
</style>
