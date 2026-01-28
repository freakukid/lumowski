<template>
  <div class="return-item-list">
    <div class="return-list-header">
      <div class="header-left">
        <div class="section-icon">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <span class="section-title">Select Items to Return</span>
      </div>

      <div class="return-list-actions">
        <button
          v-if="availableItems.length > 0"
          type="button"
          class="select-all-btn"
          @click="toggleSelectAll"
        >
          {{ allSelected ? 'Deselect All' : 'Select All' }}
        </button>
        <span v-if="selectedCount > 0" class="selection-count">
          {{ selectedCount }} of {{ availableItems.length }}
        </span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="items.length === 0" class="return-list-empty">
      <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p>All items from this sale have already been returned</p>
    </div>

    <!-- Items Grid -->
    <div v-else class="return-items-grid">
      <!-- Available Items -->
      <ReturnsReturnItemCard
        v-for="item in availableItems"
        :key="item.itemId"
        :item="item"
        :selected="getItemData(item.itemId).selected"
        :return-quantity="getItemData(item.itemId).quantity"
        :condition="getItemData(item.itemId).condition"
        @update:selected="updateItemSelected(item.itemId, $event)"
        @update:return-quantity="updateItemQuantity(item.itemId, $event)"
        @update:condition="updateItemCondition(item.itemId, $event)"
      />

      <!-- Already Fully Returned Items -->
      <template v-if="fullyReturnedItems.length > 0">
        <div class="already-returned-section">
          <span class="already-returned-label">Already Fully Returned</span>
          <div
            v-for="item in fullyReturnedItems"
            :key="item.itemId"
            class="already-returned-item"
          >
            <span class="item-name">{{ item.itemName }}</span>
            <span class="item-qty">{{ item.originalQty }} returned</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReturnableItem, ReturnItemCondition } from '~/types/operation'
import { createDefaultReturnItemData, type ReturnItemData } from '~/composables/useReturn'

interface Props {
  /** Items available for return */
  items: ReturnableItem[]
  /** Map of itemId to return data */
  returnData: Map<string, ReturnItemData>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:returnData': [data: Map<string, ReturnItemData>]
}>()

/**
 * Single-pass categorization of items by availability.
 * More efficient than two separate filter operations.
 */
const itemsByAvailability = computed(() => {
  const available: ReturnableItem[] = []
  const fullyReturned: ReturnableItem[] = []
  for (const item of props.items) {
    if (item.availableQty > 0) {
      available.push(item)
    } else {
      fullyReturned.push(item)
    }
  }
  return { available, fullyReturned }
})

/**
 * Items that can still be returned (availableQty > 0).
 */
const availableItems = computed(() => itemsByAvailability.value.available)

/**
 * Items that have been fully returned already.
 */
const fullyReturnedItems = computed(() => itemsByAvailability.value.fullyReturned)

/**
 * Count of selected items.
 */
const selectedCount = computed(() => {
  let count = 0
  for (const data of props.returnData.values()) {
    if (data.selected && data.quantity > 0) {
      count++
    }
  }
  return count
})

/**
 * Whether all available items are selected.
 */
const allSelected = computed(() => {
  if (availableItems.value.length === 0) return false
  return availableItems.value.every(item => {
    const data = props.returnData.get(item.itemId)
    return data?.selected && data.quantity > 0
  })
})

/**
 * Gets the return data for an item, with defaults.
 */
function getItemData(itemId: string): ReturnItemData {
  const data = props.returnData.get(itemId)
  return data || createDefaultReturnItemData()
}

/**
 * Updates the selection state for an item.
 */
function updateItemSelected(itemId: string, selected: boolean): void {
  const newData = new Map(props.returnData)
  const existing = newData.get(itemId) || createDefaultReturnItemData()
  const item = props.items.find(i => i.itemId === itemId)

  newData.set(itemId, {
    ...existing,
    selected,
    // Auto-set quantity to max available when selecting, 0 when deselecting
    quantity: selected ? (existing.quantity || item?.availableQty || 1) : 0,
  })

  emit('update:returnData', newData)
}

/**
 * Updates the quantity for an item.
 */
function updateItemQuantity(itemId: string, quantity: number): void {
  const newData = new Map(props.returnData)
  const existing = newData.get(itemId) || createDefaultReturnItemData()

  newData.set(itemId, {
    ...existing,
    quantity,
    // Auto-select if quantity > 0
    selected: quantity > 0 ? true : existing.selected,
  })

  emit('update:returnData', newData)
}

/**
 * Updates the condition for an item.
 */
function updateItemCondition(itemId: string, condition: ReturnItemCondition): void {
  const newData = new Map(props.returnData)
  const existing = newData.get(itemId) || createDefaultReturnItemData()

  newData.set(itemId, {
    ...existing,
    condition,
  })

  emit('update:returnData', newData)
}

/**
 * Toggles selection of all available items.
 */
function toggleSelectAll(): void {
  const newData = new Map(props.returnData)
  const selectAll = !allSelected.value

  for (const item of availableItems.value) {
    const existing = newData.get(item.itemId) || createDefaultReturnItemData()

    newData.set(item.itemId, {
      ...existing,
      selected: selectAll,
      quantity: selectAll ? item.availableQty : 0,
    })
  }

  emit('update:returnData', newData)
}
</script>

<style scoped>
.return-item-list {
  @apply p-5 md:p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.return-list-header {
  @apply flex items-center justify-between gap-3 mb-4 pb-3 flex-wrap;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.header-left {
  @apply flex items-center gap-3;
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

.return-list-actions {
  @apply flex items-center gap-2;
}

.select-all-btn {
  @apply text-sm font-medium px-3 py-1.5 rounded-lg transition-colors min-h-[44px];
  color: rgb(var(--color-warning-600));
  background: rgba(var(--color-warning-500), 0.1);
}

.select-all-btn:hover {
  background: rgba(var(--color-warning-500), 0.2);
}

.selection-count {
  @apply text-sm px-2 py-0.5 rounded-full;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.return-items-grid {
  @apply space-y-3;
}

.return-list-empty {
  @apply flex flex-col items-center justify-center text-center py-8;
  color: rgb(var(--color-surface-400));
}

.return-list-empty svg {
  @apply mb-3;
  opacity: 0.5;
}

.return-list-empty p {
  @apply text-sm;
}

/* Already returned items section */
.already-returned-section {
  @apply mt-6 pt-4;
  border-top: 1px dashed rgba(var(--color-surface-300), 0.5);
}

.already-returned-label {
  @apply text-xs font-medium uppercase tracking-wide mb-3 block;
  color: rgb(var(--color-surface-400));
}

.already-returned-item {
  @apply flex items-center justify-between gap-3 p-3 rounded-lg opacity-50;
  background: rgba(var(--color-surface-100), 0.5);
}

.already-returned-item .item-name {
  @apply text-sm truncate;
  color: rgb(var(--color-surface-600));
}

.already-returned-item .item-qty {
  @apply text-xs;
  color: rgb(var(--color-surface-400));
}

/* Focus visible styles for accessibility */
.select-all-btn:focus-visible,
button:focus-visible {
  outline: 2px solid rgb(var(--color-warning-500));
  outline-offset: 2px;
}
</style>
