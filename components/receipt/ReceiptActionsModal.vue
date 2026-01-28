<template>
  <UiModal
    :model-value="modelValue"
    title="Receipt Options"
    size="md"
    :closable="!isProcessing"
    :close-on-backdrop="!isProcessing"
    @update:model-value="handleClose"
  >
    <!-- Error Message -->
    <Transition name="fade">
      <div
        v-if="errorMessage"
        class="error-message"
        role="alert"
        aria-live="polite"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ errorMessage }}</span>
      </div>
    </Transition>

    <!-- Receipt Options -->
    <div class="receipt-options">
      <p class="options-description">
        Print or email a copy of the receipt for this transaction.
      </p>

      <div class="options-grid">
        <!-- Print Button -->
        <button
          type="button"
          class="option-btn option-print"
          :disabled="isProcessing"
          aria-label="Print receipt"
          @click="handlePrint"
        >
          <div class="option-icon">
            <svg v-if="!isPrinting" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <svg v-else class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span class="option-label">{{ isPrinting ? 'Printing...' : 'Print' }}</span>
        </button>

        <!-- Email Button -->
        <button
          type="button"
          class="option-btn option-email"
          :disabled="isProcessing"
          aria-label="Email receipt"
          @click="toggleEmailInput"
        >
          <div class="option-icon">
            <svg v-if="!isSendingEmail" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span class="option-label">{{ isSendingEmail ? 'Sending...' : 'Email' }}</span>
        </button>
      </div>

      <!-- Email Input Section -->
      <Transition name="slide-fade">
        <div v-if="showEmailInput" class="email-section">
          <UiFormGroup label="Email Address" for="receipt-email">
            <div class="email-input-wrapper">
              <UiInput
                id="receipt-email"
                v-model="emailAddress"
                type="email"
                placeholder="customer@example.com"
                :disabled="isSendingEmail"
                @keydown.enter="handleSendEmail"
              />
              <UiButton
                :loading="isSendingEmail"
                loading-text="Sending..."
                :disabled="!isValidEmail || isSendingEmail"
                @click="handleSendEmail"
              >
                Send
              </UiButton>
            </div>
            <template #hint>
              <span v-if="emailError" class="email-error" role="alert" aria-live="polite">{{ emailError }}</span>
              <span v-else>Receipt will be sent as a PDF attachment</span>
            </template>
          </UiFormGroup>
        </div>
      </Transition>
    </div>

    <!-- Receipt Template for PDF generation (visually hidden but rendered) -->
    <div class="receipt-container" aria-hidden="true">
      <ReceiptTemplate
        ref="receiptTemplateRef"
        :operation="operation"
        :settings="settings"
        :business-name="businessName"
      />
    </div>

    <template #footer>
      <UiButton
        variant="secondary"
        :disabled="isProcessing"
        @click="handleClose(false)"
      >
        Close
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { Operation } from '~/types/operation'
import type { BusinessSettings } from '~/types/business'

interface Props {
  /** Controls modal visibility (v-model) */
  modelValue: boolean
  /** The sale operation to print/email receipt for */
  operation: Operation | null
  /** Business settings for receipt customization */
  settings: BusinessSettings | null
  /** Business name */
  businessName?: string
  /** Whether to show the email input section when modal opens */
  initialShowEmail?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  businessName: 'Business',
})

const emit = defineEmits<{
  /** Emitted when modal visibility should change */
  'update:modelValue': [value: boolean]
}>()

// Receipt composable
const { generatePDF, printBrowser, printThermal, sendEmail, isPrinting, isSendingEmail, error: receiptError } = useReceipt()

// Component state
const showEmailInput = ref(false)
const emailAddress = ref('')
const emailError = ref('')
const errorMessage = ref('')

// Template ref for the receipt component
const receiptTemplateRef = ref<{ receiptRef: HTMLElement | null } | null>(null)

/**
 * Combined processing state.
 */
const isProcessing = computed(() => isPrinting.value || isSendingEmail.value)

/**
 * Validates email address format.
 * Basic frontend validation - backend performs strict RFC 5322 validation.
 */
const isValidEmail = computed(() => {
  // Stricter pattern: requires domain with at least 2 character TLD
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
  return emailAddress.value.trim() !== '' && emailRegex.test(emailAddress.value)
})

/**
 * Handles closing the modal.
 */
function handleClose(value: boolean) {
  if (!isProcessing.value) {
    emit('update:modelValue', value)
  }
}

/**
 * Toggles the email input section.
 */
function toggleEmailInput() {
  showEmailInput.value = !showEmailInput.value
  emailError.value = ''
}

/**
 * Handles the print action.
 * Uses thermal printer if configured, otherwise browser print.
 */
async function handlePrint() {
  errorMessage.value = ''

  try {
    // Check if thermal printer is configured
    if (props.settings?.thermalPrinterEnabled && props.settings.thermalPrinterAddress && props.operation) {
      // Print to thermal printer via API
      await printThermal(props.operation.id)
    } else {
      // Fall back to browser print
      const receiptElement = receiptTemplateRef.value?.receiptRef
      if (!receiptElement) {
        throw new Error('Receipt template not available')
      }
      await printBrowser(receiptElement)
    }

    // Close modal after successful print
    emit('update:modelValue', false)
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to print receipt'
  }
}

/**
 * Handles sending receipt via email.
 */
async function handleSendEmail() {
  if (!isValidEmail.value) {
    emailError.value = 'Please enter a valid email address'
    return
  }

  if (!props.operation) {
    emailError.value = 'Operation data not available'
    return
  }

  errorMessage.value = ''
  emailError.value = ''

  try {
    // Get the receipt element
    const receiptElement = receiptTemplateRef.value?.receiptRef
    if (!receiptElement) {
      throw new Error('Receipt template not available')
    }

    // Generate PDF from receipt
    const pdfBase64 = await generatePDF(receiptElement)

    // Send email via API
    await sendEmail({
      operationId: props.operation.id,
      recipientEmail: emailAddress.value,
      pdfBase64,
    })

    // Close modal after successful send
    emit('update:modelValue', false)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    emailError.value = message
    errorMessage.value = message
  }
}

/**
 * Reset state when modal opens.
 */
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    showEmailInput.value = props.initialShowEmail ?? false
    emailAddress.value = ''
    emailError.value = ''
    errorMessage.value = ''
  }
})

/**
 * Sync receipt error to errorMessage.
 */
watch(receiptError, (err) => {
  if (err) {
    errorMessage.value = err
  }
})
</script>

<style scoped>
/* Error Message */
.error-message {
  @apply flex items-center gap-2 p-3 rounded-lg mb-4 text-sm;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
  border: 1px solid rgba(var(--color-error-500), 0.2);
}

/* Receipt Options */
.receipt-options {
  @apply space-y-4;
}

.options-description {
  @apply text-sm mb-4;
  color: rgb(var(--color-surface-600));
}

.options-grid {
  @apply grid grid-cols-2 gap-3;
}

.option-btn {
  @apply flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all min-h-[100px];
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  background: rgb(var(--color-surface-50));
}

.option-btn:hover:not(:disabled) {
  border-color: rgb(var(--color-surface-300));
  transform: translateY(-2px);
}

.option-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
  transform: none;
}

.option-btn:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

.option-icon {
  @apply flex items-center justify-center w-12 h-12 rounded-lg;
}

.option-label {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

/* Print Button */
.option-print .option-icon {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.option-print:hover:not(:disabled) {
  border-color: rgb(var(--color-primary-400));
  background: rgba(var(--color-primary-500), 0.04);
}

/* Email Button */
.option-email .option-icon {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.option-email:hover:not(:disabled) {
  border-color: rgb(var(--color-accent-400));
  background: rgba(var(--color-accent-500), 0.04);
}

/* Email Section */
.email-section {
  @apply mt-4 p-4 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.email-input-wrapper {
  @apply flex gap-2;
}

.email-input-wrapper :deep(.input) {
  @apply flex-1;
}

.email-error {
  color: rgb(var(--color-error-600));
}

/* Receipt Container (visually hidden but rendered for html2canvas) */
.receipt-container {
  @apply fixed overflow-hidden;
  /* Position off-screen but keep rendered in DOM for canvas capture */
  left: -9999px;
  top: 0;
  /* Ensure element has dimensions and is rendered */
  width: auto;
  height: auto;
  visibility: hidden;
  pointer-events: none;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 200ms ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
