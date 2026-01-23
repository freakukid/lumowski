<template>
  <div ref="containerRef" class="actions-menu">
    <!-- Trigger Button -->
    <button
      type="button"
      class="actions-menu-trigger"
      :class="{ 'actions-menu-trigger-active': isOpen }"
      :aria-expanded="isOpen"
      aria-haspopup="true"
      aria-label="More actions"
      @click="toggleMenu"
    >
      <!-- 3-dot vertical icon -->
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>

    <!-- Dropdown Panel -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="actions-menu-dropdown"
        :class="{ 'dropdown-align-left': alignLeft }"
        role="menu"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const alignLeft = ref(false)

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function closeMenu() {
  isOpen.value = false
}

/**
 * Calculate dropdown position and flip alignment if it would overflow the viewport.
 * By default, the dropdown aligns to the right edge of the trigger button.
 * If this causes it to overflow off the left side of the screen, we flip
 * to align with the left edge of the button instead.
 */
function calculatePosition() {
  if (!dropdownRef.value) return

  const rect = dropdownRef.value.getBoundingClientRect()

  // If dropdown overflows left side of viewport, align to left edge of button instead
  if (rect.left < 0) {
    alignLeft.value = true
  } else {
    alignLeft.value = false
  }
}

// Recalculate position when dropdown opens
watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    calculatePosition()
  }
})

// Close on click outside
function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeMenu()
  }
}

// Close on Escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    closeMenu()
  }
}

// Provide close function to child menu items
provide('closeActionsMenu', closeMenu)

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
.actions-menu {
  @apply relative;
}

.actions-menu-trigger {
  @apply w-11 h-11 min-w-[44px] flex items-center justify-center flex-shrink-0 rounded-xl transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.actions-menu-trigger:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.actions-menu-trigger:focus-visible {
  @apply outline-none;
  box-shadow: 0 0 0 3px rgba(var(--color-primary-500), 0.3);
}

.actions-menu-trigger-active {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-600));
}

.actions-menu-trigger-active:hover {
  background: rgba(var(--color-primary-500), 0.2);
}

.actions-menu-dropdown {
  @apply absolute top-full right-0 mt-2 min-w-[200px] max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden z-50 py-1;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.dropdown-align-left {
  @apply right-auto left-0;
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
