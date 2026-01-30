<template>
  <div
    class="barcode-input-wrapper"
    :class="{
      'is-loading': props.isLoading,
      'is-success': isSuccessState,
      'is-error': isErrorState
    }"
  >
    <!-- Input Container -->
    <div class="input-container">
      <!-- Barcode Icon (left) -->
      <svg
        class="barcode-icon"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 4h2v16H4V4zm4 0h1v16H8V4zm3 0h2v16h-2V4zm4 0h1v16h-1V4zm3 0h2v16h-2V4z"
        />
      </svg>

      <!-- Text Input -->
      <input
        ref="inputRef"
        v-model="barcodeValue"
        type="text"
        inputmode="numeric"
        class="barcode-input"
        aria-label="Scan or enter barcode"
        :aria-describedby="props.errorMessage ? 'barcode-error' : undefined"
        :disabled="props.disabled || props.isLoading"
        placeholder="Scan or enter barcode..."
        @keydown.enter="handleSubmit"
        @input="handleInput"
      />

      <!-- Right Side: Loading Spinner OR Camera Button -->
      <div class="right-actions">
        <!-- Loading Spinner -->
        <div
          v-if="props.isLoading"
          class="spinner-container"
        >
          <UiSpinner size="sm" />
        </div>

        <!-- Camera Button (mobile only) -->
        <button
          v-else
          type="button"
          class="camera-button"
          aria-label="Scan barcode with camera"
          :disabled="props.disabled"
          @click="handleCameraClick"
        >
          <svg
            class="camera-icon"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Error Message -->
    <Transition name="fade">
      <p
        v-if="props.errorMessage"
        id="barcode-error"
        class="error-message"
        role="alert"
      >
        {{ props.errorMessage }}
      </p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * BarcodeInput Component
 *
 * A specialized input for barcode scanning in the cashier module.
 * Supports manual entry and camera scanning (mobile), with loading,
 * success, and error states including animations.
 */

interface Props {
  /** Loading state while looking up barcode */
  isLoading?: boolean
  /** Error message to display (triggers error state) */
  errorMessage?: string
  /** Whether barcode scanning is disabled */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  errorMessage: '',
  disabled: false,
})

const emit = defineEmits<{
  /** Emitted when user submits barcode (Enter key) */
  submit: [barcode: string]
  /** Emitted when camera button clicked (mobile) */
  'camera-click': []
  /** Emitted when user starts typing (to clear error) */
  'clear-error': []
}>()

// Internal state
const inputRef = ref<HTMLInputElement | null>(null)
const barcodeValue = ref('')
const isSuccessState = ref(false)
const isErrorState = ref(false)

/**
 * Handles form submission when Enter is pressed.
 * Only submits if there is a non-empty barcode value.
 */
function handleSubmit(): void {
  const trimmedValue = barcodeValue.value.trim()
  if (trimmedValue && !props.isLoading && !props.disabled) {
    emit('submit', trimmedValue)
  }
}

/**
 * Handles input changes. Emits clear-error when user starts typing
 * to allow parent to clear any displayed error message.
 */
function handleInput(): void {
  if (props.errorMessage) {
    emit('clear-error')
  }
}

/**
 * Handles camera button click for mobile barcode scanning.
 */
function handleCameraClick(): void {
  if (!props.disabled) {
    emit('camera-click')
  }
}

// Exposed methods for parent component control
/**
 * Focus the input field programmatically.
 */
function focus(): void {
  inputRef.value?.focus()
}

/**
 * Clear the input value.
 */
function clear(): void {
  barcodeValue.value = ''
}

/**
 * Trigger success animation and clear input.
 * Used after a successful barcode lookup.
 */
function showSuccess(): void {
  isSuccessState.value = true
  barcodeValue.value = ''

  // Remove success state after animation completes
  setTimeout(() => {
    isSuccessState.value = false
  }, 600)
}

/**
 * Trigger error animation.
 * Used when a barcode lookup fails.
 */
function showError(): void {
  isErrorState.value = true

  // Remove error state after animation completes
  setTimeout(() => {
    isErrorState.value = false
  }, 400)
}

defineExpose({
  focus,
  clear,
  showSuccess,
  showError,
})
</script>

<style scoped>
.barcode-input-wrapper {
  @apply relative;
}

.input-container {
  @apply relative;
}

/* Barcode Icon - Left Side */
.barcode-icon {
  @apply absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none;
  color: rgb(var(--color-surface-400));
  z-index: 1;
}

/* Main Input Field */
.barcode-input {
  @apply w-full pl-11 pr-14 min-h-[44px] rounded-xl text-sm font-medium transition-all outline-none;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.barcode-input::placeholder {
  color: rgb(var(--color-surface-400));
}

.barcode-input:focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.barcode-input:disabled {
  @apply cursor-not-allowed opacity-60;
}

/* Right Actions Container */
.right-actions {
  @apply absolute right-1.5 top-1/2 -translate-y-1/2;
}

/* Spinner Container */
.spinner-container {
  @apply flex items-center justify-center w-10 h-10;
  color: rgb(var(--color-primary-500));
}

/* Camera Button */
.camera-button {
  @apply flex items-center justify-center w-10 h-10 rounded-lg transition-all;
  background: rgba(var(--color-surface-200), 0.6);
  color: rgb(var(--color-surface-500));
  /* Ensure touch target meets accessibility requirements */
  min-width: 44px;
  min-height: 44px;
}

.camera-button:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.8);
  color: rgb(var(--color-surface-600));
}

.camera-button:focus {
  outline: none;
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.camera-button:disabled {
  @apply cursor-not-allowed opacity-50;
}

/* Hide camera button on desktop (md breakpoint and up) */
@media (min-width: 768px) {
  .camera-button {
    @apply hidden;
  }

  /* Adjust input padding when camera button is hidden */
  .barcode-input {
    @apply pr-4;
  }

  /* Keep spinner visible and adjust positioning */
  .is-loading .barcode-input {
    @apply pr-14;
  }
}

.camera-icon {
  @apply w-5 h-5;
}

/* Error Message */
.error-message {
  @apply mt-2 text-sm font-medium;
  color: rgb(var(--color-error-500));
}

/* Fade Transition for Error Message */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ============================================
 * SUCCESS STATE
 * Green background pulse animation
 * ============================================ */
.is-success .barcode-input {
  animation: success-flash 600ms ease-out;
}

@keyframes success-flash {
  0% {
    background: rgba(var(--color-success-500), 0.2);
    border-color: rgb(var(--color-success-500));
  }
  50% {
    background: rgba(var(--color-success-500), 0.15);
    border-color: rgb(var(--color-success-500));
  }
  100% {
    background: rgba(var(--color-surface-50), 0.8);
    border-color: rgba(var(--color-surface-300), 0.5);
  }
}

/* ============================================
 * ERROR STATE
 * Horizontal shake animation
 * ============================================ */
.is-error .barcode-input {
  border-color: rgb(var(--color-error-500));
  animation: error-shake 400ms ease-out;
}

@keyframes error-shake {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
}

/* ============================================
 * LOADING STATE
 * Visual indication that lookup is in progress
 * ============================================ */
.is-loading .barcode-input {
  @apply cursor-wait;
  background: rgba(var(--color-surface-100), 0.9);
}

/* ============================================
 * REDUCED MOTION SUPPORT
 * Respect user's motion preferences
 * ============================================ */
@media (prefers-reduced-motion: reduce) {
  .is-success .barcode-input {
    animation: none;
    background: rgba(var(--color-success-500), 0.1);
    border-color: rgb(var(--color-success-500));
    transition: background 300ms ease, border-color 300ms ease;
  }

  .is-error .barcode-input {
    animation: none;
    /* Error border color is already applied, no animation needed */
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}
</style>
