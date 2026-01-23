<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        ref="backdropRef"
        class="modal-backdrop"
        role="dialog"
        :aria-modal="true"
        :aria-labelledby="titleId"
        @click.self="handleBackdropClick"
      >
        <div
          ref="panelRef"
          :class="['modal-panel', sizeClass]"
          tabindex="-1"
        >
          <!-- Header -->
          <slot name="header">
            <div
              v-if="title || closable"
              :class="['modal-header', headerVariantClass]"
            >
              <h2
                v-if="title"
                :id="titleId"
                class="text-lg font-semibold"
                :style="titleColorStyle"
              >
                {{ title }}
              </h2>
              <button
                v-if="closable"
                type="button"
                class="modal-close-btn"
                aria-label="Close modal"
                @click="close"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </slot>

          <!-- Body -->
          <div class="modal-body">
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="modal-footer"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount, useId } from 'vue'

type ModalVariant = 'default' | 'danger' | 'success' | 'warning'
type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(defineProps<{
  /**
   * Controls the visibility of the modal (v-model)
   */
  modelValue: boolean
  /**
   * The modal title displayed in the header
   */
  title?: string
  /**
   * The color variant of the modal header
   */
  variant?: ModalVariant
  /**
   * The maximum width of the modal
   */
  size?: ModalSize
  /**
   * Whether to show the close button
   */
  closable?: boolean
  /**
   * Whether to prevent closing on backdrop click or Escape key
   */
  persistent?: boolean
  /**
   * Whether clicking the backdrop should close the modal (defaults to true)
   * Takes precedence over persistent for backdrop clicks only
   */
  closeOnBackdrop?: boolean
}>(), {
  title: undefined,
  variant: 'default',
  size: 'md',
  closable: true,
  persistent: false,
  closeOnBackdrop: true,
})

const emit = defineEmits<{
  /**
   * Emitted when the modal visibility changes
   */
  'update:modelValue': [value: boolean]
}>()

const generatedId = useId()
const titleId = computed(() => `modal-title-${generatedId}`)

const backdropRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const previouslyFocusedElement = ref<HTMLElement | null>(null)

/**
 * Computed class for modal size
 */
const sizeClass = computed(() => `modal-${props.size}`)

/**
 * Computed class for header variant styling
 */
const headerVariantClass = computed(() => {
  if (props.variant === 'default') return ''
  return `modal-header-${props.variant}`
})

/**
 * Computed style for title text color based on variant
 */
const titleColorStyle = computed(() => {
  switch (props.variant) {
    case 'danger':
      return { color: 'rgb(var(--color-error-600))' }
    case 'success':
      return { color: 'rgb(var(--color-success-600))' }
    case 'warning':
      return { color: 'rgb(var(--color-warning-600))' }
    default:
      return { color: 'rgb(var(--color-surface-900))' }
  }
})

/**
 * Close the modal
 */
function close() {
  emit('update:modelValue', false)
}

/**
 * Handle backdrop click - close if not persistent AND closeOnBackdrop is not false
 */
function handleBackdropClick() {
  if (!props.persistent && props.closeOnBackdrop !== false) {
    emit('update:modelValue', false)
  }
}

/**
 * Handle Escape key - close if not persistent
 * This is called from the global document keydown listener
 */
function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && !props.persistent) {
    close()
  }
}

/**
 * Get all focusable elements within the modal
 */
function getFocusableElements(): HTMLElement[] {
  if (!panelRef.value) return []

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  return Array.from(panelRef.value.querySelectorAll<HTMLElement>(focusableSelectors))
}

/**
 * Handle tab key for focus trapping
 */
function handleTabKey(event: KeyboardEvent) {
  if (!props.modelValue) return

  const focusableElements = getFocusableElements()
  if (focusableElements.length === 0) return

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]
  const activeElement = document.activeElement as HTMLElement

  if (event.shiftKey) {
    // Shift + Tab: move focus backward
    if (activeElement === firstElement || !panelRef.value?.contains(activeElement)) {
      event.preventDefault()
      lastElement.focus()
    }
  } else {
    // Tab: move focus forward
    if (activeElement === lastElement || !panelRef.value?.contains(activeElement)) {
      event.preventDefault()
      firstElement.focus()
    }
  }
}

/**
 * Global keydown handler for focus trap and escape key
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    handleTabKey(event)
  } else if (event.key === 'Escape') {
    handleEscapeKey(event)
  }
}

/**
 * Lock body scroll when modal is open
 */
function lockBodyScroll() {
  document.body.style.overflow = 'hidden'
}

/**
 * Unlock body scroll when modal is closed
 */
function unlockBodyScroll() {
  document.body.style.overflow = ''
}

// Watch for modal visibility changes
watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    // Store the currently focused element to restore later
    previouslyFocusedElement.value = document.activeElement as HTMLElement

    // Lock body scroll
    lockBodyScroll()

    // Add global keydown listener for focus trap
    document.addEventListener('keydown', handleKeydown)

    // Focus the modal panel after it's rendered
    await nextTick()
    panelRef.value?.focus()
  } else {
    // Unlock body scroll
    unlockBodyScroll()

    // Remove global keydown listener
    document.removeEventListener('keydown', handleKeydown)

    // Restore focus to the previously focused element
    if (previouslyFocusedElement.value) {
      previouslyFocusedElement.value.focus()
      previouslyFocusedElement.value = null
    }
  }
})

// Clean up on unmount
onBeforeUnmount(() => {
  if (props.modelValue) {
    unlockBodyScroll()
    document.removeEventListener('keydown', handleKeydown)
  }
})
</script>

<style scoped>
/* Close button styling */
.modal-close-btn {
  @apply flex items-center justify-center w-9 h-9 rounded-lg transition-colors;
  color: rgb(var(--color-surface-500));
}

.modal-close-btn:hover {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.modal-close-btn:active {
  background: rgba(var(--color-surface-300), 0.5);
}


/* Modal animations */

/* Desktop: scale and fade */
@media (min-width: 768px) {
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease-out;
  }

  .modal-enter-active .modal-panel,
  .modal-leave-active .modal-panel {
    transition: transform 200ms ease-out, opacity 200ms ease-out;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-from .modal-panel,
  .modal-leave-to .modal-panel {
    transform: scale(0.95);
    opacity: 0;
  }
}

/* Mobile: slide up from bottom */
@media (max-width: 767px) {
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease-out;
  }

  .modal-enter-active .modal-panel,
  .modal-leave-active .modal-panel {
    transition: transform 300ms ease-out;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .modal-enter-from .modal-panel {
    transform: translateY(100%);
  }

  .modal-leave-to .modal-panel {
    transform: translateY(100%);
  }
}
</style>
