<template>
  <div class="filter-container" ref="containerRef">
    <!-- Filter Button -->
    <button
      class="filter-btn"
      :class="{ active: isFilterActive }"
      title="Filter search columns"
      @click="toggleDropdown"
    >
      <!-- Funnel Icon -->
      <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      <!-- Active Indicator Dot -->
      <span v-if="isFilterActive" class="active-dot"></span>
    </button>

    <!-- Dropdown -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="filter-dropdown">
        <!-- Mode Selector -->
        <div class="dropdown-section">
          <label class="section-label">Search in</label>
          <div class="mode-options">
            <label class="mode-option">
              <input
                type="radio"
                name="filter-mode"
                value="all"
                :checked="filterPreference.mode === 'all'"
                @change="handleModeChange('all')"
              />
              <span class="mode-label">All columns</span>
            </label>
            <label class="mode-option">
              <input
                type="radio"
                name="filter-mode"
                value="include"
                :checked="filterPreference.mode === 'include'"
                @change="handleModeChange('include')"
              />
              <span class="mode-label">Only selected</span>
            </label>
            <label class="mode-option">
              <input
                type="radio"
                name="filter-mode"
                value="exclude"
                :checked="filterPreference.mode === 'exclude'"
                @change="handleModeChange('exclude')"
              />
              <span class="mode-label">All except selected</span>
            </label>
          </div>
        </div>

        <!-- Column Selection -->
        <div v-if="filterPreference.mode !== 'all'" class="dropdown-section">
          <label class="section-label">Columns</label>
          <div class="column-list">
            <label
              v-for="column in textColumns"
              :key="column.id"
              class="column-option"
            >
              <input
                type="checkbox"
                :checked="filterPreference.columnIds.includes(column.id)"
                @change="handleColumnToggle(column.id)"
              />
              <span class="column-name">{{ column.name }}</span>
            </label>
          </div>
        </div>

        <!-- Reset Button -->
        <div v-if="isFilterActive" class="dropdown-footer">
          <button class="reset-btn" @click="handleReset">
            Reset filter
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, SearchFilterMode, SearchFilterPreference } from '~/types/schema'

const props = defineProps<{
  columns: ColumnDefinition[]
  filterPreference: SearchFilterPreference
  isFilterActive: boolean
}>()

const emit = defineEmits<{
  'update:mode': [mode: SearchFilterMode]
  'toggle-column': [columnId: string]
  reset: []
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

// Filter to only text columns (searchable)
const textColumns = computed(() => {
  return props.columns.filter((c) => c.type === 'text')
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const handleModeChange = (mode: SearchFilterMode) => {
  emit('update:mode', mode)
}

const handleColumnToggle = (columnId: string) => {
  emit('toggle-column', columnId)
}

const handleReset = () => {
  emit('reset')
  isOpen.value = false
}

// Close on click outside
const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

// Close on Escape key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.filter-container {
  @apply relative;
}

.filter-btn {
  @apply relative w-11 h-11 flex items-center justify-center rounded-xl transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.filter-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-600));
}

.filter-btn.active {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-600));
}

.filter-btn.active:hover {
  background: rgba(var(--color-primary-500), 0.2);
}

.filter-icon {
  @apply w-5 h-5;
}

.active-dot {
  @apply absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full;
  background: rgb(var(--color-primary-500));
  box-shadow: 0 0 0 2px rgb(var(--color-surface-50));
}

.filter-dropdown {
  @apply absolute top-full right-0 mt-2 w-64 rounded-xl overflow-hidden z-50;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.dropdown-section {
  @apply p-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.5);
}

.dropdown-section:last-child {
  border-bottom: none;
}

.section-label {
  @apply block text-xs font-semibold uppercase tracking-wide mb-3;
  color: rgb(var(--color-surface-400));
}

.mode-options {
  @apply space-y-2;
}

.mode-option {
  @apply flex items-center gap-3 cursor-pointer;
}

.mode-option input[type="radio"] {
  @apply w-4 h-4 cursor-pointer;
  accent-color: rgb(var(--color-primary-500));
}

.mode-label {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

.column-list {
  @apply space-y-2 max-h-48 overflow-y-auto;
}

.column-option {
  @apply flex items-center gap-3 cursor-pointer;
}

.column-option input[type="checkbox"] {
  @apply w-4 h-4 rounded cursor-pointer;
  accent-color: rgb(var(--color-primary-500));
}

.column-name {
  @apply text-sm;
  color: rgb(var(--color-surface-700));
}

.dropdown-footer {
  @apply p-3;
  background: rgba(var(--color-surface-100), 0.5);
}

.reset-btn {
  @apply w-full py-2 px-3 text-sm font-medium rounded-lg transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.reset-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

/* Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
