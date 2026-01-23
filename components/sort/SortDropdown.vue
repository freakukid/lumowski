<template>
  <div class="sort-dropdown">
    <label class="sort-label">Sort by</label>
    <div class="sort-controls">
      <UiSelect
        :model-value="columnId ?? ''"
        :options="sortOptions"
        select-class="sort-select"
        @update:model-value="onColumnSelect"
      />

      <button
        v-if="columnId !== null"
        class="direction-btn"
        :title="direction === 'asc' ? 'Ascending' : 'Descending'"
        @click="$emit('toggle-direction')"
      >
        <SortIcon
          :active="true"
          :direction="direction"
          class="direction-icon"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ColumnDefinition, SortDirection } from '~/types/schema'

const props = defineProps<{
  columns: ColumnDefinition[]
  columnId: string | null
  direction: SortDirection
}>()

const emit = defineEmits<{
  'update:columnId': [columnId: string | null]
  'toggle-direction': []
}>()

// Build options for UiSelect
const sortOptions = computed(() => {
  return [
    { value: '', label: 'Default order' },
    ...props.columns.map((col) => ({
      value: col.id,
      label: col.name,
    })),
  ]
})

const onColumnSelect = (value: string | number) => {
  const stringValue = String(value)
  emit('update:columnId', stringValue === '' ? null : stringValue)
}
</script>

<style scoped>
.sort-dropdown {
  @apply flex items-center gap-3 mb-4;
}

.sort-label {
  @apply text-sm font-medium whitespace-nowrap;
  color: rgb(var(--color-surface-500));
}

.sort-controls {
  @apply flex items-center gap-2 flex-1;
}

/* Override UiSelect trigger styles for sort dropdown context */
.sort-controls :deep(.ui-select-trigger) {
  background: rgba(var(--color-surface-100), 0.8);
}

.direction-btn {
  @apply w-11 h-11 flex items-center justify-center rounded-xl transition-all flex-shrink-0;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.direction-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.direction-btn:active {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-600));
}

/* Override SortIcon styles for the direction button context */
.direction-icon {
  @apply w-5 h-5;
  color: inherit;
}
</style>
