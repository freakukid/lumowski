<template>
  <div class="split-payment-container">
    <!-- Screen reader live region for announcements -->
    <div
      ref="liveRegion"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ announcement }}
    </div>

    <!-- Mode Toggle -->
    <div class="mode-toggle-section">
      <span id="payment-mode-label" class="sr-only">Payment mode</span>
      <div
        role="radiogroup"
        aria-labelledby="payment-mode-label"
        class="mode-toggle"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'single'"
          class="mode-option"
          :class="{ active: mode === 'single' }"
          @click="switchMode('single')"
        >
          Single Payment
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'split'"
          class="mode-option"
          :class="{ active: mode === 'split' }"
          @click="switchMode('split')"
        >
          Split Payment
        </button>
      </div>
    </div>

    <!-- Single Payment Mode -->
    <Transition name="fade" mode="out-in">
      <div v-if="mode === 'single'" key="single" class="single-payment-section">
        <CashierPaymentMethodSelect
          :model-value="localSinglePayment.method"
          :card-type="localSinglePayment.cardType"
          :check-number="localSinglePayment.checkNumber"
          :cash-tendered="localSinglePayment.cashTendered"
          :grand-total="grandTotal"
          :show-card-type-error="showCardTypeError"
          @update:model-value="updateSinglePaymentMethod"
          @update:card-type="updateSingleCardType"
          @update:check-number="updateSingleCheckNumber"
          @update:cash-tendered="updateSingleCashTendered"
        />
      </div>

      <!-- Split Payment Mode -->
      <div v-else key="split" class="split-payment-section">
        <!-- Payment Summary at the top -->
        <CashierSplitPaymentSummary
          :payments="payments"
          :grand-total="grandTotal"
        />

        <!-- Payment Entries -->
        <div class="payment-entries">
          <TransitionGroup name="list">
            <CashierSplitPaymentEntry
              v-for="(payment, index) in payments"
              :key="payment.id"
              :ref="(el: ComponentPublicInstance | null) => setPaymentEntryRef(index, el)"
              :entry="payment"
              :entry-number="index + 1"
              :can-remove="payments.length > 1"
              :remaining-balance="getRemainingBalanceForEntry(index)"
              :show-card-type-error="showCardTypeError && payment.method === 'CARD' && !payment.cardType"
              @update:entry="updatePayment(index, $event)"
              @remove="removePayment(index)"
            />
          </TransitionGroup>
        </div>

        <!-- Add Payment Button -->
        <button
          type="button"
          class="add-payment-btn"
          @click="addPayment"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span>Add Payment Method</span>
        </button>
      </div>
    </Transition>

    <!-- Mode Switch Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showConfirmDialog"
          class="modal-backdrop"
          @click.self="cancelModeSwitch"
        >
          <div class="modal-panel modal-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div class="modal-header">
              <h3 id="confirm-title" class="modal-title">Switch Payment Mode?</h3>
            </div>
            <div class="modal-body">
              <p class="modal-text">
                Switching payment modes will clear all current payment data.
                Are you sure you want to continue?
              </p>
            </div>
            <div class="modal-footer">
              <button
                type="button"
                class="btn btn-secondary"
                @click="cancelModeSwitch"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary"
                @click="confirmModeSwitch"
              >
                Switch Mode
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * Main container component for split payment functionality.
 *
 * Provides:
 * - Mode toggle between single and split payment
 * - Management of multiple payment entries
 * - Remaining balance calculation
 * - Add/remove payment entries
 */
import type { ComponentPublicInstance } from 'vue'
import type { PaymentMethod, CardType, SplitPaymentEntry, SinglePaymentData } from '~/types/operation'

interface Props {
  /** The grand total to be paid */
  grandTotal: number
  /** Current payment mode */
  modelValue: 'single' | 'split'
  /** Single payment data (for single mode) */
  singlePayment: SinglePaymentData
  /** Array of payment entries (for split mode) */
  payments: SplitPaymentEntry[]
  /** Whether to show card type validation errors */
  showCardTypeError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCardTypeError: false,
})

const emit = defineEmits<{
  /** Emitted when payment mode changes */
  'update:modelValue': [value: 'single' | 'split']
  /** Emitted when single payment data changes */
  'update:singlePayment': [value: SinglePaymentData]
  /** Emitted when payments array changes */
  'update:payments': [value: SplitPaymentEntry[]]
}>()

// Local state
const mode = computed(() => props.modelValue)
const showConfirmDialog = ref(false)
const pendingMode = ref<'single' | 'split' | null>(null)
const announcement = ref('')
const paymentEntryRefs = ref<Record<number, { focusAmount: () => void } | null>>({})


/**
 * Generate a unique ID for payment entries.
 */
function generateId(): string {
  return `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Store ref to payment entry component.
 */
function setPaymentEntryRef(index: number, el: ComponentPublicInstance | null): void {
  paymentEntryRefs.value[index] = el as { focusAmount: () => void } | null
}

/**
 * Check if current data has meaningful values.
 */
function hasPaymentData(): boolean {
  if (mode.value === 'single') {
    // Check if single payment has any data beyond defaults
    return (
      props.singlePayment.cardType !== undefined ||
      (props.singlePayment.checkNumber !== undefined && props.singlePayment.checkNumber !== '') ||
      (props.singlePayment.cashTendered !== undefined && props.singlePayment.cashTendered > 0)
    )
  } else {
    // Check if split payments have any amounts entered
    return props.payments.some((p) => p.amount > 0)
  }
}

/**
 * Handle mode switch with confirmation if data exists.
 */
function switchMode(newMode: 'single' | 'split'): void {
  if (newMode === mode.value) return

  if (hasPaymentData()) {
    pendingMode.value = newMode
    showConfirmDialog.value = true
  } else {
    performModeSwitch(newMode)
  }
}

/**
 * Confirm the mode switch.
 */
function confirmModeSwitch(): void {
  if (pendingMode.value) {
    performModeSwitch(pendingMode.value)
  }
  showConfirmDialog.value = false
  pendingMode.value = null
}

/**
 * Cancel the mode switch.
 */
function cancelModeSwitch(): void {
  showConfirmDialog.value = false
  pendingMode.value = null
}

/**
 * Perform the actual mode switch.
 */
function performModeSwitch(newMode: 'single' | 'split'): void {
  emit('update:modelValue', newMode)

  if (newMode === 'split') {
    // Initialize with one empty payment entry if switching to split
    if (props.payments.length === 0) {
      emit('update:payments', [createEmptyPayment()])
    }
    announce('Split payment mode. Add multiple payment methods.')
  } else {
    // Reset single payment when switching to single
    const resetPayment: SinglePaymentData = {
      method: 'CASH',
      cardType: undefined,
      checkNumber: undefined,
      cashTendered: undefined,
    }
    localSinglePayment.value = resetPayment
    emit('update:singlePayment', resetPayment)
    announce('Single payment mode.')
  }
}

/**
 * Create an empty payment entry.
 */
function createEmptyPayment(): SplitPaymentEntry {
  return {
    id: generateId(),
    method: 'CASH',
    amount: 0,
    cardType: undefined,
    checkNumber: undefined,
    cashTendered: undefined,
  }
}

/**
 * Calculate remaining balance for a specific entry index.
 * This is the total remaining minus amounts from entries before this one.
 */
function getRemainingBalanceForEntry(index: number): number {
  const previousTotal = props.payments
    .slice(0, index)
    .reduce((sum, p) => sum + p.amount, 0)
  const currentAmount = props.payments[index]?.amount || 0
  return Math.max(0, props.grandTotal - previousTotal - currentAmount)
}

/**
 * Update a payment entry.
 */
function updatePayment(index: number, updatedPayment: SplitPaymentEntry): void {
  const newPayments = [...props.payments]
  newPayments[index] = updatedPayment
  emit('update:payments', newPayments)
}

/**
 * Add a new payment entry.
 */
function addPayment(): void {
  const newPayments = [...props.payments, createEmptyPayment()]
  emit('update:payments', newPayments)
  announce('Payment entry added')

  // Focus the new payment entry's amount input after render
  nextTick(() => {
    const newIndex = newPayments.length - 1
    const entryRef = paymentEntryRefs.value[newIndex]
    if (entryRef && typeof entryRef.focusAmount === 'function') {
      entryRef.focusAmount()
    }
  })
}

/**
 * Remove a payment entry.
 */
function removePayment(index: number): void {
  if (props.payments.length <= 1) return

  const newPayments = props.payments.filter((_, i) => i !== index)
  emit('update:payments', newPayments)
  announce(`Payment ${index + 1} removed`)

  // Focus the previous payment entry (or the last one if we removed the first)
  nextTick(() => {
    const focusIndex = Math.max(0, index - 1)
    const entryRef = paymentEntryRefs.value[focusIndex]
    if (entryRef && typeof entryRef.focusAmount === 'function') {
      entryRef.focusAmount()
    }
  })
}

/**
 * Local reactive copy of single payment data.
 * This ensures we always have the latest state when building updates,
 * avoiding race conditions where multiple emit handlers read stale props.
 */
const localSinglePayment = ref<SinglePaymentData>({ ...props.singlePayment })

// Sync local state when props change (e.g., from parent reset)
watch(
  () => props.singlePayment,
  (newVal) => {
    localSinglePayment.value = { ...newVal }
  },
  { deep: true }
)

/**
 * Update single payment method.
 * Handles all field cleanup in one place to avoid race conditions.
 */
function updateSinglePaymentMethod(method: PaymentMethod): void {
  const updates: SinglePaymentData = { ...localSinglePayment.value, method }

  // Clear conditional fields when switching methods
  if (method !== 'CARD') {
    updates.cardType = undefined
  }
  if (method !== 'CHECK') {
    updates.checkNumber = undefined
  }
  if (method !== 'CASH') {
    updates.cashTendered = undefined
  }

  // Update local state immediately
  localSinglePayment.value = updates
  emit('update:singlePayment', updates)
}

/**
 * Update single payment card type.
 */
function updateSingleCardType(cardType: CardType | undefined): void {
  const updates = { ...localSinglePayment.value, cardType }
  localSinglePayment.value = updates
  emit('update:singlePayment', updates)
}

/**
 * Update single payment check number.
 */
function updateSingleCheckNumber(checkNumber: string): void {
  const updates = { ...localSinglePayment.value, checkNumber }
  localSinglePayment.value = updates
  emit('update:singlePayment', updates)
}

/**
 * Update single payment cash tendered.
 */
function updateSingleCashTendered(cashTendered: number | undefined): void {
  const updates = { ...localSinglePayment.value, cashTendered }
  localSinglePayment.value = updates
  emit('update:singlePayment', updates)
}

/**
 * Announce a message to screen readers.
 */
function announce(message: string): void {
  announcement.value = ''
  nextTick(() => {
    announcement.value = message
  })
}

// Expose for potential parent access
defineExpose({
  addPayment,
})
</script>

<style scoped>
.split-payment-container {
  @apply w-full;
}

/* Mode Toggle */
.mode-toggle-section {
  @apply mb-4;
}

.mode-toggle {
  @apply flex p-1 rounded-xl;
  background: rgba(var(--color-surface-200), 0.5);
}

.mode-option {
  @apply flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all min-h-[44px];
  color: rgb(var(--color-surface-600));
}

.mode-option:hover:not(.active) {
  color: rgb(var(--color-surface-700));
  background: rgba(var(--color-surface-100), 0.5);
}

.mode-option:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

.mode-option.active {
  background: rgb(var(--color-surface-50));
  color: rgb(var(--color-primary-600));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* Single Payment Section */
.single-payment-section {
  @apply w-full;
}

/* Split Payment Section */
.split-payment-section {
  @apply space-y-4;
}

.payment-entries {
  @apply space-y-3;
}

/* Add Payment Button */
.add-payment-btn {
  @apply w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all min-h-[44px];
  background: rgba(var(--color-primary-500), 0.08);
  border: 2px dashed rgba(var(--color-primary-500), 0.4);
  color: rgb(var(--color-primary-600));
}

.add-payment-btn:hover {
  background: rgba(var(--color-primary-500), 0.15);
  border-color: rgba(var(--color-primary-500), 0.6);
}

.add-payment-btn:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

/* Modal Styles */
.modal-backdrop {
  @apply fixed inset-0 z-50 flex items-center justify-center p-4;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-panel {
  @apply w-full rounded-2xl overflow-hidden;
  background: rgb(var(--color-surface-50));
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
}

.modal-sm {
  @apply max-w-sm;
}

.modal-header {
  @apply p-4 border-b;
  border-color: rgba(var(--color-surface-200), 0.8);
}

.modal-title {
  @apply text-lg font-semibold;
  color: rgb(var(--color-surface-900));
}

.modal-body {
  @apply p-4;
}

.modal-text {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

.modal-footer {
  @apply flex justify-end gap-3 p-4 border-t;
  border-color: rgba(var(--color-surface-200), 0.8);
  background: rgba(var(--color-surface-100), 0.5);
}

/* Screen reader only */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* List transition for payment entries */
.list-enter-active,
.list-leave-active {
  transition: all 200ms ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.list-move {
  transition: transform 200ms ease;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 200ms ease;
}

.modal-enter-from .modal-panel {
  transform: scale(0.95);
}

.modal-leave-to .modal-panel {
  transform: scale(0.95);
}
</style>
