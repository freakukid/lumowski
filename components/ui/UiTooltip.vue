<template>
  <div class="tooltip-wrapper" @mouseenter="show" @mouseleave="hide">
    <slot />
    <Transition name="tooltip">
      <div
        v-if="isVisible && text"
        :class="['tooltip', `tooltip-${position}`]"
        role="tooltip"
      >
        {{ text }}
        <span class="tooltip-arrow" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
type TooltipPosition = 'top' | 'bottom'

const props = withDefaults(defineProps<{
  /**
   * The text to display in the tooltip
   */
  text: string
  /**
   * The position of the tooltip relative to the trigger element
   */
  position?: TooltipPosition
  /**
   * Delay in milliseconds before showing the tooltip
   */
  delay?: number
}>(), {
  position: 'bottom',
  delay: 200,
})

const isVisible = ref(false)
let showTimeout: ReturnType<typeof setTimeout> | null = null

function show() {
  showTimeout = setTimeout(() => {
    isVisible.value = true
  }, props.delay)
}

function hide() {
  if (showTimeout) {
    clearTimeout(showTimeout)
    showTimeout = null
  }
  isVisible.value = false
}

onUnmounted(() => {
  if (showTimeout) {
    clearTimeout(showTimeout)
  }
})
</script>

<style scoped>
.tooltip-wrapper {
  @apply relative inline-flex;
}

.tooltip {
  @apply absolute z-50 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-lg pointer-events-none;
  background: rgb(var(--color-surface-800));
  color: rgb(var(--color-surface-50));
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Position: bottom (default) */
.tooltip-bottom {
  @apply top-full mt-2 left-1/2 -translate-x-1/2;
}

.tooltip-bottom .tooltip-arrow {
  @apply absolute -top-1 left-1/2 -translate-x-1/2;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 5px solid rgb(var(--color-surface-800));
}

/* Position: top */
.tooltip-top {
  @apply bottom-full mb-2 left-1/2 -translate-x-1/2;
}

.tooltip-top .tooltip-arrow {
  @apply absolute -bottom-1 left-1/2 -translate-x-1/2;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid rgb(var(--color-surface-800));
}

/* Tooltip transition */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
}

.tooltip-bottom.tooltip-enter-from,
.tooltip-bottom.tooltip-leave-to {
  transform: translate(-50%, -4px);
}

.tooltip-top.tooltip-enter-from,
.tooltip-top.tooltip-leave-to {
  transform: translate(-50%, 4px);
}
</style>
