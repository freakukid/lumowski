<template>
  <div class="item-selector">
    <!-- Search Input -->
    <div class="search-wrapper">
      <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search items..."
        class="search-input"
      />
    </div>

    <!-- Items List -->
    <div class="items-list">
      <div
        v-if="filteredItems.length === 0"
        class="no-items"
      >
        <p>{{ searchQuery ? 'No items match your search' : 'No items available' }}</p>
      </div>

      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="item-row"
        :class="{ 'item-row-selected': isSelected(item.id) }"
        @click="toggleItem(item.id)"
      >
        <!-- Checkbox -->
        <div class="item-checkbox">
          <div :class="['checkbox', { checked: isSelected(item.id) }]">
            <svg
              v-if="isSelected(item.id)"
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <!-- Item Info -->
        <div class="item-info">
          <span class="item-name">{{ getItemName(item) }}</span>
          <span class="item-quantity">
            Current qty: {{ getItemQuantity(item) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

const props = defineProps<{
  /**
   * Array of selected item IDs
   */
  modelValue: string[]
  /**
   * Available inventory items to select from
   */
  items: DynamicInventoryItem[]
  /**
   * Column definitions for displaying item info
   */
  columns: ColumnDefinition[]
}>()

const emit = defineEmits<{
  /**
   * Emitted when selection changes
   */
  'update:modelValue': [value: string[]]
}>()

const searchQuery = ref('')

// Use shared composable for item display logic
const columnsRef = computed(() => props.columns)
const { getItemName, getItemQuantity } = useItemDisplay(columnsRef)

/**
 * Filters items based on search query matching item names.
 */
const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.items
  }
  const query = searchQuery.value.toLowerCase()
  return props.items.filter((item) => {
    const name = getItemName(item)
    return name.toLowerCase().includes(query)
  })
})

/**
 * Checks if an item is currently selected.
 */
function isSelected(itemId: string): boolean {
  return props.modelValue.includes(itemId)
}

/**
 * Toggles an item's selection state.
 */
function toggleItem(itemId: string): void {
  if (isSelected(itemId)) {
    emit('update:modelValue', props.modelValue.filter((id) => id !== itemId))
  } else {
    emit('update:modelValue', [...props.modelValue, itemId])
  }
}
</script>

<style scoped>
.item-selector {
  @apply flex flex-col h-full;
  min-width: 0;
  width: 100%;
}

.search-wrapper {
  @apply relative mb-4;
}

.search-icon {
  @apply absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5;
  color: rgb(var(--color-surface-400));
}

.search-input {
  @apply w-full pl-11 pr-4 min-h-[44px] rounded-xl text-sm font-medium transition-all outline-none;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.search-input::placeholder {
  color: rgb(var(--color-surface-400));
}

.search-input:focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.items-list {
  @apply flex-1 overflow-y-auto -mx-1 px-1;
  max-height: 300px;
}

.no-items {
  @apply py-8 text-center text-sm;
  color: rgb(var(--color-surface-400));
}

.item-row {
  @apply flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-2;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid transparent;
}

.item-row:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.item-row-selected {
  background: rgba(var(--color-primary-500), 0.08);
  border-color: rgba(var(--color-primary-500), 0.3);
}

.item-row-selected:hover {
  background: rgba(var(--color-primary-500), 0.12);
}

.item-checkbox {
  @apply flex-shrink-0;
}

.checkbox {
  @apply w-5 h-5 rounded flex items-center justify-center transition-all;
  background: rgba(var(--color-surface-200), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.8);
}

.checkbox.checked {
  background: rgb(var(--color-primary-500));
  border-color: rgb(var(--color-primary-500));
  color: white;
}

.item-info {
  @apply flex-1 min-w-0;
}

.item-name {
  @apply block font-medium truncate;
  color: rgb(var(--color-surface-900));
}

.item-quantity {
  @apply block text-xs mt-0.5;
  color: rgb(var(--color-surface-500));
}
</style>
