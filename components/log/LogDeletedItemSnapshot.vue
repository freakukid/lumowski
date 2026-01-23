<template>
  <div class="snapshot-fields" role="region" aria-label="Deleted item data snapshot">
    <!-- Loading state when schema is being fetched -->
    <div v-if="schemaLoading" class="loading-skeleton">
      <div v-for="i in 4" :key="i" class="skeleton-row">
        <div class="skeleton-label"></div>
        <div class="skeleton-value"></div>
      </div>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Empty state if no data -->
      <div v-if="!itemData || Object.keys(itemData).length === 0" class="empty-data">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>No data recorded for this item</span>
      </div>

      <!-- Field list -->
      <dl v-else class="field-list">
        <div
          v-for="field in formattedFields"
          :key="field.columnId"
          class="field-row"
          :class="{ 'field-row-unknown': field.isUnknownColumn }"
        >
          <dt class="field-label">
            <span class="label-text">{{ field.columnName }}</span>
            <span v-if="field.columnType" class="label-type">{{ field.columnType }}</span>
            <span v-if="field.isUnknownColumn" class="label-warning" title="This column no longer exists in the schema">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </dt>
          <dd class="field-value">
            <!-- Currency formatting -->
            <span v-if="field.columnType === 'currency'" class="value-currency">
              {{ formatCurrency(field.rawValue) }}
            </span>

            <!-- Date formatting -->
            <span v-else-if="field.columnType === 'date'" class="value-date">
              {{ formatDate(field.rawValue) }}
            </span>

            <!-- Number formatting -->
            <span v-else-if="field.columnType === 'number'" class="value-number">
              {{ formatNumber(field.rawValue) }}
            </span>

            <!-- Select/badge formatting -->
            <span v-else-if="field.columnType === 'select'" class="value-select">
              {{ field.displayValue }}
            </span>

            <!-- Text or unknown type -->
            <span v-else class="value-text">
              {{ field.displayValue }}
            </span>
          </dd>
        </div>
      </dl>

      <!-- Schema mismatch warning -->
      <div v-if="hasUnknownColumns" class="schema-warning">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Some columns have been modified or removed since this item was deleted.</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition } from '~/types/schema'

interface Props {
  /** The snapshot data object containing { columnId: value } pairs */
  data: Record<string, unknown>
  /** Optional: Pre-loaded column definitions. If not provided, will use store. */
  columns?: ColumnDefinition[]
}

const props = defineProps<Props>()

// Get schema from store if not provided via props
const inventoryStore = useInventoryStore()
const { fetchSchema, isLoading: schemaLoading } = useSchema()

// Use provided columns or fall back to store
const schemaColumns = computed(() => {
  return props.columns || inventoryStore.schema
})

// Fetch schema on mount if not available
onMounted(async () => {
  if (!props.columns && inventoryStore.schema.length === 0) {
    await fetchSchema()
  }
})

/**
 * Item data from snapshot
 */
const itemData = computed(() => {
  return props.data || {}
})

/**
 * Build a map of column ID to column definition for quick lookups
 */
const columnMap = computed(() => {
  const map = new Map<string, ColumnDefinition>()
  for (const col of schemaColumns.value) {
    map.set(col.id, col)
  }
  return map
})

/**
 * Interface for formatted field display
 */
interface FormattedField {
  columnId: string
  columnName: string
  columnType: string | null
  rawValue: unknown
  displayValue: string
  isUnknownColumn: boolean
  order: number
}

/**
 * Transform the raw data into formatted fields for display
 */
const formattedFields = computed((): FormattedField[] => {
  const fields: FormattedField[] = []

  for (const [columnId, value] of Object.entries(itemData.value)) {
    const column = columnMap.value.get(columnId)

    if (column) {
      // Known column - use column metadata
      fields.push({
        columnId,
        columnName: column.name,
        columnType: column.type,
        rawValue: value,
        displayValue: formatDisplayValue(value, column.type),
        isUnknownColumn: false,
        order: column.order,
      })
    } else {
      // Unknown column - column was deleted or modified
      fields.push({
        columnId,
        columnName: truncateId(columnId),
        columnType: null,
        rawValue: value,
        displayValue: formatDisplayValue(value, null),
        isUnknownColumn: true,
        order: Number.MAX_SAFE_INTEGER, // Put unknown columns at the end
      })
    }
  }

  // Sort by column order
  return fields.sort((a, b) => a.order - b.order)
})

/**
 * Check if there are any unknown columns
 */
const hasUnknownColumns = computed(() => {
  return formattedFields.value.some(f => f.isUnknownColumn)
})

/**
 * Basic display value formatter for unknown/text types.
 * Type-specific formatting (currency, date, number) is done directly in the template.
 * Select types use this for their display value.
 *
 * Returns '-' for empty/null/undefined values.
 */
function formatDisplayValue(value: unknown, type: string | null): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  // For unknown types, just stringify
  if (!type) {
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  return String(value)
}

/**
 * Format currency values
 */
function formatCurrency(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  const num = Number(value)
  if (isNaN(num)) {
    return String(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

/**
 * Format date values
 */
function formatDate(value: unknown): string {
  if (!value) {
    return '-'
  }
  const date = new Date(String(value))
  if (isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format number values
 */
function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  const num = Number(value)
  if (isNaN(num)) {
    return String(value)
  }
  return num.toLocaleString()
}

/**
 * Truncate UUID for display when column is unknown
 */
function truncateId(id: string): string {
  if (id.length <= 12) {
    return id
  }
  return `${id.substring(0, 8)}...`
}
</script>

<style scoped>
.snapshot-fields {
  @apply rounded-lg p-4;
  background: rgba(var(--color-surface-100), 0.5);
}

/* Loading skeleton */
.loading-skeleton {
  @apply space-y-3;
}

.skeleton-row {
  @apply flex items-center gap-4;
}

.skeleton-label {
  @apply h-4 w-24 rounded;
  background: rgba(var(--color-surface-300), 0.5);
  animation: pulse 1.5s ease-in-out infinite;
}

.skeleton-value {
  @apply h-4 flex-1 rounded;
  background: rgba(var(--color-surface-200), 0.5);
  animation: pulse 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Empty state */
.empty-data {
  @apply flex items-center gap-2 py-4 text-sm;
  color: rgb(var(--color-surface-500));
}

/* Field list */
.field-list {
  @apply divide-y;
  border-color: rgba(var(--color-surface-200), 0.6);
}

.field-row {
  @apply py-3 flex flex-col sm:grid sm:grid-cols-3 gap-1 sm:gap-4;
}

.field-row:first-child {
  @apply pt-0;
}

.field-row:last-child {
  @apply pb-0;
}

.field-row-unknown {
  @apply opacity-75;
}

/* Field label */
.field-label {
  @apply flex items-center gap-2 text-xs sm:text-sm font-semibold;
  color: rgb(var(--color-surface-500));
}

.label-text {
  @apply truncate;
}

.label-type {
  @apply text-xs px-1.5 py-0.5 rounded font-medium shrink-0;
  background: rgba(var(--color-surface-200), 0.6);
  color: rgb(var(--color-surface-500));
}

.label-warning {
  @apply shrink-0;
  color: rgb(var(--color-warning-500));
}

/* Field value */
.field-value {
  @apply text-sm sm:col-span-2;
  color: rgb(var(--color-surface-900));
}

/* Value type styling */
.value-currency {
  @apply font-medium;
  color: rgb(var(--color-primary-600));
}

.value-date {
  color: rgb(var(--color-surface-700));
}

.value-number {
  @apply font-medium tabular-nums;
}

.value-select {
  @apply inline-block px-2 py-0.5 text-xs font-medium rounded;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}

.value-text {
  @apply break-words;
}

/* Schema warning */
.schema-warning {
  @apply flex items-start gap-2 mt-4 pt-4 text-xs border-t;
  border-color: rgba(var(--color-surface-200), 0.6);
  color: rgb(var(--color-surface-500));
}

.schema-warning svg {
  @apply shrink-0 mt-0.5;
  color: rgb(var(--color-warning-500));
}
</style>
