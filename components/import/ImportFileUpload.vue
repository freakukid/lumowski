<template>
  <div class="file-upload-step">
    <div
      ref="dropZoneRef"
      :class="[
        'drop-zone',
        { 'drag-over': isDragOver },
        { 'has-file': selectedFile !== null },
        { 'has-error': error !== null },
      ]"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
      @click="openFilePicker"
    >
      <input
        ref="fileInputRef"
        type="file"
        :accept="acceptedTypes"
        aria-label="Select inventory file to import"
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- Empty State -->
      <template v-if="!selectedFile && !isLoading">
        <div class="upload-icon">
          <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p class="upload-title">
          <span class="hidden sm:inline">Drag and drop your file here, or </span>
          <span class="upload-link">browse</span>
        </p>
        <p class="upload-hint">
          Supports Excel (.xlsx, .xls), CSV, and JSON files
        </p>
      </template>

      <!-- Loading State -->
      <template v-else-if="isLoading">
        <div class="loading-indicator">
          <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p class="loading-text">Parsing file...</p>
        </div>
      </template>

      <!-- File Selected State -->
      <template v-else-if="selectedFile">
        <div class="file-info">
          <div class="file-icon">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div class="file-details">
            <p class="file-name">{{ selectedFile.name }}</p>
            <p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
          </div>
          <button
            type="button"
            class="remove-file-btn"
            aria-label="Remove selected file"
            @click.stop="clearFile"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </template>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Success Message -->
    <div v-if="parsedFile && !error" class="success-message">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>
        File parsed successfully.
        {{ parsedFile.data.length }} rows found.
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParsedFile } from '~/types/import'

const emit = defineEmits<{
  'file-parsed': [file: ParsedFile]
}>()

const { parseFile, isLoading, error } = useFileParser()

const dropZoneRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const parsedFile = ref<ParsedFile | null>(null)
const isDragOver = ref(false)

const acceptedTypes = '.xlsx,.xls,.csv,.json'

/**
 * Format file size in human readable format
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Validate file type and size
 */
const isValidFileType = (file: File): boolean => {
  // Validate extension
  const validExtensions = ['.xlsx', '.xls', '.csv', '.json']
  const fileName = file.name.toLowerCase()
  if (!validExtensions.some((ext) => fileName.endsWith(ext))) {
    return false
  }

  // Validate MIME type matches extension
  const mimeType = file.type.toLowerCase()
  const validMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/json',
  ]

  // Allow empty MIME type for some files, but prefer strict validation
  if (mimeType && !validMimes.includes(mimeType)) {
    return false
  }

  // Validate file size (50MB max)
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return false
  }

  return true
}

/**
 * Handle file selection
 */
const processFile = async (file: File) => {
  if (!isValidFileType(file)) {
    // Set error message from parser (which validates more thoroughly)
    // The parser will catch any issues and set its own error message
    // This is just a preliminary check
    return
  }

  selectedFile.value = file
  const result = await parseFile(file)

  if (result) {
    parsedFile.value = result
    emit('file-parsed', result)
  }
  // Parser sets error message if file fails validation
}

/**
 * Open native file picker
 */
const openFilePicker = () => {
  fileInputRef.value?.click()
}

/**
 * Handle file input change
 */
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    processFile(file)
  }

  // Reset input so the same file can be selected again
  target.value = ''
}

/**
 * Drag and drop handlers
 */
const handleDragEnter = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true
  }
}

const handleDragOver = (event: DragEvent) => {
  if (event.dataTransfer?.types.includes('Files')) {
    isDragOver.value = true
  }
}

const handleDragLeave = (event: DragEvent) => {
  // Only set to false if leaving the drop zone entirely
  const relatedTarget = event.relatedTarget as Node | null
  if (!dropZoneRef.value?.contains(relatedTarget)) {
    isDragOver.value = false
  }
}

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false

  const file = event.dataTransfer?.files?.[0]
  if (file) {
    processFile(file)
  }
}

/**
 * Clear selected file
 */
const clearFile = () => {
  selectedFile.value = null
  parsedFile.value = null
}
</script>

<style scoped>
.file-upload-step {
  @apply flex flex-col items-center;
}

.drop-zone {
  @apply w-full max-w-xl min-h-[200px] sm:min-h-[250px] flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl cursor-pointer transition-all;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px dashed rgba(var(--color-surface-300), 0.8);
}

.drop-zone:hover {
  background: rgba(var(--color-surface-100), 0.8);
  border-color: rgb(var(--color-primary-400));
}

.drop-zone.drag-over {
  background: rgba(var(--color-primary-500), 0.05);
  border-color: rgb(var(--color-primary-500));
  border-style: solid;
}

.drop-zone.has-file {
  border-style: solid;
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.05);
}

.drop-zone.has-error {
  border-color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.05);
}

.upload-icon {
  @apply mb-4;
  color: rgb(var(--color-surface-400));
}

.drop-zone:hover .upload-icon {
  color: rgb(var(--color-primary-500));
}

.upload-title {
  @apply text-base sm:text-lg font-medium text-center;
  color: rgb(var(--color-surface-700));
}

.upload-link {
  @apply font-semibold underline;
  color: rgb(var(--color-primary-600));
}

.upload-hint {
  @apply mt-2 text-sm text-center;
  color: rgb(var(--color-surface-500));
}

/* Loading State */
.loading-indicator {
  @apply flex flex-col items-center gap-3;
  color: rgb(var(--color-primary-500));
}

.loading-text {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-600));
}

/* File Info */
.file-info {
  @apply flex items-center gap-4 w-full;
}

.file-icon {
  @apply w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.file-details {
  @apply flex-1 min-w-0;
}

.file-name {
  @apply font-medium truncate;
  color: rgb(var(--color-surface-900));
}

.file-size {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.remove-file-btn {
  @apply w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors flex-shrink-0;
  color: rgb(var(--color-surface-500));
}

.remove-file-btn:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-500));
}

/* Messages */
.error-message {
  @apply flex items-center gap-2 mt-4 px-4 py-3 rounded-lg text-sm;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.success-message {
  @apply flex items-center gap-2 mt-4 px-4 py-3 rounded-lg text-sm;
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}
</style>
