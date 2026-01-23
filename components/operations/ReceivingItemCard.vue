<template>
  <div class="receiving-item-card">
    <!-- Header: Item name and remove button -->
    <div class="card-header">
      <span class="item-name">{{ itemName }}</span>
      <button
        type="button"
        class="remove-btn"
        title="Remove item"
        @click="$emit('remove')"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Content: Quantities -->
    <div class="card-content">
      <!-- Current Quantity -->
      <div class="qty-field">
        <span class="qty-label">Current</span>
        <span class="qty-value current">{{ currentQuantity }}</span>
      </div>

      <!-- Quantity to Receive -->
      <div class="qty-field qty-field-input">
        <span class="qty-label">Receiving</span>
        <input
          :value="quantity"
          type="number"
          min="1"
          step="1"
          class="qty-input input-compact"
          @input="handleQuantityChange"
        />
      </div>

      <!-- Arrow -->
      <div class="qty-arrow">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
      </div>

      <!-- New Quantity -->
      <div class="qty-field">
        <span class="qty-label">New Total</span>
        <span class="qty-value new">{{ newQuantity }}</span>
      </div>
    </div>

    <!-- Cost Section (conditional) -->
    <div v-if="costColumn" class="cost-section">
      <div class="cost-row">
        <div class="cost-field">
          <span class="cost-label">Current Cost</span>
          <span class="cost-value">{{ formatCurrency(currentCost) }}</span>
        </div>
        <div class="cost-field cost-field-input-wrapper">
          <span class="cost-label">Batch Cost</span>
          <input
            v-model.number="localCost"
            type="number"
            min="0"
            step="0.01"
            class="cost-input-mobile input-compact"
            placeholder="$0.00"
          />
        </div>
      </div>
      <div class="cost-row">
        <div class="cost-field">
          <span class="cost-label">New Avg Cost</span>
          <span class="cost-value primary">{{ newAverageCost !== null ? formatCurrency(newAverageCost) : '-' }}</span>
        </div>
        <div class="cost-field align-right">
          <span class="cost-label">Line Total</span>
          <span class="cost-value">{{ lineTotal !== null ? formatCurrency(lineTotal) : '-' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

const props = defineProps<{
  /**
   * The inventory item being received
   */
  item: DynamicInventoryItem
  /**
   * Quantity to receive for this item
   */
  quantity: number
  /**
   * Column definitions for extracting item data
   */
  columns: ColumnDefinition[]
  /**
   * Cost column definition (only present when cost tracking is enabled)
   */
  costColumn?: ColumnDefinition
  /**
   * Cost per item for this batch
   */
  costPerItem?: number
}>()

const emit = defineEmits<{
  /**
   * Emitted when quantity changes
   */
  'update:quantity': [value: number]
  /**
   * Emitted when item should be removed from the list
   */
  'remove': []
  /**
   * Emitted when cost per item changes
   */
  'update:costPerItem': [value: number | undefined]
}>()

// Use shared composable for item display logic
const columnsRef = computed(() => props.columns)
const { getItemName, getItemQuantity } = useItemDisplay(columnsRef)

/**
 * Gets the display name for the item.
 */
const itemName = computed(() => getItemName(props.item))

/**
 * Gets the current quantity of the item.
 */
const currentQuantity = computed(() => getItemQuantity(props.item))

/**
 * Calculates the new quantity after receiving.
 */
const newQuantity = computed(() => {
  return currentQuantity.value + props.quantity
})

/**
 * Gets the current cost of the item from the cost column.
 */
const currentCost = computed(() => {
  if (!props.costColumn) return 0
  return Number(props.item.data[props.costColumn.id]) || 0
})

/**
 * Local cost value with two-way binding to parent.
 */
const localCost = computed({
  get: () => props.costPerItem,
  set: (value: number | undefined) => {
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
      emit('update:costPerItem', undefined)
    } else {
      emit('update:costPerItem', Math.max(0, value))
    }
  },
})

/**
 * Calculates the new weighted average cost after receiving.
 * Formula: (prevQty * prevCost + newQty * newCost) / (prevQty + newQty)
 */
const newAverageCost = computed(() => {
  if (props.costPerItem === undefined) return null
  const prevQty = currentQuantity.value
  const newQty = props.quantity
  const totalQty = prevQty + newQty
  if (totalQty === 0) return 0
  return (prevQty * currentCost.value + newQty * props.costPerItem) / totalQty
})

/**
 * Calculates the line total (quantity * cost per item).
 */
const lineTotal = computed(() => {
  if (props.costPerItem === undefined) return null
  return props.quantity * props.costPerItem
})

/**
 * Formats a number as USD currency.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

/**
 * Handles quantity input changes, ensuring minimum value of 1.
 */
function handleQuantityChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const value = Math.max(1, parseInt(target.value) || 1)
  emit('update:quantity', value)
}
</script>

<style scoped>
.receiving-item-card {
  @apply rounded-xl p-4;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.card-header {
  @apply flex items-center justify-between gap-3 mb-4;
}

.item-name {
  @apply font-semibold truncate flex-1;
  color: rgb(var(--color-surface-900));
}

.remove-btn {
  @apply p-2 rounded-lg transition-all flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center;
  color: rgb(var(--color-surface-400));
  background: transparent;
}

.remove-btn:hover {
  color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.1);
}

.card-content {
  @apply flex items-center gap-3;
}

.qty-field {
  @apply flex flex-col items-center flex-1;
}

.qty-field-input {
  @apply flex-[1.5];
}

.qty-label {
  @apply text-xs mb-1;
  color: rgb(var(--color-surface-500));
}

.qty-value {
  @apply text-lg font-semibold;
}

.qty-value.current {
  color: rgb(var(--color-surface-600));
}

.qty-value.new {
  color: rgb(var(--color-accent-500));
}

.qty-arrow {
  @apply flex-shrink-0 pt-4;
  color: rgb(var(--color-surface-400));
}

/* qty-input extends .input-compact with mobile-specific overrides */
.qty-input {
  @apply w-full text-center text-base font-semibold min-h-[44px];
}

/* Desktop: more compact inputs */
@media (min-width: 640px) {
  .receiving-item-card {
    @apply p-3;
  }

  .card-header {
    @apply mb-3;
  }

  .remove-btn {
    @apply min-w-0 min-h-0 p-1.5;
  }

  .qty-input {
    @apply w-20 min-h-0 py-1.5 px-2 text-sm;
  }

  .qty-field-input {
    @apply flex-none;
  }

  .cost-input-mobile {
    width: 96px !important;
    min-width: 96px !important;
    max-width: 96px !important;
    @apply min-h-0 py-1.5 px-2 text-sm;
  }

  /* Prevent the batch cost field from stretching on desktop */
  .cost-field-input-wrapper {
    flex: 0 0 auto !important;
    width: auto !important;
  }

  .cost-section {
    @apply pt-3 mt-3;
  }

  .cost-row + .cost-row {
    @apply mt-2;
  }
}

/* Cost Section Styles */
.cost-section {
  @apply pt-4 mt-4;
  border-top: 1px dashed rgba(var(--color-surface-300), 0.6);
}

.cost-row {
  @apply flex gap-4;
}

.cost-row + .cost-row {
  @apply mt-3;
}

.cost-field {
  @apply flex flex-col flex-1;
}

.cost-field.align-right {
  @apply items-end;
}

.cost-label {
  @apply text-xs mb-1;
  color: rgb(var(--color-surface-500));
}

.cost-value {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-600));
}

.cost-value.primary {
  color: rgb(var(--color-primary-600));
}

/* cost-input-mobile extends .input-compact with mobile-specific overrides */
.cost-input-mobile {
  @apply w-full text-base min-h-[44px];
}
</style>
