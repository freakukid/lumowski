<template>
  <!-- Active state: directional chevron that rotates based on sort direction -->
  <svg
    v-if="active"
    class="sort-icon active"
    :class="{ 'sort-desc': direction === 'desc' }"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
  </svg>
  <!-- Inactive state: bidirectional arrows shown on hover -->
  <svg
    v-else
    class="sort-icon inactive"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
</template>

<script setup lang="ts">
import type { SortDirection } from '~/types/schema'

defineProps<{
  /** Whether this column is currently being sorted */
  active: boolean
  /** The current sort direction (only relevant when active) */
  direction: SortDirection
}>()
</script>

<style scoped>
.sort-icon {
  @apply w-4 h-4 transition-transform;
}

.sort-icon.active {
  color: rgb(var(--color-primary-500));
}

.sort-icon.active.sort-desc {
  transform: rotate(180deg);
}

.sort-icon.inactive {
  @apply opacity-0;
  color: rgb(var(--color-surface-400));
}
</style>
