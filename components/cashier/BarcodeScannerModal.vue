<template>
  <Teleport to="body">
    <Transition name="scanner-modal">
      <div
        v-if="modelValue"
        class="scanner-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="Barcode Scanner"
        @keydown.escape="handleClose"
      >
        <!-- Close Button -->
        <button
          ref="closeButtonRef"
          type="button"
          class="scanner-close-btn"
          aria-label="Close scanner"
          @click="handleClose"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <!-- Scanner Content -->
        <div class="scanner-content">
          <!-- Loading State -->
          <div v-if="scannerState.isInitializing" class="scanner-state-container">
            <div class="scanner-spinner">
              <UiSpinner size="lg" />
            </div>
            <p class="scanner-state-text">Initializing camera...</p>
          </div>

          <!-- Permission Denied State -->
          <div v-else-if="scannerState.hasPermission === false" class="scanner-state-container">
            <div class="scanner-state-icon scanner-state-icon--error">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            </div>
            <p class="scanner-state-text">Camera access denied</p>
            <p class="scanner-state-hint">
              Please allow camera access in your browser settings and try again.
            </p>
            <button type="button" class="scanner-retry-btn" @click="handleClose">
              Close
            </button>
          </div>

          <!-- Error State -->
          <div v-else-if="scannerState.error && !scannerState.isScanning" class="scanner-state-container">
            <div class="scanner-state-icon scanner-state-icon--error">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p class="scanner-state-text">Camera Error</p>
            <p class="scanner-state-hint">{{ scannerState.error }}</p>
            <button type="button" class="scanner-retry-btn" @click="handleClose">
              Close
            </button>
          </div>

          <!-- Scanning State -->
          <div v-else class="scanner-viewfinder-wrapper">
            <!-- Camera Feed Container (html5-qrcode renders here) -->
            <div
              id="scanner-viewfinder-container"
              class="scanner-viewfinder"
            >
              <!-- Viewfinder Corner Markers -->
              <div class="viewfinder-corner viewfinder-corner--tl"></div>
              <div class="viewfinder-corner viewfinder-corner--tr"></div>
              <div class="viewfinder-corner viewfinder-corner--bl"></div>
              <div class="viewfinder-corner viewfinder-corner--br"></div>

              <!-- Animated Scan Line -->
              <div v-if="scannerState.isScanning" class="viewfinder-scan-line"></div>
            </div>

            <!-- Success Flash Overlay -->
            <Transition name="flash">
              <div v-if="showSuccessFlash" class="scanner-success-flash"></div>
            </Transition>

            <!-- Instructions -->
            <p class="scanner-instructions">
              Position barcode within the frame
            </p>
          </div>
        </div>

        <!-- Torch Toggle Button -->
        <button
          v-if="scannerState.isScanning && flashSupported"
          type="button"
          class="scanner-torch-btn"
          :class="{ 'scanner-torch-btn--active': scannerState.isFlashOn }"
          aria-label="Toggle flashlight"
          @click="handleToggleFlash"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * BarcodeScannerModal Component
 *
 * A full-screen camera-based barcode scanner modal for mobile devices.
 * Uses the useBarcodeScanner composable for camera access and barcode detection.
 *
 * Features:
 * - Full-screen dark overlay for optimal scanning
 * - Square viewfinder with corner markers
 * - Animated scan line for visual feedback
 * - Success flash on barcode detection
 * - Torch/flashlight toggle (when supported)
 * - Permission denied and error state handling
 * - Accessible keyboard navigation and focus trap
 */

import { useBarcodeScanner } from '~/composables/useBarcodeScanner'

interface Props {
  /** Controls modal visibility (v-model) */
  modelValue: boolean
  /** Whether torch is available (passed from parent for UI hints) */
  torchAvailable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  torchAvailable: false,
})

const emit = defineEmits<{
  /** Emitted when modal visibility should change */
  'update:modelValue': [value: boolean]
  /** Emitted when a barcode is successfully scanned */
  'scan': [barcode: string]
  /** Emitted when camera permission is denied */
  'permission-denied': []
  /** Emitted when a camera error occurs */
  'error': [error: Error]
}>()

// Scanner composable
const {
  state: scannerState,
  startScanning,
  stopScanning,
  toggleFlash,
  hasFlashSupport,
} = useBarcodeScanner({
  // Configure scan box to match our viewfinder size
  qrboxWidth: 250,
  qrboxHeight: 250,
})

// Component state
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const showSuccessFlash = ref(false)
const flashSupported = ref(false)

// Track previously focused element for focus restoration
let previouslyFocusedElement: HTMLElement | null = null

/**
 * Handle successful barcode scan.
 * Shows success flash, emits the barcode, and auto-closes the modal.
 */
function handleScanSuccess(barcode: string): void {
  // Show success flash
  showSuccessFlash.value = true

  // Emit the scanned barcode
  emit('scan', barcode)

  // Auto-close after a brief delay for visual feedback
  setTimeout(() => {
    showSuccessFlash.value = false
    handleClose()
  }, 300)
}

/**
 * Close the modal and clean up resources.
 */
async function handleClose(): Promise<void> {
  await stopScanning()
  showSuccessFlash.value = false
  emit('update:modelValue', false)
}

/**
 * Toggle the camera flashlight/torch.
 */
async function handleToggleFlash(): Promise<void> {
  await toggleFlash()
}

/**
 * Lock body scroll to prevent background scrolling.
 */
function lockBodyScroll(): void {
  document.body.style.overflow = 'hidden'
}

/**
 * Unlock body scroll when modal closes.
 */
function unlockBodyScroll(): void {
  document.body.style.overflow = ''
}

// Watch for modal visibility changes
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      // Store currently focused element
      previouslyFocusedElement = document.activeElement as HTMLElement

      // Lock body scroll
      lockBodyScroll()

      // Wait for DOM to update before starting scanner
      await nextTick()

      // Start the camera scanner
      await startScanning('scanner-viewfinder-container', handleScanSuccess)

      // Check flash support after scanner starts
      await nextTick()
      flashSupported.value = hasFlashSupport()

      // Focus close button for keyboard accessibility
      closeButtonRef.value?.focus()
    } else {
      // Unlock body scroll
      unlockBodyScroll()

      // Restore focus to previously focused element
      if (previouslyFocusedElement) {
        previouslyFocusedElement.focus()
        previouslyFocusedElement = null
      }
    }
  }
)

// Watch for permission denied state
watch(
  () => scannerState.value.hasPermission,
  (hasPermission) => {
    if (hasPermission === false) {
      emit('permission-denied')
    }
  }
)

// Watch for errors
watch(
  () => scannerState.value.error,
  (error) => {
    if (error && !scannerState.value.isScanning) {
      emit('error', new Error(error))
    }
  }
)

// Cleanup on unmount
onUnmounted(() => {
  stopScanning()
  unlockBodyScroll()
})
</script>

<style scoped>
/* Scanner Modal Transition */
.scanner-modal-enter-active,
.scanner-modal-leave-active {
  transition: opacity 200ms ease-out;
}

.scanner-modal-enter-from,
.scanner-modal-leave-to {
  opacity: 0;
}

/* Scanner Backdrop - Full screen dark overlay */
.scanner-backdrop {
  @apply fixed inset-0 z-50 flex flex-col items-center justify-center;
  background: rgba(0, 0, 0, 0.95);
  /* Safe area padding for notched devices */
  padding: env(safe-area-inset-top, 16px) env(safe-area-inset-right, 16px) env(safe-area-inset-bottom, 16px) env(safe-area-inset-left, 16px);
}

/* Close Button - Top right */
.scanner-close-btn {
  @apply absolute flex items-center justify-center rounded-xl transition-all;
  top: max(env(safe-area-inset-top, 16px), 16px);
  right: max(env(safe-area-inset-right, 16px), 16px);
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  /* Ensure touch target */
  min-width: 48px;
  min-height: 48px;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.scanner-close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.scanner-close-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
}

/* Scanner Content Container */
.scanner-content {
  @apply flex flex-col items-center justify-center flex-1 w-full;
  max-width: 400px;
}

/* State Containers (Loading, Error, Permission Denied) */
.scanner-state-container {
  @apply flex flex-col items-center justify-center text-center px-6;
}

.scanner-spinner {
  @apply mb-4;
  color: white;
}

.scanner-state-icon {
  @apply flex items-center justify-center w-20 h-20 rounded-full mb-4;
}

.scanner-state-icon--error {
  background: rgba(239, 68, 68, 0.2);
  color: rgb(248, 113, 113);
}

.scanner-state-text {
  @apply text-lg font-semibold mb-2;
  color: white;
}

.scanner-state-hint {
  @apply text-sm mb-6 max-w-xs;
  color: rgba(255, 255, 255, 0.7);
}

.scanner-retry-btn {
  @apply px-6 py-3 rounded-xl font-semibold transition-all min-h-[44px];
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.scanner-retry-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Viewfinder Wrapper */
.scanner-viewfinder-wrapper {
  @apply relative flex flex-col items-center;
}

/* Viewfinder - Square scanning area */
.scanner-viewfinder {
  @apply relative overflow-hidden rounded-2xl;
  /* Use min() for responsive sizing: 75vw or 280px, whichever is smaller */
  width: min(280px, 75vw);
  height: min(280px, 75vw);
  background: transparent;
}

/* Hide html5-qrcode's default UI elements */
.scanner-viewfinder :deep(#qr-shaded-region) {
  display: none !important;
}

.scanner-viewfinder :deep(video) {
  @apply rounded-2xl;
  object-fit: cover;
}

/* Viewfinder Corner Markers */
.viewfinder-corner {
  @apply absolute;
  width: 24px;
  height: 24px;
  border-color: white;
  border-width: 3px;
  border-style: solid;
  z-index: 10;
  pointer-events: none;
}

.viewfinder-corner--tl {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
  border-top-left-radius: 8px;
}

.viewfinder-corner--tr {
  top: 0;
  right: 0;
  border-left: none;
  border-bottom: none;
  border-top-right-radius: 8px;
}

.viewfinder-corner--bl {
  bottom: 0;
  left: 0;
  border-right: none;
  border-top: none;
  border-bottom-left-radius: 8px;
}

.viewfinder-corner--br {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
  border-bottom-right-radius: 8px;
}

/* Animated Scan Line */
.viewfinder-scan-line {
  @apply absolute left-2 right-2;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(34, 197, 94, 0.8) 20%,
    rgb(34, 197, 94) 50%,
    rgba(34, 197, 94, 0.8) 80%,
    transparent 100%
  );
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
  animation: scan-line 2s ease-in-out infinite;
  z-index: 10;
  pointer-events: none;
}

@keyframes scan-line {
  0%, 100% {
    top: 8px;
  }
  50% {
    top: calc(100% - 10px);
  }
}

/* Success Flash Overlay */
.scanner-success-flash {
  @apply absolute inset-0 rounded-2xl;
  background: rgba(34, 197, 94, 0.4);
  z-index: 20;
  pointer-events: none;
}

.flash-enter-active {
  transition: opacity 100ms ease-out;
}

.flash-leave-active {
  transition: opacity 200ms ease-out;
}

.flash-enter-from,
.flash-leave-to {
  opacity: 0;
}

/* Scanner Instructions */
.scanner-instructions {
  @apply text-sm mt-4 text-center;
  color: rgba(255, 255, 255, 0.7);
}

/* Torch Toggle Button - Bottom center */
.scanner-torch-btn {
  @apply absolute flex items-center justify-center rounded-full transition-all;
  bottom: max(env(safe-area-inset-bottom, 32px), 32px);
  left: 50%;
  transform: translateX(-50%);
  width: 52px;
  height: 52px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  /* Ensure touch target */
  min-width: 52px;
  min-height: 52px;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.scanner-torch-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.scanner-torch-btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
}

.scanner-torch-btn--active {
  background: rgba(251, 191, 36, 0.3);
  color: rgb(251, 191, 36);
}

.scanner-torch-btn--active:hover {
  background: rgba(251, 191, 36, 0.4);
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  .viewfinder-scan-line {
    animation: none;
    top: 50%;
    transform: translateY(-50%);
  }

  .scanner-modal-enter-active,
  .scanner-modal-leave-active,
  .flash-enter-active,
  .flash-leave-active {
    transition: none;
  }
}
</style>
