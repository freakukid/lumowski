<template>
  <UiModal
    :model-value="modelValue"
    title="Export Inventory"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="export-content">
      <!-- Format Selection -->
      <div class="form-section">
        <label class="label">Export Format</label>
        <div class="format-options">
          <label
            v-for="format in formatOptions"
            :key="format.value"
            class="format-option"
            :class="{ selected: selectedFormat === format.value }"
          >
            <input
              v-model="selectedFormat"
              type="radio"
              :value="format.value"
              :aria-label="`Export as ${format.label}`"
              class="radio"
            />
            <div class="format-info">
              <span class="format-name">{{ format.label }}</span>
              <span class="format-desc">{{ format.description }}</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Column Selection -->
      <div class="form-section">
        <div class="section-header">
          <label class="label">Columns to Export</label>
          <button
            type="button"
            class="toggle-all-btn"
            @click="toggleAllColumns"
          >
            {{ allColumnsSelected ? 'Deselect All' : 'Select All' }}
          </button>
        </div>
        <div class="column-list">
          <label
            v-for="column in columns"
            :key="column.id"
            class="column-option"
          >
            <input
              v-model="selectedColumnIds"
              type="checkbox"
              :value="column.id"
              :aria-label="`Include ${column.name} in export`"
              class="checkbox"
            />
            <span class="column-name">{{ column.name }}</span>
            <span v-if="column.required" class="required-badge">Required</span>
          </label>
        </div>
      </div>

      <!-- Items Selection -->
      <div class="form-section">
        <label class="label">Items to Export</label>
        <div class="items-options">
          <label class="items-option" :class="{ selected: exportAll }">
            <input
              v-model="exportAll"
              type="radio"
              :value="true"
              aria-label="Export all items"
              class="radio"
            />
            <span>All items ({{ totalItems }})</span>
          </label>
          <label class="items-option" :class="{ selected: !exportAll }">
            <input
              v-model="exportAll"
              type="radio"
              :value="false"
              aria-label="Export current page only"
              class="radio"
            />
            <span>Current page ({{ currentPageItems }})</span>
          </label>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <template #footer>
      <button
        class="btn btn-secondary"
        @click="$emit('update:modelValue', false)"
      >
        Cancel
      </button>
      <button
        class="btn btn-primary"
        :disabled="!canExport || isExporting"
        @click="handleExport"
      >
        <svg v-if="isExporting" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>{{ isExporting ? 'Exporting...' : 'Export' }}</span>
      </button>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'
import type { ExportFormat } from '~/types/import'

const props = defineProps<{
  modelValue: boolean
  items: DynamicInventoryItem[]
  columns: ColumnDefinition[]
  totalItems: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { exportItems, isLoading: isExporting, error } = useExport()

// Format options
const formatOptions: { value: ExportFormat; label: string; description: string }[] = [
  { value: 'xlsx', label: 'Excel', description: '.xlsx spreadsheet' },
  { value: 'csv', label: 'CSV', description: 'Comma-separated values' },
  { value: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
]

// State
const selectedFormat = ref<ExportFormat>('xlsx')
const selectedColumnIds = ref<string[]>([])
const exportAll = ref(true)

// Computed
const currentPageItems = computed(() => props.items.length)

const allColumnsSelected = computed(() => {
  return selectedColumnIds.value.length === props.columns.length
})

const canExport = computed(() => {
  return selectedColumnIds.value.length > 0
})

// Initialize selected columns when modal opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      // Select all columns by default
      selectedColumnIds.value = props.columns.map((c) => c.id)
    }
  }
)

// Toggle all columns
const toggleAllColumns = () => {
  if (allColumnsSelected.value) {
    selectedColumnIds.value = []
  } else {
    selectedColumnIds.value = props.columns.map((c) => c.id)
  }
}

// Handle export
const handleExport = async () => {
  const success = await exportItems(
    props.items,
    props.columns,
    {
      format: selectedFormat.value,
      columnIds: selectedColumnIds.value,
      exportAll: exportAll.value,
    }
  )

  if (success) {
    emit('update:modelValue', false)
  }
}
</script>

<style scoped>
.export-content {
  @apply space-y-6;
}

.form-section {
  @apply space-y-2;
}

.section-header {
  @apply flex items-center justify-between;
}

.toggle-all-btn {
  @apply text-sm font-medium;
  color: rgb(var(--color-primary-600));
}

.toggle-all-btn:hover {
  color: rgb(var(--color-primary-500));
}

/* Format Options */
.format-options {
  @apply space-y-2;
}

.format-option {
  @apply flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid transparent;
}

.format-option:hover {
  background: rgba(var(--color-surface-100), 0.8);
}

.format-option.selected {
  background: rgba(var(--color-primary-500), 0.05);
  border-color: rgb(var(--color-primary-500));
}

.format-info {
  @apply flex flex-col;
}

.format-name {
  @apply font-medium;
  color: rgb(var(--color-surface-900));
}

.format-desc {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Column List */
.column-list {
  @apply max-h-48 overflow-y-auto space-y-1 p-2 rounded-lg;
  background: rgba(var(--color-surface-100), 0.5);
}

.column-option {
  @apply flex items-center gap-3 px-2 py-1.5 rounded cursor-pointer;
}

.column-option:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.column-name {
  @apply flex-1;
  color: rgb(var(--color-surface-700));
}

.required-badge {
  @apply px-1.5 py-0.5 text-xs font-medium rounded;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

/* Items Options */
.items-options {
  @apply flex flex-col sm:flex-row gap-2;
}

.items-option {
  @apply flex items-center gap-3 flex-1 p-3 rounded-lg cursor-pointer transition-colors;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid transparent;
  color: rgb(var(--color-surface-700));
}

.items-option:hover {
  background: rgba(var(--color-surface-100), 0.8);
}

.items-option.selected {
  background: rgba(var(--color-primary-500), 0.05);
  border-color: rgb(var(--color-primary-500));
  color: rgb(var(--color-surface-900));
}

/* Error Message */
.error-message {
  @apply px-4 py-3 rounded-lg text-sm;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}
</style>
