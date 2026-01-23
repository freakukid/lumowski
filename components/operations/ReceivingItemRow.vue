<template>
  <tr class="receiving-item-row">
    <!-- Item Name -->
    <td class="cell cell-name">
      <span class="item-name">{{ itemName }}</span>
    </td>

    <!-- Current Quantity -->
    <td class="cell cell-current-qty">
      <span class="current-qty">{{ currentQuantity }}</span>
    </td>

    <!-- Quantity to Receive -->
    <td class="cell cell-receive-qty">
      <input
        :value="quantity"
        type="number"
        min="1"
        step="1"
        class="input-compact w-20 text-center"
        @input="handleQuantityChange"
      />
    </td>

    <!-- New Quantity -->
    <td class="cell cell-new-qty">
      <span class="new-qty">{{ newQuantity }}</span>
    </td>

    <!-- Cost Tracking Columns (conditional) -->
    <template v-if="costColumn">
      <!-- Current Cost -->
      <td class="cell cell-cost">
        <span>{{ formatCurrency(currentCost) }}</span>
      </td>

      <!-- Batch Cost Input -->
      <td class="cell cell-batch-cost">
        <input
          :value="costPerItem"
          type="number"
          min="0"
          step="0.01"
          class="input-compact w-20 text-right"
          placeholder="$0.00"
          @input="handleCostChange"
        />
      </td>

      <!-- New Average Cost -->
      <td class="cell cell-new-avg">
        <span>{{ newAverageCost !== null ? formatCurrency(newAverageCost) : '-' }}</span>
      </td>

      <!-- Line Total -->
      <td class="cell cell-line-total">
        <span>{{ lineTotal !== null ? formatCurrency(lineTotal) : '-' }}</span>
      </td>
    </template>

    <!-- Remove Action -->
    <td class="cell cell-actions">
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
    </td>
  </tr>
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

/**
 * Handles cost input changes.
 */
function handleCostChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const value = target.value.trim()
  if (value === '') {
    emit('update:costPerItem', undefined)
  } else {
    const parsed = parseFloat(value)
    emit('update:costPerItem', isNaN(parsed) ? undefined : Math.max(0, parsed))
  }
}
</script>

<style scoped>
.receiving-item-row {
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.receiving-item-row:last-child {
  border-bottom: none;
}

.cell {
  @apply py-3 px-4;
  color: rgb(var(--color-surface-700));
}

.cell-name {
  @apply font-medium;
  color: rgb(var(--color-surface-900));
}

.item-name {
  @apply truncate block max-w-[200px];
}

.cell-current-qty,
.cell-new-qty {
  @apply text-center;
}

.current-qty {
  color: rgb(var(--color-surface-500));
}

.new-qty {
  @apply font-semibold;
  color: rgb(var(--color-accent-500));
}

.cell-receive-qty {
  @apply text-center;
}

.cell-actions {
  @apply text-right;
}

.remove-btn {
  @apply p-2 rounded-lg transition-all;
  color: rgb(var(--color-surface-400));
  background: transparent;
}

.remove-btn:hover {
  color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.1);
}

/* Cost tracking cells */
.cell-cost {
  @apply text-right;
  min-width: 90px;
  color: rgb(var(--color-surface-500));
}

.cell-batch-cost {
  @apply text-center;
  min-width: 100px;
}

.cell-new-avg {
  @apply text-right font-semibold;
  min-width: 90px;
  color: rgb(var(--color-primary-600));
}

.cell-line-total {
  @apply text-right font-semibold;
  min-width: 90px;
  color: rgb(var(--color-surface-700));
}
</style>
