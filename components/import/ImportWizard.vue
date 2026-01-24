<template>
  <div class="import-wizard">
    <!-- Step Indicators -->
    <div class="step-indicators" role="progressbar" :aria-valuenow="currentStepIndex + 1" :aria-valuemin="1" :aria-valuemax="visibleSteps.length" :aria-label="`Step ${currentStepIndex + 1} of ${visibleSteps.length}`">
      <div
        v-for="(step, index) in visibleSteps"
        :key="step.id"
        :class="[
          'step-indicator',
          { active: currentStepIndex === index },
          { completed: currentStepIndex > index },
        ]"
        :aria-current="currentStepIndex === index ? 'step' : undefined"
      >
        <div class="step-number">
          <svg
            v-if="currentStepIndex > index"
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span v-else>{{ index + 1 }}</span>
        </div>
        <span class="step-label hidden sm:block">{{ step.label }}</span>
      </div>
    </div>

    <!-- Step Content -->
    <div class="step-content">
      <!-- Step 1: File Upload -->
      <ImportFileUpload
        v-if="currentStep === 'upload'"
        @file-parsed="handleFileParsed"
      />

      <!-- Step 2: Header Selection (skipped for JSON) -->
      <ImportHeaderSelect
        v-else-if="currentStep === 'header'"
        :data="parsedFile!.data"
        :suggested-header-row="parsedFile!.suggestedHeaderRow"
        @header-selected="handleHeaderSelected"
      />

      <!-- Step 3: Column Mapping -->
      <ImportColumnMapping
        v-else-if="currentStep === 'mapping'"
        :file-headers="fileHeaders"
        :schema-columns="schemaColumns"
        :initial-mappings="columnMappings"
        @mappings-updated="handleMappingsUpdated"
        @mapped-count-changed="handleMappedCountChanged"
      />

      <!-- Step 4: Preview & Import -->
      <ImportPreview
        v-else-if="currentStep === 'preview'"
        :data-rows="dataRows"
        :file-headers="fileHeaders"
        :column-mappings="columnMappings"
        :schema-columns="schemaColumns"
        :is-importing="isImporting"
        @import="handleImport"
      />
    </div>

    <!-- Navigation -->
    <div class="step-navigation">
      <button
        v-if="currentStepIndex > 0"
        class="btn btn-secondary"
        :disabled="isImporting"
        aria-label="Go to previous step"
        @click="goBack"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        <span>Back</span>
      </button>
      <div v-else></div>

      <button
        v-if="currentStep !== 'preview' && currentStep !== 'upload'"
        class="btn btn-primary"
        :disabled="!canProceed"
        aria-label="Go to next step"
        @click="goNext"
      >
        <span>Next</span>
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- Import Result Modal -->
    <UiModal
      v-model="showResultModal"
      :title="importResult?.failed === 0 ? 'Import Successful' : 'Import Complete'"
      :variant="importResult?.failed === 0 ? 'success' : 'warning'"
      size="md"
    >
      <div v-if="importResult" class="result-content">
        <div class="result-stats">
          <div class="result-stat success">
            <span class="stat-value">{{ importResult.success }}</span>
            <span class="stat-label">Imported</span>
          </div>
          <div v-if="importResult.failed > 0" class="result-stat failed">
            <span class="stat-value">{{ importResult.failed }}</span>
            <span class="stat-label">Failed</span>
          </div>
        </div>

        <div v-if="importResult.errors.length > 0" class="result-errors">
          <p class="errors-title">Errors:</p>
          <ul class="errors-list">
            <li v-for="(error, index) in importResult.errors.slice(0, 10)" :key="index">
              {{ error }}
            </li>
            <li v-if="importResult.errors.length > 10" class="more-errors">
              ...and {{ importResult.errors.length - 10 }} more errors
            </li>
          </ul>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-primary" @click="finishImport">
          Done
        </button>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import type { ParsedFile, ColumnMapping, ImportResult, NewColumnDefinition } from '~/types/import'
import type { ColumnDefinition } from '~/types/schema'

const emit = defineEmits<{
  complete: []
}>()

const router = useRouter()
const authStore = useAuthStore()
const { schema, fetchSchema } = useSchema()
const { getHeaders, getDataRows } = useFileParser()

// Wizard state
type WizardStep = 'upload' | 'header' | 'mapping' | 'preview'

const steps: { id: WizardStep; label: string }[] = [
  { id: 'upload', label: 'Upload File' },
  { id: 'header', label: 'Select Header' },
  { id: 'mapping', label: 'Map Columns' },
  { id: 'preview', label: 'Preview & Import' },
]

const currentStep = ref<WizardStep>('upload')
const parsedFile = ref<ParsedFile | null>(null)
const headerRowIndex = ref(0)
const columnMappings = ref<ColumnMapping[]>([])
const isImporting = ref(false)
const showResultModal = ref(false)
const importResult = ref<ImportResult | null>(null)
const mappedColumnCount = ref(0)

// Computed
const schemaColumns = computed<ColumnDefinition[]>(() => schema.value || [])

const visibleSteps = computed(() => {
  // Skip header step for JSON files
  if (parsedFile.value?.fileType === 'json') {
    return steps.filter((s) => s.id !== 'header')
  }
  return steps
})

const currentStepIndex = computed(() => {
  return visibleSteps.value.findIndex((s) => s.id === currentStep.value)
})

const fileHeaders = computed(() => {
  if (!parsedFile.value) return []
  return getHeaders(parsedFile.value.data, headerRowIndex.value)
})

const dataRows = computed(() => {
  if (!parsedFile.value) return []
  return getDataRows(parsedFile.value.data, headerRowIndex.value)
})

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 'upload':
      return parsedFile.value !== null
    case 'header':
      return true
    case 'mapping':
      // Check if at least 1 column is mapped
      if (mappedColumnCount.value === 0) {
        return false
      }
      // Also check if all required columns are mapped
      const requiredColumns = schemaColumns.value.filter((c) => c.required)
      const mappedIds = new Set(
        columnMappings.value
          .filter((m) => !m.skip && m.schemaColumnId)
          .map((m) => m.schemaColumnId)
      )
      return requiredColumns.every((c) => mappedIds.has(c.id))
    default:
      return true
  }
})

// Initialize schema on mount
onMounted(async () => {
  await fetchSchema()
})

// Event handlers
const handleFileParsed = (file: ParsedFile) => {
  parsedFile.value = file
  headerRowIndex.value = file.suggestedHeaderRow

  // For JSON files, skip header selection
  if (file.fileType === 'json') {
    headerRowIndex.value = 0 // First row is always header for JSON
    currentStep.value = 'mapping'
    initializeColumnMappings()
  } else {
    currentStep.value = 'header'
  }
}

const handleHeaderSelected = (index: number) => {
  headerRowIndex.value = index
}

const handleMappingsUpdated = (mappings: ColumnMapping[]) => {
  columnMappings.value = mappings
}

const handleMappedCountChanged = (count: number) => {
  mappedColumnCount.value = count
}

const initializeColumnMappings = () => {
  const { autoMatchColumns } = useColumnMatcher()
  columnMappings.value = autoMatchColumns(fileHeaders.value, schemaColumns.value)
}

/**
 * Executes the import API call with the current access token.
 * Extracted to allow retry after token refresh.
 */
const executeImportRequest = async (
  items: { data: Record<string, unknown>; newColumnIndices?: number[] }[],
  newColumns: NewColumnDefinition[]
): Promise<ImportResult> => {
  return await $fetch<ImportResult>('/api/import/execute', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authStore.accessToken}`,
    },
    body: {
      items,
      newColumns: newColumns.length > 0 ? newColumns : undefined,
    },
  })
}

const handleImport = async (importValidOnly: boolean) => {
  if (!parsedFile.value) return

  isImporting.value = true

  try {
    // Transform data based on column mappings
    const itemsToImport = transformDataForImport(importValidOnly)

    // Collect new columns to create
    const newColumns = collectNewColumns()

    // Call import API
    const result = await executeImportRequest(itemsToImport, newColumns)

    importResult.value = result
    showResultModal.value = true
  } catch (error) {
    const err = error as { statusCode?: number; data?: { message?: string } }

    // If 401, try to refresh token and retry
    if (err.statusCode === 401) {
      const refreshed = await authStore.refreshTokens()
      if (refreshed) {
        try {
          // Retry the import request with refreshed token
          const itemsToImport = transformDataForImport(importValidOnly)
          const newColumns = collectNewColumns()
          const result = await executeImportRequest(itemsToImport, newColumns)

          importResult.value = result
          showResultModal.value = true
          return
        } catch (retryError) {
          // Retry failed, show error from retry attempt
          const retryErr = retryError as { data?: { message?: string } }
          importResult.value = {
            success: 0,
            failed: dataRows.value.length,
            errors: [retryErr.data?.message || 'Import failed'],
            total: dataRows.value.length,
          }
          showResultModal.value = true
          return
        }
      }
    }

    // If not 401 or refresh failed, show error
    importResult.value = {
      success: 0,
      failed: dataRows.value.length,
      errors: [err.data?.message || 'Import failed'],
      total: dataRows.value.length,
    }
    showResultModal.value = true
  } finally {
    isImporting.value = false
  }
}

const transformDataForImport = (validOnly: boolean) => {
  const items: { data: Record<string, unknown>; newColumnIndices?: number[] }[] = []
  const newColumnMap = new Map<string, number>() // Maps newColumn name to index

  // Build map of new columns by index in the order they appear
  let newColumnIndex = 0
  for (const mapping of columnMappings.value) {
    if (mapping.newColumn && !mapping.skip) {
      newColumnMap.set(mapping.newColumn.name, newColumnIndex++)
    }
  }

  for (const row of dataRows.value) {
    const itemData: Record<string, unknown> = {}
    let hasValidData = false

    for (const mapping of columnMappings.value) {
      if (mapping.skip) continue

      const value = row[mapping.fileColumnIndex]

      if (mapping.schemaColumnId) {
        // Map to existing schema column
        itemData[mapping.schemaColumnId] = value
        if (value !== null && value !== undefined && value !== '') {
          hasValidData = true
        }
      } else if (mapping.newColumn) {
        // New column - use a numeric index to identify it on the server
        const index = newColumnMap.get(mapping.newColumn.name) ?? -1
        const key = `__new__${index}`
        itemData[key] = value
        if (value !== null && value !== undefined && value !== '') {
          hasValidData = true
        }
      }
    }

    // Only add rows that have at least some data
    if (hasValidData || !validOnly) {
      items.push({ data: itemData })
    }
  }

  return items
}

const collectNewColumns = (): NewColumnDefinition[] => {
  const newColumns: NewColumnDefinition[] = []

  for (const mapping of columnMappings.value) {
    if (!mapping.skip && mapping.newColumn) {
      newColumns.push(mapping.newColumn)
    }
  }

  return newColumns
}

const goBack = () => {
  const stepOrder: WizardStep[] = parsedFile.value?.fileType === 'json'
    ? ['upload', 'mapping', 'preview']
    : ['upload', 'header', 'mapping', 'preview']

  const currentIndex = stepOrder.indexOf(currentStep.value)
  if (currentIndex > 0) {
    currentStep.value = stepOrder[currentIndex - 1]
  }
}

const goNext = () => {
  const stepOrder: WizardStep[] = parsedFile.value?.fileType === 'json'
    ? ['upload', 'mapping', 'preview']
    : ['upload', 'header', 'mapping', 'preview']

  const currentIndex = stepOrder.indexOf(currentStep.value)

  // Initialize column mappings when moving from header to mapping
  if (currentStep.value === 'header') {
    initializeColumnMappings()
  }

  if (currentIndex < stepOrder.length - 1) {
    currentStep.value = stepOrder[currentIndex + 1]
  }
}

const finishImport = () => {
  showResultModal.value = false
  emit('complete')
  router.push('/')
}
</script>

<style scoped>
.import-wizard {
  @apply flex flex-col h-full;
}

.step-indicators {
  @apply flex items-center justify-center gap-2 sm:gap-4 mb-6 px-2;
}

.step-indicator {
  @apply flex items-center gap-2;
}

.step-indicator:not(:last-child)::after {
  content: '';
  @apply w-8 sm:w-12 h-0.5 ml-2;
  background: rgba(var(--color-surface-300), 0.5);
}

.step-indicator.completed:not(:last-child)::after {
  background: rgb(var(--color-primary-500));
}

.step-number {
  @apply w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.step-indicator.active .step-number {
  background: rgb(var(--color-primary-500));
  color: white;
}

.step-indicator.completed .step-number {
  background: rgb(var(--color-primary-500));
  color: white;
}

.step-label {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

.step-indicator.active .step-label {
  color: rgb(var(--color-surface-900));
}

.step-indicator.completed .step-label {
  color: rgb(var(--color-primary-600));
}

.step-content {
  @apply flex-1 overflow-auto;
}

.step-navigation {
  @apply flex items-center justify-between mt-6 pt-6 border-t;
  border-color: rgba(var(--color-surface-200), 0.8);
}

/* Result Modal Styles */
.result-content {
  @apply space-y-4;
}

.result-stats {
  @apply flex items-center justify-center gap-8;
}

.result-stat {
  @apply text-center;
}

.result-stat .stat-value {
  @apply block text-3xl font-bold;
}

.result-stat .stat-label {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.result-stat.success .stat-value {
  color: rgb(var(--color-success-500));
}

.result-stat.failed .stat-value {
  color: rgb(var(--color-error-500));
}

.result-errors {
  @apply mt-4 p-4 rounded-lg;
  background: rgba(var(--color-error-500), 0.05);
  border: 1px solid rgba(var(--color-error-500), 0.2);
}

.errors-title {
  @apply text-sm font-semibold mb-2;
  color: rgb(var(--color-error-600));
}

.errors-list {
  @apply text-sm space-y-1 max-h-40 overflow-y-auto;
  color: rgb(var(--color-surface-700));
}

.more-errors {
  @apply font-medium;
  color: rgb(var(--color-surface-500));
}
</style>
