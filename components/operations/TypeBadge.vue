<template>
  <span :class="['operation-badge', `operation-badge-${type.toLowerCase()}`]">
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
</style>
