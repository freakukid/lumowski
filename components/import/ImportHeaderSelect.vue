<template>
  <div class="header-select-step">
    <div class="step-description">
      <h3 class="step-title">Select the header row</h3>
      <p class="step-hint">
        Click on the row that contains your column headers.
        The highlighted row is our best guess.
      </p>
    </div>

    <div class="preview-container">
      <div class="preview-wrapper">
        <table class="preview-table">
          <tbody>
            <tr
              v-for="(row, rowIndex) in previewRows"
              :key="rowIndex"
              :class="[
                'preview-row',
                { suggested: rowIndex === suggestedHeaderRow && selectedRow === null },
                { selected: rowIndex === selectedRow },
                { 'is-header': rowIndex === effectiveHeaderRow },
                { 'is-data': rowIndex > effectiveHeaderRow },
              ]"
              role="button"
              :tabindex="0"
              :aria-pressed="rowIndex === effectiveHeaderRow"
              @click="selectRow(rowIndex)"
              @keydown.enter="selectRow(rowIndex)"
              @keydown.space.prevent="selectRow(rowIndex)"
            >
              <td class="row-number">
                <span class="row-index">{{ rowIndex + 1 }}</span>
                <span v-if="rowIndex === effectiveHeaderRow" class="header-badge">
                  Header
                </span>
              </td>
              <td
                v-for="(cell, cellIndex) in row"
                :key="cellIndex"
                class="preview-cell"
              >
                {{ formatCell(cell) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="data.length > 10" class="preview-footer">
        <p class="preview-info">
          Showing first 10 of {{ data.length }} rows
        </p>
      </div>
    </div>

    <div class="selection-info">
      <div v-if="effectiveHeaderRow !== null" class="selected-header">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          Row {{ effectiveHeaderRow + 1 }} selected as header
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  data: unknown[][]
  suggestedHeaderRow: number
}>()

const emit = defineEmits<{
  'header-selected': [index: number]
}>()

const selectedRow = ref<number | null>(null)

// Show first 10 rows for preview
const previewRows = computed(() => {
  return props.data.slice(0, 10)
})

// The effective header row (selected or suggested)
const effectiveHeaderRow = computed(() => {
  return selectedRow.value !== null ? selectedRow.value : props.suggestedHeaderRow
})

// Format cell value for display
const formatCell = (cell: unknown): string => {
  if (cell === null || cell === undefined) {
    return ''
  }
  const str = String(cell)
  // Truncate long values
  if (str.length > 50) {
    return str.slice(0, 47) + '...'
  }
  return str
}

// Handle row selection
const selectRow = (index: number) => {
  selectedRow.value = index
  emit('header-selected', index)
}

// Emit initial header selection
onMounted(() => {
  emit('header-selected', props.suggestedHeaderRow)
})

// Watch for suggested header changes
watch(
  () => props.suggestedHeaderRow,
  (newValue) => {
    if (selectedRow.value === null) {
      emit('header-selected', newValue)
    }
  }
)
</script>

<style scoped>
.header-select-step {
  @apply space-y-4;
}

.step-description {
  @apply text-center mb-6;
}

.step-title {
  @apply text-lg font-semibold mb-1;
  color: rgb(var(--color-surface-900));
}

.step-hint {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.preview-container {
  @apply rounded-xl overflow-hidden;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.preview-wrapper {
  @apply overflow-x-auto;
}

.preview-table {
  @apply w-full min-w-max;
  border-collapse: collapse;
}

.preview-row {
  @apply cursor-pointer transition-colors;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.5);
}

.preview-row:hover {
  background: rgba(var(--color-surface-200), 0.3);
}

.preview-row.suggested {
  background: rgba(var(--color-primary-500), 0.08);
}

.preview-row.suggested:hover {
  background: rgba(var(--color-primary-500), 0.12);
}

.preview-row.selected,
.preview-row.is-header {
  background: rgba(var(--color-primary-500), 0.15);
}

.preview-row.is-data {
  background: transparent;
}

.row-number {
  @apply px-3 py-2 text-sm font-medium whitespace-nowrap sticky left-0;
  background: rgba(var(--color-surface-100), 0.9);
  color: rgb(var(--color-surface-500));
  min-width: 80px;
}

.preview-row.is-header .row-number {
  background: rgba(var(--color-primary-500), 0.15);
}

.row-index {
  @apply mr-2;
}

.header-badge {
  @apply px-1.5 py-0.5 text-xs font-semibold rounded;
  background: rgb(var(--color-primary-500));
  color: white;
}

.preview-cell {
  @apply px-3 py-2 text-sm whitespace-nowrap;
  color: rgb(var(--color-surface-700));
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-row.is-header .preview-cell {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
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

.selection-info {
  @apply flex justify-center;
}

.selected-header {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}
</style>
