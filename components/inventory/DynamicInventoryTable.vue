<template>
  <div class="data-table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th
            v-for="column in sortedColumns"
            :key="column.id"
            class="data-table-header data-table-header-sortable"
            :class="{ 'is-sorted': currentSortColumn === column.id }"
            @click="$emit('sort', column.id)"
          >
            <span class="data-table-header-content">
              {{ column.name }}
              <span class="data-table-sort-indicator">
                <SortIcon
                  :active="currentSortColumn === column.id"
                  :direction="sortDirection ?? 'asc'"
                />
              </span>
            </span>
          </th>
          <th v-if="showActions !== false" class="data-table-header data-table-header-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="items.length === 0">
          <td :colspan="sortedColumns.length + (showActions !== false ? 1 : 0)" class="data-table-empty">
            <div class="data-table-empty-content">
              <svg class="data-table-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>No items found</p>
            </div>
          </td>
        </tr>
        <tr
          v-for="item in items"
          :key="item.id"
          class="data-table-row"
          @click="$emit('select', item)"
        >
          <td v-for="column in sortedColumns" :key="column.id" class="data-table-cell">
            <InventoryDynamicCellRenderer
              :value="item.data[column.id]"
              :column="column"
              :is-low-stock="checkLowStock(item)"
            />
          </td>
          <td v-if="showActions !== false" class="data-table-cell data-table-cell-actions" @click.stop>
            <div class="actions-wrapper">
              <button class="action-btn edit-btn" @click="$emit('edit', item)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button class="action-btn delete-btn" @click="$emit('delete', item)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem, SortDirection } from '~/types/schema'
import { useStockStatus } from '~/composables/useStockStatus'

const props = defineProps<{
  items: DynamicInventoryItem[]
  columns: ColumnDefinition[]
  currentSortColumn?: string | null
  sortDirection?: SortDirection
  /** Whether to show edit/delete action buttons (defaults to true for backward compatibility) */
  showActions?: boolean
}>()

defineEmits<{
  select: [item: DynamicInventoryItem]
  edit: [item: DynamicInventoryItem]
  delete: [item: DynamicInventoryItem]
  sort: [columnId: string]
}>()

const sortedColumns = computed(() => {
  return [...props.columns].sort((a, b) => a.order - b.order)
})

const columnsRef = computed(() => props.columns)
const { checkLowStock } = useStockStatus(columnsRef)
</script>

<style scoped>
/* ===== COMPONENT-SPECIFIC STYLES ===== */

/* Actions wrapper layout */
.actions-wrapper {
  @apply flex items-center justify-end gap-2;
}

/* ===== ACTION BUTTONS ===== */
.action-btn {
  @apply p-2 rounded-lg;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn:active {
  transform: translateY(0);
}

.edit-btn {
  color: rgb(var(--color-primary-600));
  background: rgba(var(--color-primary-500), 0.1);
}

.edit-btn:hover {
  background: rgba(var(--color-primary-500), 0.18);
}

html[data-theme="midnight"] .edit-btn {
  color: rgb(var(--color-primary-400));
  background: rgba(var(--color-primary-500), 0.15);
}

html[data-theme="midnight"] .edit-btn:hover {
  background: rgba(var(--color-primary-500), 0.25);
}

.delete-btn {
  color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.1);
}

.delete-btn:hover {
  background: rgba(var(--color-error-500), 0.18);
}

html[data-theme="midnight"] .delete-btn {
  color: rgb(var(--color-error-400));
  background: rgba(var(--color-error-500), 0.15);
}

html[data-theme="midnight"] .delete-btn:hover {
  background: rgba(var(--color-error-500), 0.25);
}
</style>
