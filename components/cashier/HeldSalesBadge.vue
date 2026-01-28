<template>
  <button
    v-if="count > 0"
    type="button"
    class="held-sales-badge"
    :aria-label="`${count} held ${count === 1 ? 'sale' : 'sales'}. Click to view.`"
    @click="$emit('click')"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
    <span class="badge-count" aria-hidden="true">{{ count }}</span>
  </button>
</template>

<script setup lang="ts">
/**
 * HeldSalesBadge - A compact badge showing the count of held/paused sales.
 *
 * Displays only when there are held sales (count > 0). Uses warning color scheme
 * to indicate items requiring attention. Includes pulse animation on the count
 * badge that respects prefers-reduced-motion.
 */

defineProps<{
  /**
   * Number of held sales to display in the badge.
   * Badge is hidden when count is 0.
   */
  count: number
}>()

defineEmits<{
  /**
   * Emitted when the badge is clicked, typically to open a held sales list.
   */
  click: []
}>()
</script>

<style scoped>
.held-sales-badge {
  @apply relative flex items-center justify-center rounded-xl transition-all;
  /* 44x44px minimum touch target for WCAG compliance */
  min-width: 44px;
  min-height: 44px;
  background: rgba(var(--color-warning-500), 0.12);
  color: rgb(var(--color-warning-600));
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.held-sales-badge:hover {
  background: rgba(var(--color-warning-500), 0.2);
  color: rgb(var(--color-warning-700));
}

.held-sales-badge:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring-warning);
}

.held-sales-badge:active {
  background: rgba(var(--color-warning-500), 0.25);
}

.badge-count {
  @apply absolute -top-1 -right-1 flex items-center justify-center text-xs font-bold rounded-full;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: rgb(var(--color-warning-500));
  color: white;
  animation: pulse-badge 2s ease-in-out infinite;
}

/* Pulse animation for the count badge */
@keyframes pulse-badge {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--color-warning-500), 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 0 4px rgba(var(--color-warning-500), 0);
  }
}

/* Respect user preference for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .badge-count {
    animation: none;
  }
}

/* Dark mode adjustments */
html[data-theme="midnight"] .held-sales-badge {
  background: rgba(var(--color-warning-500), 0.15);
  color: rgb(var(--color-warning-400));
}

html[data-theme="midnight"] .held-sales-badge:hover {
  background: rgba(var(--color-warning-500), 0.25);
  color: rgb(var(--color-warning-300));
}

html[data-theme="midnight"] .badge-count {
  background: rgb(var(--color-warning-500));
  color: rgb(var(--color-warning-950));
}
</style>
