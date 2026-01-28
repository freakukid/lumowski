<template>
  <div class="logo-upload-wrapper">
    <!-- Upload Zone -->
    <div
      ref="uploadZoneRef"
      :class="[
        'logo-upload-zone',
        {
          'is-drag-over': isDragOver && !isDragInvalid,
          'is-drag-invalid': isDragInvalid,
          'is-uploading': loading,
          'is-disabled': disabled,
          'has-error': !!errorMessage,
        }
      ]"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :aria-disabled="disabled"
      :aria-describedby="requirementsId"
      :aria-busy="loading"
      @click="handleClick"
      @keydown.enter.prevent="handleClick"
      @keydown.space.prevent="handleClick"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <!-- Empty State -->
      <div v-if="!modelValue && !loading" class="upload-empty-state">
        <div class="upload-icon">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="upload-text">Drag & drop or click to upload</p>
        <p :id="requirementsId" class="upload-requirements">
          PNG, JPG, WEBP or SVG. Max {{ maxSizeMB }}MB.
        </p>
      </div>

      <!-- Preview State -->
      <div v-else-if="modelValue && !loading" class="upload-preview-container">
        <img
          :src="modelValue"
          alt="Business logo"
          class="upload-preview-image"
        />

        <!-- Delete Overlay on Hover -->
        <div class="upload-preview-overlay">
          <button
            type="button"
            class="upload-delete-btn"
            aria-label="Remove logo"
            @click.stop="openDeleteConfirm"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Remove</span>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="upload-loading-overlay">
        <div class="upload-spinner"></div>
        <p class="upload-loading-text">Uploading...</p>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="upload-error" role="alert" aria-live="polite">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ errorMessage }}</span>
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInputRef"
      type="file"
      :accept="accept"
      class="hidden"
      @change="handleFileSelect"
    />

    <!-- Status Announcement for Screen Readers -->
    <div class="sr-only" aria-live="assertive">
      {{ statusAnnouncement }}
    </div>

    <!-- Delete Confirmation Modal -->
    <UiModal
      v-model="showDeleteConfirm"
      title="Remove Logo"
      variant="danger"
      size="sm"
    >
      <p class="text-sm" style="color: rgb(var(--color-surface-600));">
        Are you sure you want to remove the business logo? This action cannot be undone.
      </p>

      <template #footer>
        <UiButton variant="secondary" @click="showDeleteConfirm = false">
          Cancel
        </UiButton>
        <UiButton
          variant="danger"
          :loading="isDeleting"
          loading-text="Removing..."
          @click="handleDelete"
        >
          Remove Logo
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useId } from 'vue'

interface Props {
  /**
   * Current logo URL (v-model)
   */
  modelValue?: string | null
  /**
   * Whether the component is in a loading state
   */
  loading?: boolean
  /**
   * Whether the component is disabled
   */
  disabled?: boolean
  /**
   * Maximum file size in bytes (default: 5MB)
   */
  maxSize?: number
  /**
   * Accepted file types
   */
  accept?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  loading: false,
  disabled: false,
  maxSize: 5 * 1024 * 1024,
  accept: 'image/png,image/jpeg,image/jpg,image/webp,image/svg+xml',
})

const emit = defineEmits<{
  /**
   * Emitted when the logo changes
   */
  'update:modelValue': [value: string | null]
  /**
   * Emitted when a file is selected for upload (passes base64 data URL)
   */
  'upload': [imageBase64: string]
  /**
   * Emitted when the user confirms deletion
   */
  'delete': []
  /**
   * Emitted when a validation error occurs
   */
  'error': [message: string]
}>()

// Refs
const uploadZoneRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// State
const isDragOver = ref(false)
const isDragInvalid = ref(false)
const errorMessage = ref<string | null>(null)
const statusAnnouncement = ref('')
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// Generated IDs for accessibility
const generatedId = useId()
const requirementsId = computed(() => `upload-requirements-${generatedId}`)

// Computed
const maxSizeMB = computed(() => Math.round(props.maxSize / (1024 * 1024)))

const acceptedTypes = computed(() => {
  return props.accept.split(',').map(type => type.trim())
})

/**
 * Opens the file picker
 */
function handleClick() {
  if (props.disabled || props.loading) return
  fileInputRef.value?.click()
}

/**
 * Validates a file against size and type constraints
 */
function validateFile(file: File): string | null {
  // Check file type
  if (!acceptedTypes.value.includes(file.type)) {
    return 'Invalid file type. Please upload a PNG, JPG, WEBP, or SVG image.'
  }

  // Check file size
  if (file.size > props.maxSize) {
    return `File is too large. Maximum size is ${maxSizeMB.value}MB.`
  }

  return null
}

/**
 * Handles file selection from the file input
 */
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (file) {
    processFile(file)
  }

  // Reset input so the same file can be selected again
  input.value = ''
}

/**
 * Processes a selected file - validates and converts to base64
 */
async function processFile(file: File) {
  errorMessage.value = null

  // Validate file
  const validationError = validateFile(file)
  if (validationError) {
    errorMessage.value = validationError
    statusAnnouncement.value = validationError
    emit('error', validationError)
    return
  }

  // Convert to base64
  try {
    const base64 = await fileToBase64(file)
    statusAnnouncement.value = 'File selected. Uploading...'
    emit('upload', base64)
  } catch {
    const error = 'Failed to read file. Please try again.'
    errorMessage.value = error
    statusAnnouncement.value = error
    emit('error', error)
  }
}

/**
 * Converts a file to base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Checks if a drag event contains valid file types
 */
function isValidDragType(event: DragEvent): boolean {
  const items = event.dataTransfer?.items
  if (!items) return false

  for (const item of items) {
    if (item.kind === 'file' && acceptedTypes.value.includes(item.type)) {
      return true
    }
  }

  return false
}

/**
 * Handles drag enter event
 */
function handleDragEnter(event: DragEvent) {
  if (props.disabled || props.loading) return

  isDragOver.value = true
  isDragInvalid.value = !isValidDragType(event)
}

/**
 * Handles drag over event
 */
function handleDragOver(event: DragEvent) {
  if (props.disabled || props.loading) return

  isDragOver.value = true
  isDragInvalid.value = !isValidDragType(event)

  // Set drop effect
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = isDragInvalid.value ? 'none' : 'copy'
  }
}

/**
 * Handles drag leave event
 */
function handleDragLeave(event: DragEvent) {
  // Only reset if we're leaving the upload zone entirely
  const relatedTarget = event.relatedTarget as Node | null
  if (uploadZoneRef.value && !uploadZoneRef.value.contains(relatedTarget)) {
    isDragOver.value = false
    isDragInvalid.value = false
  }
}

/**
 * Handles drop event
 */
function handleDrop(event: DragEvent) {
  isDragOver.value = false
  isDragInvalid.value = false

  if (props.disabled || props.loading) return

  const file = event.dataTransfer?.files?.[0]
  if (file) {
    processFile(file)
  }
}

/**
 * Opens the delete confirmation modal
 */
function openDeleteConfirm() {
  if (props.disabled || props.loading) return
  showDeleteConfirm.value = true
}

/**
 * Handles the delete confirmation
 */
function handleDelete() {
  isDeleting.value = true
  emit('delete')
}

/**
 * Clears the error message
 */
function clearError() {
  errorMessage.value = null
}

/**
 * Called by parent when delete completes
 */
function onDeleteComplete() {
  isDeleting.value = false
  showDeleteConfirm.value = false
  statusAnnouncement.value = 'Logo removed successfully.'
}

/**
 * Called by parent when upload completes
 */
function onUploadComplete() {
  statusAnnouncement.value = 'Logo uploaded successfully.'
}

/**
 * Called by parent when an error occurs
 */
function onError(message: string) {
  errorMessage.value = message
  statusAnnouncement.value = message
  isDeleting.value = false
}

// Expose methods for parent component
defineExpose({
  clearError,
  onDeleteComplete,
  onUploadComplete,
  onError,
})
</script>

<style scoped>
.logo-upload-wrapper {
  @apply space-y-3;
}

/* Upload Zone Base Styles */
.logo-upload-zone {
  @apply relative w-full md:w-[200px] h-[180px] md:h-[200px] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px dashed rgba(var(--color-surface-300), 0.8);
}

.logo-upload-zone:hover:not(.is-disabled):not(.is-uploading) {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.03);
}

.logo-upload-zone:focus-visible {
  @apply outline-none;
  border-color: rgb(var(--color-primary-500));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.15);
}

/* Drag States */
.logo-upload-zone.is-drag-over {
  border-style: solid;
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.05);
}

.logo-upload-zone.is-drag-invalid {
  border-color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.05);
}

/* Loading State */
.logo-upload-zone.is-uploading {
  @apply cursor-wait;
  opacity: 0.7;
}

/* Disabled State */
.logo-upload-zone.is-disabled {
  @apply cursor-not-allowed opacity-60;
}

/* Error State */
.logo-upload-zone.has-error {
  border-color: rgb(var(--color-error-500));
}

/* Empty State */
.upload-empty-state {
  @apply flex flex-col items-center justify-center h-full text-center px-4;
}

.upload-icon {
  @apply w-14 h-14 rounded-xl flex items-center justify-center mb-3;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-400));
}

.logo-upload-zone:hover:not(.is-disabled):not(.is-uploading) .upload-icon {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-500));
}

.upload-text {
  @apply text-sm font-medium mb-1;
  color: rgb(var(--color-surface-700));
}

.upload-requirements {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

/* Preview State */
.upload-preview-container {
  @apply relative w-full h-full flex items-center justify-center p-4;
  background: rgba(var(--color-surface-50), 0.5);
}

.upload-preview-image {
  @apply w-full h-full object-contain;
}

/* Delete Overlay */
.upload-preview-overlay {
  @apply absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200;
  background: rgba(0, 0, 0, 0.5);
}

.upload-preview-container:hover .upload-preview-overlay,
.upload-preview-container:focus-within .upload-preview-overlay {
  @apply opacity-100;
}

.upload-delete-btn {
  @apply flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all min-h-[44px];
  background: rgba(var(--color-error-500), 0.9);
}

.upload-delete-btn:hover {
  background: rgb(var(--color-error-600));
}

.upload-delete-btn:focus-visible {
  @apply outline-none;
  box-shadow: 0 0 0 4px rgba(var(--color-error-500), 0.3);
}

/* Loading Overlay */
.upload-loading-overlay {
  @apply absolute inset-0 flex flex-col items-center justify-center;
  background: rgba(var(--color-surface-50), 0.9);
}

.upload-spinner {
  @apply w-8 h-8 border-2 rounded-full animate-spin mb-2;
  border-color: rgb(var(--color-primary-500));
  border-top-color: transparent;
}

.upload-loading-text {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-600));
}

/* Error Message */
.upload-error {
  @apply flex items-center gap-2 text-sm;
  color: rgb(var(--color-error-500));
}

/* Screen Reader Only */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}
</style>
