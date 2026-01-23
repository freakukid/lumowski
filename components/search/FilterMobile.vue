<template>
  <div class="filter-mobile">
    <!-- Filter Toggle Button -->
    <button
      class="filter-toggle-btn"
      :class="{ active: isFilterActive, expanded: isExpanded }"
      @click="isExpanded = !isExpanded"
      aria-label="Toggle search filter options"
      :aria-expanded="isExpanded"
    >
      <!-- Funnel Icon -->
      <svg class="filter-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
      <!-- Active Indicator Dot -->
      <span v-if="isFilterActive" class="active-dot"></span>
    </button>

    <!-- Expandable Section - Teleported to target container -->
    <Teleport :to="teleportTarget" :disabled="!teleportTarget">
      <Transition name="expand">
        <div v-if="isExpanded" class="filter-expanded">
          <!-- Mode Selector -->
          <div class="filter-section">
            <label class="section-label" for="filter-mode-select">Search in</label>
            <UiSelect
              id="filter-mode-select"
              :model-value="filterPreference.mode"
              :options="modeOptions"
              select-class="mode-select"
              @update:model-value="handleModeSelect"
            />
          </div>

          <!-- Column Chips -->
          <div v-if="filterPreference.mode !== 'all'" class="filter-section">
            <span class="section-label" id="column-selection-label">Columns</span>
            <div class="column-chips" role="group" aria-labelledby="column-selection-label">
              <button
                v-for="column in textColumns"
                :key="column.id"
                class="column-chip"
                :class="{ selected: filterPreference.columnIds.includes(column.id) }"
                :aria-pressed="filterPreference.columnIds.includes(column.id)"
                @click="handleColumnToggle(column.id)"
              >
                {{ column.name }}
              </button>
            </div>
          </div>

          <!-- Reset Button -->
          <button
            v-if="isFilterActive"
            class="reset-btn"
            @click="handleReset"
          >
            Reset filter
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ColumnDefinition, SearchFilterMode, SearchFilterPreference } from '~/types/schema'

const props = defineProps<{
  columns: ColumnDefinition[]
  filterPreference: SearchFilterPreference
  isFilterActive: boolean
  teleportTarget?: string | HTMLElement | null
}>()

const emit = defineEmits<{
  'update:mode': [mode: SearchFilterMode]
  'toggle-column': [columnId: string]
  reset: []
}>()

const isExpanded = ref(false)

// Mode options for UiSelect
const modeOptions = [
  { value: 'all', label: 'All columns' },
  { value: 'include', label: 'Only selected' },
  { value: 'exclude', label: 'All except selected' },
]

// Filter to only text columns (searchable)
const textColumns = computed(() => {
  return props.columns.filter((c) => c.type === 'text')
})

const handleModeSelect = (value: string | number) => {
  emit('update:mode', String(value) as SearchFilterMode)
}

const handleColumnToggle = (columnId: string) => {
  emit('toggle-column', columnId)
}

const handleReset = () => {
  emit('reset')
  isExpanded.value = false
}
</script>

<style scoped>
.filter-mobile {
  @apply flex flex-col;
}

.filter-toggle-btn {
  @apply relative w-12 h-12 flex items-center justify-center rounded-xl transition-all flex-shrink-0;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.filter-toggle-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.filter-toggle-btn:focus-visible {
  outline: 2px solid rgb(var(--color-primary-500));
  outline-offset: 2px;
}

.filter-toggle-btn.active {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-600));
}

.filter-toggle-btn.expanded {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.filter-icon {
  @apply w-5 h-5;
}

.active-dot {
  @apply absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full;
  background: rgb(var(--color-primary-500));
  box-shadow: 0 0 0 2px rgb(var(--color-surface-50));
}

/*
 * Note: .filter-expanded uses :global because it gets teleported
 * outside this component's DOM tree, making scoped styles not apply.
 */
:global(.filter-expanded) {
  @apply mt-3 p-4 rounded-xl w-full;
  background: rgba(var(--color-surface-100), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.5);
}

/*
 * These styles use :global because they target elements inside
 * the teleported .filter-expanded container.
 */
:global(.filter-expanded .filter-section) {
  @apply mb-4;
}

:global(.filter-expanded .filter-section:last-child) {
  @apply mb-0;
}

:global(.filter-expanded .section-label) {
  @apply block text-xs font-semibold uppercase tracking-wide mb-2;
  color: rgb(var(--color-surface-400));
}

/* UiSelect trigger override for filter context */
:global(.filter-expanded .mode-select .ui-select-trigger) {
  @apply min-h-[48px];
  background: rgb(var(--color-surface-50));
}

:global(.filter-expanded .column-chips) {
  @apply flex flex-wrap gap-2;
}

:global(.filter-expanded .column-chip) {
  @apply min-h-[44px] px-4 rounded-xl text-sm font-medium transition-all;
  background: rgb(var(--color-surface-50));
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-600));
}

:global(.filter-expanded .column-chip:focus-visible) {
  outline: 2px solid rgb(var(--color-primary-500));
  outline-offset: 2px;
}

:global(.filter-expanded .column-chip:active) {
  transform: scale(0.98);
}

:global(.filter-expanded .column-chip.selected) {
  background: rgba(var(--color-primary-500), 0.1);
  border-color: rgb(var(--color-primary-500));
  color: rgb(var(--color-primary-700));
}

:global(.filter-expanded .reset-btn) {
  @apply w-full min-h-[44px] px-4 rounded-xl text-sm font-medium transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

:global(.filter-expanded .reset-btn:focus-visible) {
  outline: 2px solid rgb(var(--color-primary-500));
  outline-offset: 2px;
}

:global(.filter-expanded .reset-btn:active) {
  background: rgba(var(--color-surface-300), 0.5);
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.2s ease, max-height 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
}
</style>
