<template>
  <span :class="['operation-badge', `operation-badge-${type.toLowerCase()}`]">
    <!-- Receiving icon -->
    <svg
      v-if="type === 'RECEIVING'"
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 11v4m0 0l-2-2m2 2l2-2"
      />
    </svg>
    <!-- Sale icon (shopping cart) -->
    <svg
      v-else-if="type === 'SALE'"
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
    <!-- Return icon (refund arrows) -->
    <svg
      v-else-if="type === 'RETURN'"
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
    <span class="operation-badge-text">{{ displayText }}</span>
  </span>
</template>

<script setup lang="ts">
import type { OperationType } from '~/types/operation'

const props = defineProps<{
  /**
   * The operation type to display
   */
  type: OperationType
}>()

/**
 * Formats the operation type for display.
 * Converts enum values to human-readable format.
 */
const displayText = computed(() => {
  switch (props.type) {
    case 'RECEIVING':
      return 'Receiving'
    case 'SALE':
      return 'Sale'
    case 'RETURN':
      return 'Return'
    default:
      return props.type
  }
})
</script>

<style scoped>
.operation-badge {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg;
}

.operation-badge-text {
  @apply leading-none;
}

/* Receiving - Green/Emerald color scheme */
.operation-badge-receiving {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

html[data-theme="midnight"] .operation-badge-receiving {
  background: rgba(var(--color-accent-500), 0.15);
  color: rgb(var(--color-accent-400));
}

/* Sale - Primary/Blue color scheme */
.operation-badge-sale {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

html[data-theme="midnight"] .operation-badge-sale {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-400));
}

/* Return - Warning/Orange color scheme */
.operation-badge-return {
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

html[data-theme="midnight"] .operation-badge-return {
  background: rgba(var(--color-warning-500), 0.15);
  color: rgb(var(--color-warning-400));
}
</style>
