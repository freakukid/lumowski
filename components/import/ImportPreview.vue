<template>
  <div class="preview-step">
    <div class="step-description">
      <h3 class="step-title">Preview and import</h3>
      <p class="step-hint">
        Review your data before importing. Rows with errors are highlighted in red.
      </p>
    </div>

    <!-- Warning Summary Banner -->
    <div v-if="totalWarningCount > 0" class="warning-banner">
      <div class="warning-banner-content">
        <svg class="warning-banner-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="warning-banner-text">
          {{ totalWarningCount }} {{ totalWarningCount === 1 ? 'value' : 'values' }} will be automatically modified during import
        </span>
        <button
          class="warning-banner-toggle"
          @click="showWarningsPanel = !showWarningsPanel"
        >
          {{ showWarningsPanel ? 'Hide details' : 'Show details' }}
          <svg
            class="w-4 h-4 transition-transform"
            :class="{ 'rotate-180': showWarningsPanel }"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <!-- Expandable Warning Details Panel -->
      <div v-if="showWarningsPanel" class="warning-details-panel">
        <div class="warning-details-list">
          <div
            v-for="(item, index) in allWarnings.slice(0, 20)"
            :key="index"
            class="warning-detail-item"
          >
            <span class="warning-detail-row">Row {{ item.rowIndex + 1 }}</span>
            <span class="warning-detail-column">{{ item.warning.columnName }}</span>
            <span class="warning-detail-type">{{ formatWarningType(item.warning.type) }}</span>
            <span class="warning-detail-change">
              <span class="warning-original" :title="item.warning.originalValue">
                {{ item.warning.originalValue.length > 20 ? item.warning.originalValue.slice(0, 17) + '...' : item.warning.originalValue || '(empty)' }}
              </span>
              <svg class="warning-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span class="warning-sanitized" :title="item.warning.sanitizedValue">
                {{ item.warning.sanitizedValue.length > 20 ? item.warning.sanitizedValue.slice(0, 17) + '...' : item.warning.sanitizedValue || '(empty)' }}
              </span>
            </span>
          </div>
          <div v-if="allWarnings.length > 20" class="warning-details-more">
            And {{ allWarnings.length - 20 }} more...
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="preview-stats">
      <div class="stat valid">
        <span class="stat-value">{{ validCount }}</span>
        <span class="stat-label">Valid rows</span>
      </div>
      <div v-if="invalidCount > 0" class="stat invalid">
        <span class="stat-value">{{ invalidCount }}</span>
        <span class="stat-label">With errors</span>
      </div>
      <div v-if="totalWarningCount > 0" class="stat warning">
        <span class="stat-value">{{ totalWarningCount }}</span>
        <span class="stat-label">Values modified</span>
      </div>
    </div>

    <!-- Preview Table -->
    <div class="preview-container">
      <div class="preview-wrapper">
        <table class="preview-table">
          <thead>
            <tr>
              <th class="row-status-header">Status</th>
              <th
                v-for="mapping in activeMappings"
                :key="mapping.fileColumnIndex"
                class="column-header"
              >
                <span class="header-file">{{ mapping.fileColumnName }}</span>
                <span class="header-target">
                  {{ getTargetColumnName(mapping) }}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rowIndex) in previewData"
              :key="rowIndex"
              :class="['data-row', { 'has-error': !row.validation.isValid }]"
            >
              <td class="row-status">
                <span v-if="row.validation.isValid" class="status-icon valid">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span v-else class="status-icon invalid" :title="row.validation.errors.join('\n')">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </td>
              <td
                v-for="mapping in activeMappings"
                :key="mapping.fileColumnIndex"
                :class="['data-cell', { 'has-warning': getCellWarning(row, mapping) }]"
              >
                <span class="cell-content">
                  {{ formatSanitizedCellValue(row, mapping) }}
                </span>
                <span
                  v-if="getCellWarning(row, mapping)"
                  class="cell-warning-indicator"
                  :title="getWarningTooltip(getCellWarning(row, mapping)!)"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasPagination" class="preview-footer">
        <div class="pagination-controls">
          <button type="button" class="pagination-btn" :disabled="isPreviousDisabled" :aria-disabled="isPreviousDisabled" aria-label="Previous page" @click="goToPreviousPage">
            <svg class="pagination-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="pagination-info">Rows {{ startRowNumber }}-{{ endRowNumber }} of {{ totalRowCount }}</span>
          <button type="button" class="pagination-btn" :disabled="isNextDisabled" :aria-disabled="isNextDisabled" aria-label="Next page" @click="goToNextPage">
            <svg class="pagination-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Import Options -->
    <div class="import-options">
      <div class="import-buttons">
        <button
          class="btn btn-primary"
          :disabled="isImporting || validCount === 0"
          @click="requestImport(false)"
        >
          <svg v-if="isImporting" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{{ isImporting ? 'Importing...' : 'Import All' }}</span>
          <span class="btn-count">({{ totalRowCount }})</span>
        </button>

        <button
          v-if="invalidCount > 0"
          class="btn btn-secondary"
          :disabled="isImporting || validCount === 0"
          @click="requestImport(true)"
        >
          <span>Import Valid Only</span>
          <span class="btn-count">({{ validCount }})</span>
        </button>
      </div>
    </div>

    <!-- Confirmation Modal for imports with errors -->
    <UiModal
      v-model="showConfirmModal"
      title="Confirm Import"
      variant="warning"
      size="sm"
    >
      <div class="confirm-content">
        <!-- Warning Icon -->
        <div class="confirm-icon">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <!-- Message -->
        <p class="confirm-message">
          Some rows contain validation errors and will be skipped during import.
        </p>

        <!-- Stats Summary -->
        <div class="confirm-stats">
          <div class="confirm-stat will-import">
            <span class="confirm-stat-icon">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="confirm-stat-value">{{ pendingImportCount }}</span>
            <span class="confirm-stat-label">{{ pendingImportCount === 1 ? 'row' : 'rows' }} will be imported</span>
          </div>
          <div class="confirm-stat will-skip">
            <span class="confirm-stat-icon">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
            <span class="confirm-stat-value">{{ pendingSkipCount }}</span>
            <span class="confirm-stat-label">{{ pendingSkipCount === 1 ? 'row' : 'rows' }} will be skipped</span>
          </div>
          <div v-if="totalWarningCount > 0" class="confirm-stat has-warnings">
            <span class="confirm-stat-icon">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <span class="confirm-stat-value">{{ totalWarningCount }}</span>
            <span class="confirm-stat-label">{{ totalWarningCount === 1 ? 'value' : 'values' }} will be modified</span>
          </div>
        </div>
      </div>

      <template #footer>
        <button
          class="btn btn-secondary"
          @click="cancelImport"
        >
          Cancel
        </button>
        <button
          class="btn btn-primary"
          @click="confirmImport"
        >
          Continue Import
        </button>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition } from '~/types/schema'
import type { ColumnMapping, ValidationStatus, SanitizationWarning } from '~/types/import'
import { sanitizeCell, formatWarningType } from '~/server/utils/sanitization'

const props = defineProps<{
  dataRows: unknown[][]
  fileHeaders: string[]
  columnMappings: ColumnMapping[]
  schemaColumns: ColumnDefinition[]
  isImporting: boolean
}>()

const emit = defineEmits<{
  import: [validOnly: boolean]
}>()

// Pagination state
const currentPage = ref(1)
const rowsPerPage = 50

const totalPages = computed(() => Math.ceil(props.dataRows.length / rowsPerPage))
const hasPagination = computed(() => props.dataRows.length > rowsPerPage)
const startRowIndex = computed(() => (currentPage.value - 1) * rowsPerPage)
const endRowIndex = computed(() => Math.min(startRowIndex.value + rowsPerPage, props.dataRows.length))
const startRowNumber = computed(() => startRowIndex.value + 1)
const endRowNumber = computed(() => endRowIndex.value)
const isPreviousDisabled = computed(() => currentPage.value <= 1)
const isNextDisabled = computed(() => currentPage.value >= totalPages.value)

const goToPreviousPage = () => { if (currentPage.value > 1) currentPage.value-- }
const goToNextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++ }

// Confirmation modal state
const showConfirmModal = ref(false)
const pendingValidOnly = ref(false)

// Total row count for display
const totalRowCount = computed(() => props.dataRows.length)

// Computed values for confirmation modal
const pendingImportCount = computed(() => {
  // If importing valid only, show valid count; otherwise show all rows
  return pendingValidOnly.value ? validCount.value : totalRowCount.value
})

const pendingSkipCount = computed(() => {
  // Shows invalid count - these rows will be skipped regardless of import mode
  return invalidCount.value
})

// Active mappings (not skipped)
const activeMappings = computed(() => {
  return props.columnMappings.filter((m) => !m.skip)
})

// Preview data with validation (paginated)
const previewData = computed(() => {
  const rows = props.dataRows.slice(startRowIndex.value, endRowIndex.value)

  return rows.map((row, index) => {
    const absoluteIndex = startRowIndex.value + index
    const validation = validateRow(row, absoluteIndex)
    return {
      data: row,
      validation,
      absoluteIndex,
    }
  })
})

// Count of valid rows
const validCount = computed(() => {
  return props.dataRows.reduce((count, row, index) => {
    const validation = validateRow(row, index)
    return validation.isValid ? count + 1 : count
  }, 0)
})

// Count of invalid rows
const invalidCount = computed(() => {
  return props.dataRows.length - validCount.value
})

// Count of total warnings across all rows
const totalWarningCount = computed(() => {
  return props.dataRows.reduce((count, row, index) => {
    const validation = validateRow(row, index)
    return count + validation.warnings.length
  }, 0)
})

// Expandable warnings panel state
const showWarningsPanel = ref(false)

// Get all warnings for expandable panel (all rows, not just preview)
// NOTE: Only validates when panel is open to avoid expensive computation
const allWarnings = computed(() => {
  // Early return if panel is closed - avoid expensive validation
  if (!showWarningsPanel.value) {
    return []
  }

  const warnings: Array<{ rowIndex: number; warning: SanitizationWarning }> = []

  props.dataRows.forEach((row, index) => {
    const validation = validateRow(row, index)
    validation.warnings.forEach((warning) => {
      warnings.push({ rowIndex: index, warning })
    })
  })

  return warnings
})

// Get warnings for a specific cell in the current row
const getCellWarning = (row: { data: unknown[]; validation: ValidationStatus }, mapping: ColumnMapping): SanitizationWarning | null => {
  const columnId = mapping.schemaColumnId || (mapping.newColumn ? `__new__${props.columnMappings.indexOf(mapping)}` : null)
  if (!columnId) return null

  return row.validation.warnings.find((w) => w.columnId === columnId) || null
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Used when displaying user-provided values in tooltips or other contexts.
 */
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Generates a safe tooltip string for a sanitization warning.
 * Escapes HTML special characters to prevent XSS.
 */
const getWarningTooltip = (warning: SanitizationWarning): string => {
  return `${formatWarningType(warning.type)}: '${escapeHtml(warning.originalValue)}' → '${escapeHtml(warning.sanitizedValue)}'`
}

// Format sanitized value for display in cell
const formatSanitizedCellValue = (row: { data: unknown[]; validation: ValidationStatus }, mapping: ColumnMapping): string => {
  const warning = getCellWarning(row, mapping)
  const rawValue = row.data[mapping.fileColumnIndex]

  // If there's a warning, show the sanitized value
  if (warning) {
    const sanitized = warning.sanitizedValue
    if (sanitized.length > 50) {
      return sanitized.slice(0, 47) + '...'
    }
    return sanitized
  }

  // Otherwise show the original value
  return formatCellValue(rawValue)
}

// Validate a single row against schema requirements with sanitization
const validateRow = (row: unknown[], rowIndex: number): ValidationStatus => {
  const errors: string[] = []
  const warnings: SanitizationWarning[] = []
  const transformedData: Record<string, unknown> = {}

  for (const mapping of activeMappings.value) {
    const rawValue = row[mapping.fileColumnIndex]
    const columnId = mapping.schemaColumnId

    if (columnId) {
      const column = props.schemaColumns.find((c) => c.id === columnId)

      if (column) {
        // Sanitize the value based on column type
        const sanitized = sanitizeCell(rawValue, column.type)
        const sanitizedValue = sanitized.value

        // Track sanitization warnings
        if (sanitized.warning) {
          warnings.push({
            columnId: column.id,
            columnName: column.name,
            originalValue: rawValue === null || rawValue === undefined ? '' : String(rawValue),
            sanitizedValue: sanitizedValue === null || sanitizedValue === undefined ? '' : String(sanitizedValue),
            type: sanitized.warningType || 'other',
          })
        }

        // Check required fields (after sanitization)
        if (column.required && (sanitizedValue === null || sanitizedValue === undefined || sanitizedValue === '')) {
          errors.push(`${column.name} is required`)
        }

        // Type validation (after sanitization)
        if (sanitizedValue !== null && sanitizedValue !== undefined && sanitizedValue !== '') {
          switch (column.type) {
            case 'number':
            case 'currency':
              // After sanitization, if we got a value it should be valid
              // Only error if sanitization completely failed
              if (typeof sanitizedValue !== 'number') {
                errors.push(`${column.name} must be a number`)
              }
              break
            case 'date':
              // After sanitization, check if date is valid
              if (typeof sanitizedValue !== 'string' || isNaN(Date.parse(sanitizedValue))) {
                errors.push(`${column.name} must be a valid date`)
              }
              break
            case 'select':
              if (column.options && !column.options.includes(String(sanitizedValue))) {
                errors.push(`${column.name} must be one of: ${column.options.join(', ')}`)
              }
              break
          }
        }

        // Store the sanitized value
        transformedData[columnId] = sanitizedValue
      }
    } else if (mapping.newColumn) {
      // Handle new columns - still apply sanitization for preview
      const sanitized = sanitizeCell(rawValue, mapping.newColumn.type)

      if (sanitized.warning) {
        warnings.push({
          columnId: `__new__${props.columnMappings.indexOf(mapping)}`,
          columnName: mapping.newColumn.name,
          originalValue: rawValue === null || rawValue === undefined ? '' : String(rawValue),
          sanitizedValue: sanitized.value === null || sanitized.value === undefined ? '' : String(sanitized.value),
          type: sanitized.warningType || 'other',
        })
      }
    }
  }

  return {
    rowIndex,
    isValid: errors.length === 0,
    errors,
    transformedData: errors.length === 0 ? transformedData : null,
    warnings,
  }
}

// Get target column name for header display
const getTargetColumnName = (mapping: ColumnMapping): string => {
  if (mapping.schemaColumnId) {
    const column = props.schemaColumns.find((c) => c.id === mapping.schemaColumnId)
    return column?.name || 'Unknown'
  }
  if (mapping.newColumn) {
    return `New: ${mapping.newColumn.name}`
  }
  return 'Skipped'
}

// Format cell value for display
const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }
  const str = String(value)
  if (str.length > 50) {
    return str.slice(0, 47) + '...'
  }
  return str
}

// Request import - shows confirmation if there are errors
const requestImport = (validOnly: boolean) => {
  // If there are invalid rows, show confirmation dialog
  if (invalidCount.value > 0) {
    pendingValidOnly.value = validOnly
    showConfirmModal.value = true
  } else {
    // No errors, proceed directly
    emit('import', validOnly)
  }
}

// Cancel the pending import
const cancelImport = () => {
  showConfirmModal.value = false
}

// Confirm and proceed with import
const confirmImport = () => {
  showConfirmModal.value = false
  emit('import', pendingValidOnly.value)
}
</script>

<style scoped>
.preview-step {
  @apply space-y-4;
}

.step-description {
  @apply text-center mb-4;
}

.step-title {
  @apply text-lg font-semibold mb-1;
  color: rgb(var(--color-surface-900));
}

.step-hint {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Stats */
.preview-stats {
  @apply flex items-center justify-center gap-6;
}

.stat {
  @apply text-center;
}

.stat-value {
  @apply block text-2xl font-bold;
}

.stat-label {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.stat.valid .stat-value {
  color: rgb(var(--color-success-500));
}

.stat.invalid .stat-value {
  color: rgb(var(--color-error-500));
}

.stat.warning .stat-value {
  color: rgb(var(--color-warning-500));
}

/* Preview Table */
.preview-container {
  @apply rounded-xl overflow-hidden;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.preview-wrapper {
  @apply overflow-x-auto max-h-[400px] overflow-y-auto;
}

.preview-table {
  @apply w-full min-w-max;
  border-collapse: collapse;
}

.preview-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

.row-status-header,
.column-header {
  @apply px-3 py-3 text-left text-sm font-semibold;
  background: rgba(var(--color-surface-100), 0.95);
  color: rgb(var(--color-surface-700));
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.row-status-header {
  @apply w-16 text-center sticky left-0;
}

.column-header {
  @apply min-w-[120px];
}

.header-file {
  @apply block truncate;
  color: rgb(var(--color-surface-900));
}

.header-target {
  @apply block text-xs font-normal mt-0.5;
  color: rgb(var(--color-primary-600));
}

.data-row {
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.5);
}

.data-row:hover {
  background: rgba(var(--color-surface-100), 0.5);
}

.data-row.has-error {
  background: rgba(var(--color-error-500), 0.05);
}

.data-row.has-error:hover {
  background: rgba(var(--color-error-500), 0.08);
}

.row-status {
  @apply px-3 py-2 text-center sticky left-0;
  background: rgba(var(--color-surface-50), 0.95);
}

.data-row.has-error .row-status {
  background: rgba(254, 242, 242, 0.95);
}

.status-icon {
  @apply inline-flex items-center justify-center w-6 h-6 rounded-full;
}

.status-icon.valid {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-500));
}

.status-icon.invalid {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-500));
  cursor: help;
}

.preview-footer {
  @apply px-4 py-3 border-t;
  border-color: rgba(var(--color-surface-200), 0.5);
  background: rgba(var(--color-surface-50), 0.8);
}

.preview-info {
  @apply text-sm text-center;
  color: rgb(var(--color-surface-500));
}

/* Pagination Controls */
.pagination-controls {
  @apply flex items-center justify-center gap-4;
}

.pagination-btn {
  @apply flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

.pagination-btn:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

.pagination-btn:disabled {
  @apply opacity-40 cursor-not-allowed;
}

.pagination-icon {
  @apply w-5 h-5;
}

.pagination-info {
  @apply text-sm font-medium min-w-[140px] text-center;
  color: rgb(var(--color-surface-500));
}

/* Import Options */
.import-options {
  @apply flex justify-end pt-4;
}

.import-buttons {
  @apply flex flex-col sm:flex-row items-stretch sm:items-center gap-3;
}

.btn-count {
  @apply text-sm opacity-75;
}

/* Confirmation Modal Content */
.confirm-content {
  @apply text-center;
}

.confirm-icon {
  @apply mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-500));
}

.confirm-message {
  @apply text-sm mb-5;
  color: rgb(var(--color-surface-600));
}

.confirm-stats {
  @apply space-y-3;
}

.confirm-stat {
  @apply flex items-center gap-2 px-4 py-3 rounded-lg;
}

.confirm-stat.will-import {
  background: rgba(var(--color-success-500), 0.08);
}

.confirm-stat.will-skip {
  background: rgba(var(--color-error-500), 0.08);
}

.confirm-stat-icon {
  @apply flex-shrink-0 w-5 h-5 flex items-center justify-center;
}

.confirm-stat.will-import .confirm-stat-icon {
  color: rgb(var(--color-success-500));
}

.confirm-stat.will-skip .confirm-stat-icon {
  color: rgb(var(--color-error-500));
}

.confirm-stat-value {
  @apply font-bold;
  color: rgb(var(--color-surface-900));
}

.confirm-stat-label {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

.confirm-stat.has-warnings {
  background: rgba(var(--color-warning-500), 0.08);
}

.confirm-stat.has-warnings .confirm-stat-icon {
  color: rgb(var(--color-warning-500));
}

/* Warning Banner */
.warning-banner {
  @apply rounded-xl overflow-hidden;
  background: rgba(var(--color-warning-500), 0.08);
  border: 1px solid rgba(var(--color-warning-500), 0.2);
}

.warning-banner-content {
  @apply flex items-center gap-3 px-4 py-3;
}

.warning-banner-icon {
  @apply w-5 h-5 flex-shrink-0;
  color: rgb(var(--color-warning-500));
}

.warning-banner-text {
  @apply flex-1 text-sm;
  color: rgb(var(--color-surface-700));
}

.warning-banner-toggle {
  @apply flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors;
  color: rgb(var(--color-warning-500));
  background: rgba(var(--color-warning-500), 0.1);
}

.warning-banner-toggle:hover {
  background: rgba(var(--color-warning-500), 0.15);
}

/* Warning Details Panel */
.warning-details-panel {
  @apply border-t px-4 py-3;
  border-color: rgba(var(--color-warning-500), 0.2);
  background: rgba(var(--color-warning-500), 0.03);
}

.warning-details-list {
  @apply space-y-2 max-h-[200px] overflow-y-auto;
}

.warning-detail-item {
  @apply flex items-center gap-3 text-sm py-2 px-3 rounded-lg;
  background: rgba(var(--color-surface-100), 0.8);
}

.warning-detail-row {
  @apply font-medium w-16 flex-shrink-0;
  color: rgb(var(--color-surface-500));
}

.warning-detail-column {
  @apply font-medium w-28 flex-shrink-0 truncate;
  color: rgb(var(--color-surface-700));
}

.warning-detail-type {
  @apply text-xs px-2 py-0.5 rounded flex-shrink-0;
  background: rgba(var(--color-warning-500), 0.15);
  color: rgb(var(--color-warning-700));
}

.warning-detail-change {
  @apply flex items-center gap-2 flex-1 min-w-0;
}

.warning-original {
  @apply text-xs px-2 py-0.5 rounded truncate;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-surface-600));
  text-decoration: line-through;
}

.warning-arrow {
  @apply w-3 h-3 flex-shrink-0;
  color: rgb(var(--color-surface-400));
}

.warning-sanitized {
  @apply text-xs px-2 py-0.5 rounded truncate;
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-surface-700));
}

.warning-details-more {
  @apply text-sm text-center py-2;
  color: rgb(var(--color-surface-500));
}

/* Cell Warning Indicators */
.data-cell {
  @apply px-3 py-2 text-sm relative;
  color: rgb(var(--color-surface-700));
  max-width: 200px;
}

.data-cell .cell-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.data-cell.has-warning {
  background: rgba(var(--color-warning-500), 0.05);
}

.data-cell.has-warning .cell-content {
  padding-right: 1.25rem;
}

.cell-warning-indicator {
  @apply absolute right-2 top-1/2 -translate-y-1/2 cursor-help;
  color: rgb(var(--color-warning-500));
}
</style>
