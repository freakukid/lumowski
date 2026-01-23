<template>
  <div class="schema-editor">
    <!-- Header -->
    <div class="editor-header">
      <h2 class="editor-title">Inventory Columns</h2>
      <UiButton
        variant="ghost"
        class="add-btn"
        @click="addColumn"
      >
        <template #icon-left>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </template>
        Add Column
      </UiButton>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="columns-skeleton" aria-label="Loading columns">
      <div v-for="i in 3" :key="i" class="skeleton-row">
        <div class="skeleton-handle" aria-hidden="true"></div>
        <div class="skeleton-field skeleton-name" aria-hidden="true"></div>
        <div class="skeleton-field skeleton-type" aria-hidden="true"></div>
        <div class="skeleton-field skeleton-role" aria-hidden="true"></div>
        <div class="skeleton-field skeleton-required" aria-hidden="true"></div>
        <div class="skeleton-actions" aria-hidden="true"></div>
      </div>
      <p class="sr-only">Loading your column configuration...</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="localColumns.length === 0" class="empty-state">
      <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
      <p class="text-lg font-medium mb-2">No columns yet</p>
      <p class="text-sm mb-4">Add columns to define your inventory structure</p>
      <UiButton class="add-btn-large" @click="addColumn">
        Add Your First Column
      </UiButton>
    </div>

    <!-- Columns list with native HTML5 drag-and-drop -->
    <div
      v-else
      class="columns-list"
    >
      <!-- Drop indicator at top -->
      <div
        v-if="dropTargetIndex === 0 && draggedIndex !== null && draggedIndex !== 0"
        class="drop-indicator"
      />
      <template v-for="(column, index) in localColumns" :key="column.id">
        <div
          class="column-row"
          :class="{
            'column-row--dragging': draggedIndex === index,
          }"
          :data-id="column.id"
          @dragover.prevent="onDragOver($event, index)"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <!-- Mobile card header with column number and actions -->
          <div class="mobile-card-header">
            <span class="column-number">Column {{ index + 1 }}</span>
            <div class="mobile-actions">
              <button
                type="button"
                class="icon-btn-touch mobile-action-btn"
                :disabled="index === 0"
                @click="moveColumn(index, -1)"
                aria-label="Move up"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn-touch mobile-action-btn"
                :disabled="index === localColumns.length - 1"
                @click="moveColumn(index, 1)"
                aria-label="Move down"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn-touch mobile-action-btn mobile-delete-btn"
                @click="removeColumn(index)"
                aria-label="Delete column"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Drag handle (desktop only) -->
          <div
            class="drag-handle"
            draggable="true"
            tabindex="0"
            role="button"
            aria-roledescription="draggable"
            :aria-label="`Reorder column ${column.name || 'unnamed'}, position ${index + 1} of ${localColumns.length}`"
            @dragstart="onDragStart($event, index)"
            @dragend="onDragEnd"
            @keydown="onHandleKeyDown($event, index)"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
          </div>

          <!-- Column name -->
          <div class="column-field name-field">
            <UiFormGroup label="Name" :for="`name-${column.id}`">
              <UiInput
                :id="`name-${column.id}`"
                v-model="column.name"
                type="text"
                input-class="field-input"
                placeholder="Column name"
                required
              />
            </UiFormGroup>
          </div>

          <!-- Type and Role container (side by side on mobile) -->
          <div class="type-role-container">
            <!-- Column type -->
            <div class="column-field type-field">
              <UiFormGroup label="Type" :for="`type-${column.id}`">
                <UiSelect
                  :id="`type-${column.id}`"
                  v-model="column.type"
                  :options="typeOptions"
                  :disabled="!!column.role"
                  @change="onTypeChange(column)"
                />
              </UiFormGroup>
            </div>

            <!-- Role -->
            <div class="column-field role-field">
              <UiFormGroup label="Role" :for="`role-${column.id}`">
                <UiSelect
                  :id="`role-${column.id}`"
                  :model-value="column.role"
                  :options="getRoleOptions(column.id)"
                  placeholder="None"
                  @update:model-value="onRoleChange(column, $event)"
                />
              </UiFormGroup>
            </div>
          </div>

          <!-- Required toggle -->
          <div class="column-field required-field">
            <label class="required-label">
              <UiCheckbox
                v-model="column.required"
              />
              <span class="required-text">Required</span>
            </label>
          </div>

          <!-- Options (for select type) -->
          <div v-if="column.type === 'select'" class="column-field options-field">
            <UiFormGroup label="Options" :for="`options-${column.id}`">
              <UiInput
                :id="`options-${column.id}`"
                :model-value="column.options?.join(', ')"
                type="text"
                input-class="field-input"
                placeholder="Option 1, Option 2, Option 3"
                @update:model-value="updateOptions(column, String($event))"
              />
            </UiFormGroup>
          </div>

          <!-- Delete button (desktop only) -->
          <UiButton
            variant="danger"
            icon-only
            size="sm"
            class="delete-btn"
            @click="removeColumn(index)"
          >
            <template #icon-left>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </template>
          </UiButton>

          <!-- Move buttons (desktop only) -->
          <div class="move-btns">
            <UiButton
              variant="ghost"
              icon-only
              size="sm"
              class="move-btn"
              :disabled="index === 0"
              @click="moveColumn(index, -1)"
            >
              <template #icon-left>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                </svg>
              </template>
            </UiButton>
            <UiButton
              variant="ghost"
              icon-only
              size="sm"
              class="move-btn"
              :disabled="index === localColumns.length - 1"
              @click="moveColumn(index, 1)"
            >
              <template #icon-left>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </template>
            </UiButton>
          </div>
        </div>
        <!-- Drop indicator after each row -->
        <div
          v-if="dropTargetIndex === index + 1 && draggedIndex !== null && draggedIndex !== index && draggedIndex !== index + 1"
          class="drop-indicator"
        />
      </template>
    </div>

    <!--
      Show save section when:
      1. Columns exist (normal editing), OR
      2. hasChanges is true (user deleted all columns and needs to save empty state)
    -->
    <div v-if="localColumns.length > 0 || hasChanges" class="save-section">
      <p v-if="hasChanges" class="unsaved-notice">You have unsaved changes</p>
      <UiButton
        class="save-btn"
        :loading="isSaving"
        loading-text="Saving..."
        :disabled="!hasChanges"
        @click="saveSchema"
      >
        Save Changes
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition, ColumnType, ColumnRole } from '~/types/schema'

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
  columns: ColumnDefinition[]
  isSaving?: boolean
  isLoading?: boolean
}>()

const emit = defineEmits<{
  save: [columns: ColumnDefinition[]]
}>()

// Local copy of columns for editing
const localColumns = ref<ColumnDefinition[]>([])
const originalJson = ref('')

// Native HTML5 drag-and-drop state
const draggedIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

// Initialize from props
watch(() => props.columns, (newColumns) => {
  localColumns.value = JSON.parse(JSON.stringify(newColumns))
  originalJson.value = JSON.stringify(newColumns)
}, { immediate: true, deep: true })

// Native HTML5 drag-and-drop handlers
const onDragStart = (e: DragEvent, index: number) => {
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }
  draggedIndex.value = index
}

const onDragEnd = () => {
  draggedIndex.value = null
  dropTargetIndex.value = null
}

const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  if (draggedIndex.value === null) return

  // Calculate whether we're in the top or bottom half of the row
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const midpoint = rect.top + rect.height / 2
  const isAboveMidpoint = e.clientY < midpoint

  // Set drop target to insert before this row (index) or after (index + 1)
  dropTargetIndex.value = isAboveMidpoint ? index : index + 1
}

const onDragLeave = () => {
  // Only clear if we're leaving the container entirely
  // The dragover on another element will set the new position
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  if (draggedIndex.value === null || dropTargetIndex.value === null) return

  const fromIndex = draggedIndex.value
  let toIndex = dropTargetIndex.value

  // Don't do anything if dropping in the same position
  if (fromIndex === toIndex || fromIndex === toIndex - 1) {
    draggedIndex.value = null
    dropTargetIndex.value = null
    return
  }

  // Remove the item from its original position
  const [movedItem] = localColumns.value.splice(fromIndex, 1)

  // Adjust toIndex if we removed an item before the target position
  if (fromIndex < toIndex) {
    toIndex -= 1
  }

  // Insert at the new position
  localColumns.value.splice(toIndex, 0, movedItem)

  // Update order property for all columns
  localColumns.value.forEach((col, i) => {
    col.order = i
  })

  // Reset drag state
  draggedIndex.value = null
  dropTargetIndex.value = null
}

const hasChanges = computed(() => {
  return JSON.stringify(localColumns.value) !== originalJson.value
})

// Keyboard navigation for accessibility
const onHandleKeyDown = (event: KeyboardEvent, index: number) => {
  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      if (index > 0) {
        moveColumn(index, -1)
        // Focus the handle at the new position after Vue updates the DOM
        nextTick(() => {
          const handles = document.querySelectorAll('.drag-handle')
          const newHandle = handles[index - 1] as HTMLElement
          newHandle?.focus()
        })
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      if (index < localColumns.value.length - 1) {
        moveColumn(index, 1)
        // Focus the handle at the new position after Vue updates the DOM
        nextTick(() => {
          const handles = document.querySelectorAll('.drag-handle')
          const newHandle = handles[index + 1] as HTMLElement
          newHandle?.focus()
        })
      }
      break
  }
}

// Options for the type select
const typeOptions = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
]

// Options for the role select (dynamic based on what's already taken)
const getRoleOptions = (currentId: string) => {
  return [
    { value: '', label: 'None' },
    { value: 'name', label: 'Name (primary)', disabled: isRoleTaken('name', currentId) },
    { value: 'quantity', label: 'Quantity', disabled: isRoleTaken('quantity', currentId) },
    { value: 'minQuantity', label: 'Min Quantity', disabled: isRoleTaken('minQuantity', currentId) },
    { value: 'price', label: 'Price', disabled: isRoleTaken('price', currentId) },
    { value: 'cost', label: 'Cost', disabled: isRoleTaken('cost', currentId) },
  ]
}

const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const addColumn = () => {
  const newColumn: ColumnDefinition = {
    id: generateId(),
    name: '',
    type: 'text',
    required: false,
    order: localColumns.value.length,
  }
  localColumns.value.push(newColumn)
}

const removeColumn = (index: number) => {
  localColumns.value.splice(index, 1)
  // Update order for remaining columns
  localColumns.value.forEach((col, i) => {
    col.order = i
  })
}

const moveColumn = (index: number, direction: number) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= localColumns.value.length) return

  const temp = localColumns.value[index]
  localColumns.value[index] = localColumns.value[newIndex]
  localColumns.value[newIndex] = temp

  // Update order
  localColumns.value.forEach((col, i) => {
    col.order = i
  })
}

const isRoleTaken = (role: string, currentId: string) => {
  return localColumns.value.some((c) => c.role === role && c.id !== currentId)
}

const onTypeChange = (column: ColumnDefinition) => {
  // Clear options if not select type
  if (column.type !== 'select') {
    column.options = undefined
  } else if (!column.options) {
    column.options = []
  }

  // Clear role if type doesn't match
  if (column.role === 'quantity' || column.role === 'minQuantity') {
    if (column.type !== 'number') {
      column.role = undefined
    }
  }
  if (column.role === 'price') {
    if (column.type !== 'currency' && column.type !== 'number') {
      column.role = undefined
    }
  }
  if (column.role === 'cost') {
    if (column.type !== 'currency' && column.type !== 'number') {
      column.role = undefined
    }
  }
}

/**
 * Handles role selection changes.
 * When a role is selected, auto-sets the type to the corresponding value
 * based on ROLE_TYPE_MAP. When role is cleared, type becomes editable again.
 */
const onRoleChange = (column: ColumnDefinition, newRole: string | number) => {
  // Convert to string and handle empty/falsy values
  const roleString = String(newRole || '')

  // Set role (convert empty string to undefined)
  column.role = (roleString || undefined) as ColumnRole | undefined

  // If a role is selected, auto-set the type
  if (column.role && ROLE_TYPE_MAP[column.role]) {
    column.type = ROLE_TYPE_MAP[column.role]
    // Clear options since roles can't be 'select' type
    column.options = undefined
  }
}

const updateOptions = (column: ColumnDefinition, value: string) => {
  column.options = value.split(',').map((s) => s.trim()).filter((s) => s)
}

const saveSchema = () => {
  // Validate
  for (const column of localColumns.value) {
    if (!column.name.trim()) {
      alert('All columns must have a name')
      return
    }
    if (column.type === 'select' && (!column.options || column.options.length === 0)) {
      alert(`Column "${column.name}" is a dropdown but has no options`)
      return
    }
  }

  emit('save', localColumns.value)
  originalJson.value = JSON.stringify(localColumns.value)
}
</script>

<style scoped>
.schema-editor {
  @apply space-y-6;
}

.editor-header {
  @apply flex items-center justify-between gap-3;
}

.editor-title {
  @apply text-xl font-bold;
  color: rgb(var(--color-surface-900));
}

/* Override UiButton ghost styles for add button */
.add-btn {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all;
  @apply w-full md:w-auto min-h-[44px];
  background: rgba(var(--color-primary-500), 0.1) !important;
  color: rgb(var(--color-primary-600)) !important;
}

.add-btn:hover {
  background: rgba(var(--color-primary-500), 0.2) !important;
}

.empty-state {
  @apply flex flex-col items-center justify-center py-12 text-center rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px dashed rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-500));
}

.add-btn-large {
  @apply px-6 py-3 rounded-xl font-semibold text-white min-h-[44px];
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
}

.columns-list {
  @apply space-y-4;
}

/* Column row - card on mobile, row on desktop */
.column-row {
  @apply flex flex-col gap-3 p-4 rounded-xl;
  @apply md:flex-row md:flex-wrap md:items-end;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}

/* Mobile card header - visible only on mobile */
.mobile-card-header {
  @apply flex items-center justify-between w-full;
  @apply md:hidden;
}

.column-number {
  @apply font-semibold text-sm;
  color: rgb(var(--color-surface-700));
}

.mobile-actions {
  @apply flex gap-1;
}

/* mobile-action-btn extends .icon-btn-touch with component-specific styles */
.mobile-action-btn {
  color: rgb(var(--color-surface-500));
  background: rgba(var(--color-surface-200), 0.5);
}

.mobile-action-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

.mobile-action-btn:disabled {
  @apply opacity-30 cursor-not-allowed;
}

.mobile-delete-btn {
  color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.1);
}

.mobile-delete-btn:hover {
  background: rgba(var(--color-error-500), 0.2);
}

.column-field {
  @apply flex flex-col gap-1;
}

/* Name field - full width on mobile, flex on desktop */
.name-field {
  @apply w-full md:flex-1 md:min-w-[150px];
}

/* Type and Role container - grid on mobile for side-by-side, contents on desktop */
.type-role-container {
  @apply grid grid-cols-2 gap-3 w-full;
  @apply md:contents;
}

/* Type field */
.type-field {
  @apply w-full md:w-[150px];
}

/* Role field */
.role-field {
  @apply w-full md:w-[170px];
}

/* Required field */
.required-field {
  @apply w-full md:w-auto;
}

.required-label {
  @apply flex items-center gap-2 min-h-[44px] cursor-pointer;
}

.required-text {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-600));
}

/* Options field - always full width */
.options-field {
  @apply w-full;
}

/* Override UiFormGroup label styles for smaller labels */
.column-field :deep(.label) {
  @apply text-xs font-medium;
  color: rgb(var(--color-surface-500));
}

/* Field input styles - applied via inputClass/selectClass props */
.column-field :deep(.field-input) {
  @apply w-full px-3 py-2 rounded-lg text-sm transition-all outline-none min-h-[44px];
  background: rgb(var(--color-surface-50));
  border: 1px solid rgb(var(--color-surface-300));
  color: rgb(var(--color-surface-900));
  box-shadow: inset 0 1px 2px rgba(var(--color-surface-900), 0.05);
}

.column-field :deep(.field-input):focus {
  border-color: rgb(var(--color-primary-500));
  box-shadow: 0 0 0 3px rgba(var(--color-primary-500), 0.1);
}

html[data-theme="midnight"] .column-field :deep(.field-input) {
  background: rgb(var(--color-surface-100));
  border-color: rgba(var(--color-surface-300), 0.8);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
}

/* Checkbox styling override */
.column-field :deep(.ui-checkbox-label) {
  @apply mt-1;
}

.column-field :deep(.ui-checkbox-text) {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-600));
}

/* Delete button - hidden on mobile, visible on desktop */
.delete-btn {
  @apply hidden md:flex p-2 rounded-lg transition-all self-end mb-1 min-w-[44px] min-h-[44px] items-center justify-center;
  color: rgb(var(--color-error-500)) !important;
  background: rgba(var(--color-error-500), 0.1) !important;
}

.delete-btn:hover {
  background: rgba(var(--color-error-500), 0.2) !important;
}

/* Move buttons - hidden on mobile, visible on desktop */
.move-btns {
  @apply hidden md:flex flex-col gap-1 self-end mb-1;
}

.move-btn {
  @apply p-1 rounded transition-all min-w-[44px] min-h-[44px] flex items-center justify-center;
  color: rgb(var(--color-surface-500)) !important;
  background: transparent !important;
}

.move-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-200), 0.5) !important;
  color: rgb(var(--color-surface-700)) !important;
}

.move-btn:disabled {
  @apply opacity-30 cursor-not-allowed;
}

/* Save section - column on mobile, row on desktop */
.save-section {
  @apply flex flex-col-reverse md:flex-row items-center justify-end gap-4 pt-4 border-t;
  border-color: rgba(var(--color-surface-200), 0.8);
}

.unsaved-notice {
  @apply text-sm font-medium text-center md:text-left;
  color: rgb(245, 158, 11);
}

/* Override UiButton styles for save button */
.save-btn {
  @apply flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all;
  @apply w-full md:w-auto min-h-[44px];
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600))) !important;
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

.save-btn:disabled {
  @apply opacity-60 cursor-not-allowed;
  transform: none;
}

/* ==========================================
   NATIVE HTML5 DRAG-AND-DROP STYLES
   ========================================== */

/* Drag handle */
.drag-handle {
  @apply hidden md:flex p-2 rounded-lg transition-all;
  color: rgb(var(--color-surface-400));
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.drag-handle:hover {
  color: rgb(var(--color-surface-600));
  background: rgba(var(--color-surface-200), 0.5);
  border-radius: 8px;
}

.drag-handle:focus {
  @apply outline-none;
  color: rgb(var(--color-primary-500));
  box-shadow: 0 0 0 2px rgba(var(--color-primary-500), 0.3);
  border-radius: 8px;
}

.drag-handle:active {
  cursor: grabbing;
}

/* Drop indicator line shown between rows */
.drop-indicator {
  @apply h-1 rounded-full my-1;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(var(--color-primary-500)),
    rgb(var(--color-primary-500)),
    transparent
  );
  animation: pulse-indicator 1s ease-in-out infinite;
}

@keyframes pulse-indicator {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* Element being dragged - visual feedback */
.column-row--dragging {
  opacity: 0.5;
  border: 2px dashed rgba(var(--color-primary-500), 0.5) !important;
  background: rgba(var(--color-primary-500), 0.05) !important;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .drag-handle,
  .column-row {
    transition: none !important;
  }

  .drop-indicator {
    animation: none;
    opacity: 1;
  }
}

/* ==========================================
   LOADING SKELETON STYLES
   ========================================== */

.columns-skeleton {
  @apply space-y-4;
}

.skeleton-row {
  @apply flex flex-col gap-3 p-4 rounded-xl;
  @apply md:flex-row md:flex-wrap md:items-center;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.skeleton-handle {
  @apply hidden md:block w-9 h-9 rounded-lg;
  background: rgba(var(--color-surface-200), 0.8);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-field {
  @apply h-10 rounded-lg;
  background: rgba(var(--color-surface-200), 0.8);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-name {
  @apply w-full md:flex-1 md:min-w-[150px];
  animation-delay: 0.1s;
}

.skeleton-type {
  @apply w-[calc(50%-0.375rem)] md:w-[150px];
  animation-delay: 0.2s;
}

.skeleton-role {
  @apply w-[calc(50%-0.375rem)] md:w-[170px];
  animation-delay: 0.3s;
}

.skeleton-required {
  @apply w-24;
  animation-delay: 0.4s;
}

.skeleton-actions {
  @apply hidden md:flex gap-1 w-24 h-10;
}

.skeleton-actions::before,
.skeleton-actions::after {
  content: '';
  @apply block w-10 h-10 rounded-lg;
  background: rgba(var(--color-surface-200), 0.8);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.5s;
}

@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Screen reader only text */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

/* Reduced motion support for skeleton */
@media (prefers-reduced-motion: reduce) {
  .skeleton-handle,
  .skeleton-field,
  .skeleton-actions::before,
  .skeleton-actions::after {
    animation: none;
    opacity: 0.7;
  }
}
</style>
