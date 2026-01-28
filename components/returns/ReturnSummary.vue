<template>
  <div class="return-summary">
    <div class="summary-header">
      <div class="summary-icon">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <span class="summary-title">Refund Summary</span>
    </div>

    <!-- Summary Details -->
    <div class="summary-details">
      <div class="summary-row">
        <span class="summary-label">Items</span>
        <span class="summary-value">{{ returnItems.length }}</span>
      </div>

      <div class="summary-row">
        <span class="summary-label">Total Qty</span>
        <span class="summary-value">{{ totalQuantity }}</span>
      </div>

      <div class="summary-row">
        <span class="summary-label">Subtotal</span>
        <span class="summary-value">{{ formatCurrency(safeRefundSubtotal) }}</span>
      </div>

      <div class="summary-row">
        <span class="summary-label">Tax ({{ safeTaxRate }}%)</span>
        <span class="summary-value">{{ formatCurrency(taxAmount) }}</span>
      </div>

      <div class="summary-row total-row">
        <span class="summary-label">Total Refund</span>
        <span class="summary-value total">{{ formatCurrency(totalRefund) }}</span>
      </div>
    </div>

    <!-- Refund Method Display -->
    <div class="refund-method-display">
      <span class="method-label">Refund via:</span>
      <span class="method-value">{{ refundMethodLabel }}</span>
    </div>

    <!-- Inventory Info Box -->
    <div v-if="returnItems.length > 0" class="inventory-info">
      <div v-if="resellableCount > 0" class="inventory-info-row">
        <svg class="inventory-restore-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>
          Inventory will be restored for {{ resellableCount }} resellable {{ resellableCount === 1 ? 'item' : 'items' }}
        </span>
      </div>
      <div v-if="nonResellableCount > 0" class="inventory-info-row">
        <svg class="inventory-no-restore-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <span>
          {{ nonResellableCount }} {{ nonResellableCount === 1 ? 'item' : 'items' }} will NOT be restocked
        </span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="summary-actions">
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="isSubmitting"
        @click="$emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-warning"
        :disabled="!canSubmit || isSubmitting"
        @click="$emit('submit')"
      >
        <UiSpinner v-if="isSubmitting" />
        <span>{{ isSubmitting ? 'Processing...' : 'Process Return' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RefundMethod, ReturnItemCondition, CardType } from '~/types/operation'

interface ReturnSummaryItem {
  itemId: string
  itemName: string
  quantity: number
  refundAmount: number
  condition: ReturnItemCondition
}

interface Props {
  /** Items being returned with calculated refunds */
  returnItems: ReturnSummaryItem[]
  /** Selected refund method */
  refundMethod: RefundMethod
  /** Card type for card refunds */
  cardType?: CardType
  /** Refund subtotal (item amounts before tax) */
  refundSubtotal: number
  /** Tax rate from the original sale (e.g., 10 for 10%) */
  taxRate: number
  /** Whether the form can be submitted */
  canSubmit: boolean
  /** Whether submission is in progress */
  isSubmitting: boolean
}

const props = defineProps<Props>()

defineEmits<{
  'submit': []
  'cancel': []
}>()

const { formatCurrency } = useCurrency()
const { formatRefundMethod } = usePaymentFormatting()

/**
 * Total quantity being returned.
 */
const totalQuantity = computed(() => {
  return props.returnItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
})

/**
 * Safe refund subtotal with defensive check for NaN/undefined.
 */
const safeRefundSubtotal = computed(() => {
  return Number.isFinite(props.refundSubtotal) ? props.refundSubtotal : 0
})

/**
 * Safe tax rate with defensive check for NaN/undefined.
 */
const safeTaxRate = computed(() => {
  return Number.isFinite(props.taxRate) ? props.taxRate : 0
})

/**
 * Tax amount calculated on the refund subtotal.
 */
const taxAmount = computed(() => {
  return safeRefundSubtotal.value * (safeTaxRate.value / 100)
})

/**
 * Total refund amount including tax.
 */
const totalRefund = computed(() => {
  return safeRefundSubtotal.value + taxAmount.value
})

/**
 * Count of resellable items.
 */
const resellableCount = computed(() => {
  return props.returnItems.filter(item => item.condition === 'resellable').length
})

/**
 * Count of non-resellable items (damaged or defective).
 */
const nonResellableCount = computed(() => {
  return props.returnItems.filter(item => item.condition !== 'resellable').length
})

/**
 * Display label for refund method.
 */
const refundMethodLabel = computed(() => {
  return formatRefundMethod(props.refundMethod, props.cardType)
})
</script>

<style scoped>
.return-summary {
  @apply p-5 md:p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.summary-header {
  @apply flex items-center gap-3 mb-4 pb-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.summary-icon {
  @apply flex items-center justify-center w-9 h-9 rounded-lg;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.summary-title {
  @apply font-semibold;
  color: rgb(var(--color-surface-700));
}

.summary-details {
  @apply flex flex-col gap-2 w-full mb-4;
}

.summary-row {
  @apply flex justify-between items-center gap-4;
}

.summary-label {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.summary-value {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.summary-row.total-row {
  @apply pt-3 mt-3;
  border-top: 1px solid rgba(var(--color-surface-300), 0.5);
}

.summary-row.total-row .summary-label {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}

.summary-value.total {
  @apply text-2xl;
  color: rgb(var(--color-warning-600));
}

/* Refund method display */
.refund-method-display {
  @apply flex items-center justify-between gap-3 p-3 rounded-xl mb-4;
  background: rgba(var(--color-surface-200), 0.3);
}

.method-label {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.method-value {
  @apply text-sm font-semibold;
  color: rgb(var(--color-warning-600));
}

/* Inventory info box */
.inventory-info {
  @apply p-4 rounded-xl mb-6;
  background: rgba(var(--color-surface-200), 0.3);
}

.inventory-info-row {
  @apply flex items-start gap-2 text-sm;
  color: rgb(var(--color-surface-600));
}

.inventory-info-row + .inventory-info-row {
  @apply mt-2;
}

.inventory-restore-icon {
  @apply w-4 h-4 flex-shrink-0 mt-0.5;
  color: rgb(var(--color-success-500));
}

.inventory-no-restore-icon {
  @apply w-4 h-4 flex-shrink-0 mt-0.5;
  color: rgb(var(--color-surface-400));
}

/* Action buttons */
.summary-actions {
  @apply flex flex-wrap gap-3;
}

@media (max-width: 479px) {
  .summary-actions {
    @apply flex-col;
  }

  .summary-actions .btn {
    @apply w-full justify-center;
  }
}

@media (min-width: 480px) {
  .summary-actions {
    @apply justify-end;
  }
}

.btn {
  @apply px-5 min-h-[44px] flex items-center justify-center gap-2 rounded-xl font-semibold transition-all;
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

/* Warning-colored primary button for returns */
.btn-warning {
  color: white;
  background: linear-gradient(135deg, rgb(var(--color-warning-500)), rgb(var(--color-warning-600)));
  box-shadow: 0 4px 15px rgba(var(--color-warning-500), 0.3);
}

.btn-warning:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-warning-500), 0.4);
}

.btn-warning:disabled {
  @apply opacity-50 cursor-not-allowed;
  transform: none;
}
</style>
