<template>
  <div class="sale-item-card">
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

    <!-- Content: Quantities and Price -->
    <div class="card-content">
      <!-- Available Stock -->
      <div class="qty-field">
        <span class="qty-label">In Stock</span>
        <span :class="['qty-value', 'stock', { 'low-stock': isLowStock }]">{{ currentQuantity }}</span>
      </div>

      <!-- Quantity to Sell -->
      <div class="qty-field qty-field-input">
        <span class="qty-label">Selling</span>
        <input
          :value="quantity"
          type="number"
          min="1"
          :max="currentQuantity"
          step="1"
          class="qty-input input-compact"
          @input="handleQuantityChange"
        />
      </div>

      <!-- Unit Price -->
      <div class="qty-field">
        <span class="qty-label">Price</span>
        <span class="qty-value price">{{ formatCurrency(unitPrice) }}</span>
      </div>
    </div>

    <!-- Discount Section -->
    <div class="discount-section">
      <div class="discount-row">
        <div class="discount-field">
          <span class="discount-label">Discount</span>
          <div class="discount-input-group">
            <input
              v-model.number="localDiscount"
              type="number"
              min="0"
              :max="discountType === 'percent' ? 100 : undefined"
              step="0.01"
              class="discount-input input-compact"
              placeholder="0"
            />
            <button
              type="button"
              :class="['discount-type-btn', { active: discountType === 'percent' }]"
              @click="toggleDiscountType"
            >
              {{ discountType === 'percent' ? '%' : '$' }}
            </button>
          </div>
        </div>
        <div class="discount-field align-right">
          <span class="discount-label">Line Total</span>
          <span class="discount-value total">{{ formatCurrency(lineTotal) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

const props = defineProps<{
  /**
   * The inventory item being sold
   */
  item: DynamicInventoryItem
  /**
   * Quantity to sell for this item
   */
  quantity: number
  /**
   * Column definitions for extracting item data
   */
  columns: ColumnDefinition[]
  /**
   * Discount amount (percentage or fixed)
   */
  discount?: number
  /**
   * Type of discount: 'percent' or 'fixed'
   */
  discountType: 'percent' | 'fixed'
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
   * Emitted when discount changes
   */
  'update:discount': [value: number | undefined]
  /**
   * Emitted when discount type changes
   */
  'update:discountType': [value: 'percent' | 'fixed']
}>()

// Use shared composables for item display and currency formatting
const columnsRef = computed(() => props.columns)
const { getItemName, getItemQuantity, getItemPrice } = useItemDisplay(columnsRef)
const { formatCurrency } = useCurrency()

/**
 * Gets the display name for the item.
 */
const itemName = computed(() => getItemName(props.item))

/**
 * Gets the current quantity of the item (available stock).
 */
const currentQuantity = computed(() => getItemQuantity(props.item))

/**
 * Gets the unit price of the item.
 */
const unitPrice = computed(() => getItemPrice(props.item))

/**
 * Check if stock is low (less than quantity being sold).
 */
const isLowStock = computed(() => currentQuantity.value < props.quantity)

/**
 * Local discount value with two-way binding to parent.
 */
const localDiscount = computed({
  get: () => props.discount,
  set: (value: number | undefined) => {
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
      emit('update:discount', undefined)
    } else {
      emit('update:discount', Math.max(0, value))
    }
  },
})

/**
 * Local discount type for internal use.
 */
const discountType = computed(() => props.discountType)

/**
 * Toggles between percent and fixed discount types.
 */
function toggleDiscountType(): void {
  emit('update:discountType', props.discountType === 'percent' ? 'fixed' : 'percent')
}

/**
 * Calculates the line total after discount.
 */
const lineTotal = computed(() => {
  const grossTotal = unitPrice.value * props.quantity
  if (!props.discount || props.discount <= 0) {
    return grossTotal
  }

  let discountAmount: number
  if (props.discountType === 'percent') {
    discountAmount = grossTotal * (props.discount / 100)
  } else {
    discountAmount = props.discount
  }

  return Math.max(0, grossTotal - discountAmount)
})

/**
 * Handles quantity input changes, ensuring value is between 1 and available stock.
 */
function handleQuantityChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const value = Math.max(1, Math.min(currentQuantity.value, parseInt(target.value) || 1))
  emit('update:quantity', value)
}
</script>

<style scoped>
.sale-item-card {
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

.qty-value.stock {
  color: rgb(var(--color-surface-600));
}

.qty-value.stock.low-stock {
  color: rgb(var(--color-error-500));
}

.qty-value.price {
  color: rgb(var(--color-primary-600));
}

/* qty-input extends .input-compact with mobile-specific overrides */
.qty-input {
  @apply w-full text-center text-base font-semibold min-h-[44px];
}

/* Discount Section Styles */
.discount-section {
  @apply pt-4 mt-4;
  border-top: 1px dashed rgba(var(--color-surface-300), 0.6);
}

.discount-row {
  @apply flex flex-wrap gap-3 items-end;
}

.discount-field {
  @apply flex flex-col;
  flex: 1 1 auto;
  min-width: 0;
}

.discount-field.align-right {
  @apply items-end text-right;
}

.discount-label {
  @apply text-xs mb-1;
  color: rgb(var(--color-surface-500));
}

.discount-input-group {
  @apply flex items-center gap-1;
  min-width: 0;
}

.discount-input {
  @apply text-center text-sm min-h-[44px];
  width: 4.5rem;
  min-width: 3rem;
  flex-shrink: 1;
}

.discount-type-btn {
  @apply min-w-[44px] min-h-[44px] px-3 rounded-lg font-semibold text-sm transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.discount-type-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.discount-type-btn.active {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.discount-value {
  @apply text-xl font-bold;
}

.discount-value.total {
  color: rgb(var(--color-accent-500));
}

/* Very small screens: stack discount fields */
@media (max-width: 359px) {
  .discount-row {
    @apply flex-col gap-3;
  }

  .discount-field {
    @apply w-full;
  }

  .discount-field.align-right {
    /* Keep right alignment even on small screens for Line Total */
    @apply items-end text-right;
  }

  .discount-input-group {
    @apply w-full;
  }

  .discount-input {
    @apply flex-1;
    width: auto;
  }
}

/* Desktop: more compact inputs */
@media (min-width: 640px) {
  .sale-item-card {
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

  .discount-section {
    @apply pt-3 mt-3;
  }

  .discount-input {
    @apply w-20 min-h-0 py-1.5 px-2;
  }

  .discount-type-btn {
    @apply min-w-0 min-h-0 px-2 py-1.5;
  }
}
</style>
