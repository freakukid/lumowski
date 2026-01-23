<template>
  <div class="cards-container">
    <div v-if="items.length === 0" class="empty-state">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p>No items found</p>
    </div>

    <div
      v-for="item in items"
      :key="item.id"
      class="item-card"
      @click="$emit('select', item)"
    >
      <!-- Header: Name and quantity badge -->
      <div class="card-header">
        <div class="card-title-section">
          <h3 class="card-title">{{ getNameValue(item) || 'Untitled' }}</h3>
        </div>
        <div v-if="quantityColumn" :class="['quantity-badge', checkLowStock(item) ? 'low' : 'ok']">
          {{ item.data[quantityColumn.id] ?? 0 }}
        </div>
      </div>

      <!-- Column values -->
      <div class="card-content">
        <div
          v-for="column in displayColumns"
          :key="column.id"
          class="card-field"
        >
          <span class="field-label">{{ column.name }}</span>
          <span class="field-value">
            <InventoryDynamicCellRenderer
              :value="item.data[column.id]"
              :column="column"
              :is-low-stock="checkLowStock(item)"
            />
          </span>
        </div>
      </div>

      <!-- Actions (only shown for users with manage permission) -->
      <div v-if="showActions !== false" class="card-actions" @click.stop>
        <button class="action-btn edit-btn" @click="$emit('edit', item)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Edit</span>
        </button>
        <button class="action-btn delete-btn" @click="$emit('delete', item)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'
import { useStockStatus } from '~/composables/useStockStatus'

const props = defineProps<{
  items: DynamicInventoryItem[]
  columns: ColumnDefinition[]
  /** Whether to show edit/delete action buttons (defaults to true for backward compatibility) */
  showActions?: boolean
}>()

defineEmits<{
  select: [item: DynamicInventoryItem]
  edit: [item: DynamicInventoryItem]
  delete: [item: DynamicInventoryItem]
}>()

const columnsRef = computed(() => props.columns)
const { checkLowStock, quantityColumn } = useStockStatus(columnsRef)

const nameColumn = computed(() => props.columns.find((c) => c.role === 'name'))

// Display columns excluding name and quantity (shown in header)
const displayColumns = computed(() => {
  return [...props.columns]
    .filter((c) => c.role !== 'name' && c.role !== 'quantity')
    .sort((a, b) => a.order - b.order)
})

const getNameValue = (item: DynamicInventoryItem) => {
  if (!nameColumn.value) {
    // Fallback to first text column
    const firstText = props.columns.find((c) => c.type === 'text')
    return firstText ? item.data[firstText.id] : null
  }
  return item.data[nameColumn.value.id]
}
</script>

<style scoped>
.cards-container {
  @apply space-y-4;
}

.empty-state {
  @apply flex flex-col items-center gap-3 py-12;
}

.empty-icon {
  @apply w-12 h-12;
  color: rgb(var(--color-surface-300));
}

.empty-state p {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-400));
}

.item-card {
  @apply rounded-xl p-4 cursor-pointer transition-all;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.item-card:hover {
  border-color: rgba(var(--color-primary-400), 0.5);
  box-shadow: 0 4px 12px rgba(var(--color-surface-900), 0.05);
}

.card-header {
  @apply flex items-start justify-between gap-3 mb-3;
}

.card-title-section {
  @apply flex-1 min-w-0;
}

.card-title {
  @apply text-lg font-semibold truncate;
  color: rgb(var(--color-surface-900));
}

.quantity-badge {
  @apply px-2.5 py-1 text-sm font-semibold rounded-lg flex-shrink-0;
}

.quantity-badge.ok {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.quantity-badge.low {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.card-content {
  @apply grid grid-cols-2 gap-x-4 gap-y-2 mb-4;
}

.card-field {
  @apply flex flex-col;
}

.field-label {
  @apply text-xs font-medium mb-0.5;
  color: rgb(var(--color-surface-400));
}

.field-value {
  @apply text-sm;
  color: rgb(var(--color-surface-700));
}

.card-actions {
  @apply flex gap-2 pt-3 border-t;
  border-color: rgba(var(--color-surface-200), 0.8);
}

.action-btn {
  @apply flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all;
}

.edit-btn {
  color: rgb(var(--color-primary-600));
  background: rgba(var(--color-primary-500), 0.1);
}

.edit-btn:hover {
  background: rgba(var(--color-primary-500), 0.2);
}

.delete-btn {
  color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.1);
}

.delete-btn:hover {
  background: rgba(var(--color-error-500), 0.2);
}
</style>
