<template>
  <div :class="['return-item-card', { 'selected': selected }]">
    <!-- Header: Checkbox + Item Name -->
    <div class="return-item-header">
      <label class="return-item-checkbox">
        <input
          type="checkbox"
          :checked="selected"
          :disabled="item.availableQty === 0"
          class="checkbox-input"
          @change="$emit('update:selected', ($event.target as HTMLInputElement).checked)"
        />
        <span :class="['checkbox-box', { 'checked': selected }]">
          <svg v-if="selected" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </span>
      </label>
      <span class="return-item-name">{{ item.itemName }}</span>
    </div>

    <!-- Fields Row -->
    <div class="return-item-fields">
      <!-- Original Qty -->
      <div class="return-field">
        <span class="return-field-label">Original</span>
        <span class="return-field-value">{{ item.originalQty }}</span>
      </div>

      <!-- Returning Qty -->
      <div class="return-field">
        <span class="return-field-label">Returning</span>
        <input
          type="number"
          :value="returnQuantity"
          :min="0"
          :max="item.availableQty"
          :disabled="!selected"
          class="return-qty-input input input-compact"
          aria-label="Quantity to return"
          @input="handleQuantityChange"
        />
      </div>

      <!-- Condition -->
      <div class="return-field return-field-condition">
        <span class="return-field-label">Condition</span>
        <select
          :value="condition"
          :disabled="!selected"
          class="return-condition-select select"
          aria-label="Item condition"
          @change="$emit('update:condition', ($event.target as HTMLSelectElement).value as ReturnItemCondition)"
        >
          <option value="resellable">Resellable</option>
          <option value="damaged">Damaged</option>
          <option value="defective">Defective</option>
        </select>
      </div>
    </div>

    <!-- Summary Row -->
    <div v-if="selected" class="return-item-summary">
      <div class="summary-info">
        <span class="unit-price">{{ formatCurrency(item.pricePerItem) }} each</span>
        <span v-if="item.discount" class="original-discount">
          ({{ formatDiscount(item.discount, item.discountType) }} off)
        </span>
      </div>
      <div class="refund-amount">
        {{ formatCurrency(calculatedRefund) }}
      </div>
    </div>

    <!-- Inventory Restoration Notice -->
    <div v-if="selected" class="inventory-notice">
      <template v-if="condition === 'resellable'">
        <svg class="notice-icon notice-icon-restore" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span class="notice-text">Will be restocked</span>
      </template>
      <template v-else>
        <svg class="notice-icon notice-icon-no-restore" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <span class="notice-text">Will NOT be restocked ({{ condition }})</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReturnableItem, ReturnItemCondition } from '~/types/operation'

interface Props {
  /** The item from the original sale */
  item: ReturnableItem
  /** Whether this item is selected for return */
  selected: boolean
  /** Quantity being returned */
  returnQuantity: number
  /** Item condition */
  condition: ReturnItemCondition
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:selected': [value: boolean]
  'update:returnQuantity': [value: number]
  'update:condition': [value: ReturnItemCondition]
}>()

const { formatCurrency } = useCurrency()
const { calculateItemRefund } = useReturnCalculations()
const { formatDiscount: formatDiscountBase } = useReturnFormatting()

/**
 * Formats a discount value for display using the currency formatter.
 */
function formatDiscount(discount: number, discountType?: 'percent' | 'fixed'): string {
  return formatDiscountBase(discount, discountType, formatCurrency)
}

/**
 * Calculates the refund amount for this item based on quantity and original pricing.
 */
const calculatedRefund = computed(() => {
  return calculateItemRefund(
    props.returnQuantity || 0,
    props.item.pricePerItem,
    props.item.discount,
    props.item.discountType,
    props.item.originalQty
  )
})

/**
 * Handles quantity input changes, clamping to valid range.
 */
function handleQuantityChange(event: Event): void {
  const input = event.target as HTMLInputElement
  let value = parseInt(input.value, 10)

  if (isNaN(value) || value < 0) {
    value = 0
  } else if (value > props.item.availableQty) {
    value = props.item.availableQty
  }

  emit('update:returnQuantity', value)
}
</script>

<style scoped>
.return-item-card {
  @apply rounded-xl p-4;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  transition: all 200ms ease;
}

.return-item-card.selected {
  background: rgba(var(--color-warning-500), 0.06);
  border-color: rgba(var(--color-warning-500), 0.4);
}

.return-item-header {
  @apply flex items-center gap-3 mb-4;
}

.return-item-checkbox {
  @apply flex-shrink-0 cursor-pointer;
}

.checkbox-input {
  @apply sr-only;
}

.checkbox-box {
  @apply flex items-center justify-center w-5 h-5 rounded border-2 transition-colors;
  border-color: rgba(var(--color-surface-300), 0.8);
  background: rgba(var(--color-surface-50), 0.8);
}

.checkbox-box.checked {
  background: rgb(var(--color-warning-500));
  border-color: rgb(var(--color-warning-500));
  color: white;
}

.return-item-name {
  @apply font-semibold truncate flex-1;
  color: rgb(var(--color-surface-900));
}

.return-item-fields {
  @apply flex items-start gap-3;
}

.return-field {
  @apply flex flex-col items-center flex-1;
}

.return-field-condition {
  @apply flex-[1.5];
}

.return-field-label {
  @apply text-xs mb-1.5;
  color: rgb(var(--color-surface-500));
}

.return-field-value {
  @apply text-lg font-semibold;
  color: rgb(var(--color-surface-700));
}

.return-qty-input {
  @apply w-full text-center text-base font-semibold min-h-[44px];
}

.return-qty-input:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.return-condition-select {
  @apply w-full min-h-[44px];
}

.return-condition-select:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.return-item-summary {
  @apply pt-4 mt-4 flex justify-between items-center;
  border-top: 1px dashed rgba(var(--color-surface-300), 0.6);
}

.summary-info {
  @apply flex flex-col gap-0.5;
}

.unit-price {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

.original-discount {
  @apply text-xs;
  color: rgb(var(--color-accent-600));
}

.refund-amount {
  @apply text-xl font-bold;
  color: rgb(var(--color-warning-600));
}

.inventory-notice {
  @apply flex items-center gap-2 mt-3 pt-3 text-xs;
  border-top: 1px solid rgba(var(--color-surface-200), 0.5);
}

.notice-icon {
  @apply w-4 h-4 flex-shrink-0;
}

.notice-icon-restore {
  color: rgb(var(--color-success-500));
}

.notice-icon-no-restore {
  color: rgb(var(--color-surface-400));
}

.notice-text {
  color: rgb(var(--color-surface-500));
}

/* Mobile adjustments */
@media (max-width: 479px) {
  .return-item-fields {
    @apply flex-wrap;
  }

  .return-field {
    @apply min-w-[80px];
  }

  .return-field-condition {
    @apply w-full mt-2 flex-none;
  }
}
</style>
