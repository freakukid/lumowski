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
                { suggested: getAbsoluteRowIndex(rowIndex) === suggestedHeaderRow && selectedRow === null },
                { selected: getAbsoluteRowIndex(rowIndex) === selectedRow },
                { 'is-header': getAbsoluteRowIndex(rowIndex) === effectiveHeaderRow },
                { 'is-data': getAbsoluteRowIndex(rowIndex) > effectiveHeaderRow },
              ]"
              role="button"
              :tabindex="0"
              :aria-pressed="getAbsoluteRowIndex(rowIndex) === effectiveHeaderRow"
              @click="selectRow(rowIndex)"
              @keydown.enter="selectRow(rowIndex)"
              @keydown.space.prevent="selectRow(rowIndex)"
            >
              <td class="row-number">
                <span class="row-index">{{ startRowNumber + rowIndex }}</span>
                <span v-if="getAbsoluteRowIndex(rowIndex) === effectiveHeaderRow" class="header-badge">
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

      <div v-if="hasPagination" class="preview-footer">
        <div class="pagination-controls">
          <button
            type="button"
            class="pagination-btn"
            :disabled="isPreviousDisabled"
            :aria-disabled="isPreviousDisabled"
            aria-label="Previous page"
            @click="goToPreviousPage"
          >
            <svg class="pagination-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="pagination-info">
            Rows {{ startRowNumber }}-{{ Math.min(startRowNumber + rowsPerPage - 1, data.length) }} of {{ data.length }}
          </span>
          <button
            type="button"
            class="pagination-btn"
            :disabled="isNextDisabled"
            :aria-disabled="isNextDisabled"
            aria-label="Next page"
            @click="goToNextPage"
          >
            <svg class="pagination-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
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

// Pagination state
const currentPage = ref(1)
const rowsPerPage = 10
const totalPages = computed(() => Math.ceil(props.data.length / rowsPerPage))
const hasPagination = computed(() => props.data.length > rowsPerPage)
const startRowNumber = computed(() => (currentPage.value - 1) * rowsPerPage + 1)
const isPreviousDisabled = computed(() => currentPage.value <= 1)
const isNextDisabled = computed(() => currentPage.value >= totalPages.value)

const goToPreviousPage = () => {
  if (currentPage.value > 1) currentPage.value--
}
const goToNextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}
const getAbsoluteRowIndex = (pageRelativeIndex: number): number => {
  return (currentPage.value - 1) * rowsPerPage + pageRelativeIndex
}

// Show paginated rows for preview
const previewRows = computed(() => {
  const startIndex = (currentPage.value - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  return props.data.slice(startIndex, endIndex)
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
const selectRow = (pageRelativeIndex: number) => {
  const absoluteIndex = getAbsoluteRowIndex(pageRelativeIndex)
  selectedRow.value = absoluteIndex
  emit('header-selected', absoluteIndex)
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

.selection-info {
  @apply flex justify-center;
}

.selected-header {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}
</style>
