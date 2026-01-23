<template>
  <component
    :is="componentType"
    :to="to"
    :class="['menu-item', { 'menu-item-danger': danger }]"
    role="menuitem"
    @click="handleClick"
  >
    <span v-if="$slots.icon" class="menu-item-icon">
      <slot name="icon" />
    </span>
    <span class="menu-item-label">
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<{
  /**
   * When provided, renders as NuxtLink with this destination
   */
  to?: RouteLocationRaw
  /**
   * Apply danger styling (red text) for destructive actions
   */
  danger?: boolean
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

// Inject close function from parent UiActionsMenu
const closeActionsMenu = inject<(() => void) | undefined>('closeActionsMenu', undefined)

const componentType = computed(() => {
  return props.to ? resolveComponent('NuxtLink') : 'button'
})

function handleClick(event: MouseEvent) {
  emit('click', event)
  // Close the menu after clicking an item
  if (closeActionsMenu) {
    closeActionsMenu()
  }
}
</script>

<style scoped>
.menu-item {
  @apply w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors;
  color: rgb(var(--color-surface-700));
}

.menu-item:hover {
  background: rgba(var(--color-surface-100), 0.8);
  color: rgb(var(--color-surface-900));
}

.menu-item:focus {
  @apply outline-none;
  background: rgba(var(--color-surface-100), 0.8);
}

.menu-item:focus-visible {
  @apply outline-none;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}

.menu-item-danger {
  color: rgb(var(--color-error-500));
}

.menu-item-danger:hover {
  color: rgb(var(--color-error-600));
  background: rgba(var(--color-error-500), 0.08);
}

.menu-item-icon {
  @apply flex-shrink-0 w-5 h-5 flex items-center justify-center;
}

.menu-item-icon :deep(svg) {
  @apply w-5 h-5;
}

.menu-item-label {
  @apply flex-1;
}
</style>
