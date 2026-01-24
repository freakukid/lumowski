<template>
  <div class="column-mapping-step">
    <div class="step-description">
      <h3 class="step-title">Map your columns</h3>
      <p class="step-hint">
        Match each column from your file to your inventory fields.
        Columns with high confidence matches are pre-selected.
      </p>
    </div>

    <!-- Validation Warning -->
    <div v-if="!validation.valid" class="validation-warning">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>
        Required columns not mapped:
        {{ validation.missingColumns.map(c => c.name).join(', ') }}
      </span>
    </div>

    <div class="mappings-list">
      <div
        v-for="(mapping, index) in localMappings"
        :key="mapping.fileColumnIndex"
        class="mapping-item"
      >
        <!-- File Column Info -->
        <div class="file-column">
          <span class="column-name">{{ mapping.fileColumnName }}</span>
          <span v-if="mapping.confidence !== null" class="confidence-badge" :class="getConfidenceClass(mapping.confidence)">
            {{ Math.round(mapping.confidence * 100) }}%
          </span>
        </div>

        <!-- Arrow -->
        <div class="mapping-arrow">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>

        <!-- Target Selection -->
        <div class="target-column">
          <UiSelect
            :model-value="getDropdownValue(mapping)"
            :options="getMappingOptions(mapping)"
            :aria-label="`Map ${mapping.fileColumnName} to inventory column`"
            @update:model-value="handleMappingSelect(index, $event)"
          />

          <!-- New Column Form -->
          <div v-if="mapping.newColumn" class="new-column-form">
            <!-- Column Name Field -->
            <div class="new-column-field">
              <label
                :for="`name-${mapping.fileColumnIndex}`"
                class="new-column-label"
              >
                Column Name
              </label>
              <input
                :id="`name-${mapping.fileColumnIndex}`"
                v-model="mapping.newColumn.name"
                type="text"
                class="input column-name-input"
                placeholder="e.g., SKU, Description"
                maxlength="100"
                @input="mapping.newColumn.name = sanitizeColumnName(mapping.newColumn.name); updateMapping(index)"
              />
            </div>
            <div class="type-role-container">
              <!-- Role dropdown FIRST (selecting role auto-sets type) -->
              <div class="new-column-field">
                <label
                  :for="`role-${mapping.fileColumnIndex}`"
                  class="new-column-label"
                >
                  Role (optional)
                </label>
                <UiSelect
                  :id="`role-${mapping.fileColumnIndex}`"
                  :model-value="mapping.newColumn.role || ''"
                  :options="getRoleOptions(mapping)"
                  @update:model-value="onRoleChange(mapping, String($event), index)"
                />
              </div>

              <!-- Type dropdown SECOND (auto-set when role is selected) -->
              <div class="new-column-field">
                <label
                  :for="`type-${mapping.fileColumnIndex}`"
                  class="new-column-label"
                >
                  Type
                </label>
                <UiSelect
                  :id="`type-${mapping.fileColumnIndex}`"
                  :model-value="mapping.newColumn.type"
                  :options="typeOptions"
                  :disabled="!!mapping.newColumn.role"
                  @update:model-value="mapping.newColumn.type = String($event) as ColumnType; updateMapping(index)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Skip Toggle -->
        <div class="skip-btn-wrapper">
          <button
            type="button"
            class="skip-btn"
            :class="{ active: mapping.skip }"
            :aria-label="mapping.skip ? `Include ${mapping.fileColumnName}` : `Skip ${mapping.fileColumnName}`"
            :title="mapping.skip ? 'Include column' : 'Skip column'"
            @click="toggleSkip(index)"
          >
            <svg v-if="mapping.skip" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="mapping-summary">
      <p class="summary-text">
        {{ mappedCount }} of {{ localMappings.length }} columns mapped
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, ColumnRole, ColumnType } from '~/types/schema'
import type { ColumnMapping } from '~/types/import'

/**
 * Maps column roles to their required types.
 * When a role is selected, the type should be auto-set to this value.
 */
const ROLE_TYPE_MAP: Record<ColumnRole, ColumnType> = {
  name: 'text',
  quantity: 'number',
  minQuantity: 'number',
  price: 'currency',
  cost: 'currency',
}

const props = defineProps<{
  fileHeaders: string[]
  schemaColumns: ColumnDefinition[]
  initialMappings: ColumnMapping[]
}>()

const emit = defineEmits<{
  'mappings-updated': [mappings: ColumnMapping[]]
  'mapped-count-changed': [count: number]
}>()

const { validateMappings } = useColumnMatcher()

// Local copy of mappings for editing
const localMappings = ref<ColumnMapping[]>([])

// Initialize local mappings from props
watch(
  () => props.initialMappings,
  (newMappings) => {
    localMappings.value = JSON.parse(JSON.stringify(newMappings))
  },
  { immediate: true }
)

// Computed: validation status
const validation = computed(() => {
  return validateMappings(localMappings.value, props.schemaColumns)
})

// Computed: count of mapped columns
const mappedCount = computed(() => {
  return localMappings.value.filter((m) => !m.skip && (m.schemaColumnId || m.newColumn)).length
})

// Watch mappedCount and emit when it changes
watch(
  () => mappedCount.value,
  (newCount) => {
    emit('mapped-count-changed', newCount)
  },
  { immediate: true }
)

// Computed: roles that are already in use (from schema or new columns)
const takenRoles = computed(() => {
  const roles = new Set<string>()

  // Roles from existing schema columns
  props.schemaColumns.forEach((col) => {
    if (col.role) roles.add(col.role)
  })

  // Roles from new columns being created in this import
  localMappings.value.forEach((mapping) => {
    if (mapping.newColumn?.role) {
      roles.add(mapping.newColumn.role)
    }
  })

  return roles
})

// Role options for the role dropdown (UiSelect compatible format)
const getRoleOptions = (currentMapping: ColumnMapping) => {
  const currentRole = currentMapping.newColumn?.role
  const isDisabled = (role: ColumnRole) => takenRoles.value.has(role) && currentRole !== role

  return [
    { value: '', label: 'None' },
    { value: 'name', label: isDisabled('name') ? 'Name (primary) (in use)' : 'Name (primary)', disabled: isDisabled('name') },
    { value: 'quantity', label: isDisabled('quantity') ? 'Quantity (in use)' : 'Quantity', disabled: isDisabled('quantity') },
    { value: 'minQuantity', label: isDisabled('minQuantity') ? 'Min Quantity (in use)' : 'Min Quantity', disabled: isDisabled('minQuantity') },
    { value: 'price', label: isDisabled('price') ? 'Price (in use)' : 'Price', disabled: isDisabled('price') },
    { value: 'cost', label: isDisabled('cost') ? 'Cost (in use)' : 'Cost', disabled: isDisabled('cost') },
  ]
}

// Get available schema columns (not already mapped)
const availableSchemaColumns = (currentMapping: ColumnMapping): ColumnDefinition[] => {
  const usedIds = new Set(
    localMappings.value
      .filter((m) => m.fileColumnIndex !== currentMapping.fileColumnIndex && m.schemaColumnId)
      .map((m) => m.schemaColumnId)
  )

  return props.schemaColumns.filter((col) => {
    // Always show the currently selected column
    if (col.id === currentMapping.schemaColumnId) return true
    // Don't show if already used by another mapping
    return !usedIds.has(col.id)
  })
}

// Get confidence class for badge
const getConfidenceClass = (confidence: number): string => {
  if (confidence >= 0.9) return 'high'
  if (confidence >= 0.7) return 'medium'
  return 'low'
}

// Get the current dropdown value based on mapping state
// This ensures the dropdown displays the correct selected option
const getDropdownValue = (mapping: ColumnMapping): string => {
  if (mapping.newColumn) {
    return '__new__'
  }
  if (mapping.schemaColumnId) {
    return mapping.schemaColumnId
  }
  // Default to skip (covers both explicit skip and null schemaColumnId without newColumn)
  return '__skip__'
}

// Sanitize column name - remove potentially problematic characters
const sanitizeColumnName = (name: string): string => {
  // Remove leading/trailing whitespace
  let sanitized = name.trim()
  // Remove special characters that might cause issues in JSON or database
  // Keep alphanumeric, spaces, underscores, and hyphens
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s_-]/g, '')
  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ')
  // Limit to 100 characters
  sanitized = sanitized.substring(0, 100)
  return sanitized
}

// Type options for new column dropdown
const typeOptions = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
]

// Get mapping options with groups for UiSelect
const getMappingOptions = (mapping: ColumnMapping) => {
  const options: Array<{ value: string; label: string } | { label: string; options: Array<{ value: string; label: string }> }> = [
    { value: '__skip__', label: 'Skip this column' },
  ]

  const availableColumns = availableSchemaColumns(mapping)
  if (availableColumns.length > 0) {
    options.push({
      label: 'Existing Columns',
      options: availableColumns.map((col) => ({
        value: col.id,
        label: col.name + (col.required ? ' *' : ''),
      })),
    })
  }

  options.push({
    label: 'Actions',
    options: [{ value: '__new__', label: '+ Create new column' }],
  })

  return options
}

// Handle mapping selection from UiSelect
const handleMappingSelect = (index: number, value: string | number) => {
  const stringValue = String(value)

  if (stringValue === '__new__') {
    // Create new column mode
    localMappings.value[index].schemaColumnId = null
    localMappings.value[index].newColumn = {
      name: sanitizeColumnName(localMappings.value[index].fileColumnName),
      type: 'text',
      role: undefined,
    }
    localMappings.value[index].skip = false
  } else if (stringValue === '__skip__') {
    // Skip mode
    localMappings.value[index].schemaColumnId = null
    localMappings.value[index].newColumn = null
    localMappings.value[index].skip = true
  } else {
    // Map to existing column
    localMappings.value[index].schemaColumnId = stringValue
    localMappings.value[index].newColumn = null
    localMappings.value[index].skip = false
  }

  localMappings.value[index].matchType = 'manual'
  emitUpdate()
}

// Toggle skip status
const toggleSkip = (index: number) => {
  localMappings.value[index].skip = !localMappings.value[index].skip
  if (localMappings.value[index].skip) {
    localMappings.value[index].schemaColumnId = null
    localMappings.value[index].newColumn = null
  }
  emitUpdate()
}

// Update mapping (for new column form changes)
const updateMapping = (index: number) => {
  emitUpdate()
}

/**
 * Handles role selection changes for new columns.
 * When a role is selected, auto-sets the type to the corresponding value
 * based on ROLE_TYPE_MAP. When role is cleared, type becomes editable again.
 */
const onRoleChange = (mapping: ColumnMapping, newRole: string, index: number) => {
  if (!mapping.newColumn) return

  // Set role (convert empty string to undefined)
  mapping.newColumn.role = (newRole || undefined) as ColumnRole | undefined

  // If a role is selected, auto-set the type
  if (mapping.newColumn.role && ROLE_TYPE_MAP[mapping.newColumn.role]) {
    mapping.newColumn.type = ROLE_TYPE_MAP[mapping.newColumn.role]
  }

  emitUpdate()
}

// Emit updated mappings
const emitUpdate = () => {
  emit('mappings-updated', JSON.parse(JSON.stringify(localMappings.value)))
}
</script>

<style scoped>
.column-mapping-step {
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

.validation-warning {
  @apply flex items-center gap-2 px-4 py-3 rounded-lg text-sm;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-700));
}

.mappings-list {
  @apply space-y-3;
}

.mapping-item {
  @apply flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 p-4 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.file-column {
  @apply flex items-center gap-2 min-w-0 flex-1;
}

.column-name {
  @apply font-medium truncate;
  color: rgb(var(--color-surface-900));
}

.confidence-badge {
  @apply px-1.5 py-0.5 text-xs font-semibold rounded flex-shrink-0;
}

.confidence-badge.high {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.confidence-badge.medium {
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-700));
}

.confidence-badge.low {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.mapping-arrow {
  @apply hidden sm:flex items-center justify-center flex-shrink-0;
  color: rgb(var(--color-surface-400));
}

.target-column {
  @apply flex-1 space-y-2;
}

.target-column .select {
  @apply w-full;
}

.skip-btn-wrapper {
  @apply flex justify-end sm:block;
}

.new-column-form {
  @apply flex flex-col gap-2;
}

.new-column-form .column-name-input {
  @apply w-full;
}

.type-role-container {
  @apply grid grid-cols-2 gap-2;
}

.new-column-field {
  @apply flex flex-col gap-1;
}

.new-column-label {
  @apply text-xs font-medium;
  color: rgb(var(--color-surface-500));
}

.skip-btn {
  @apply w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg flex-shrink-0 transition-colors;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.skip-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.skip-btn.active {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-500));
}

.mapping-summary {
  @apply flex justify-center pt-4;
}

.summary-text {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}
</style>
