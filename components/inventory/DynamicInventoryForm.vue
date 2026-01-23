<template>
  <form @submit.prevent="handleSubmit" class="form-container">
    <div v-if="columns.length === 0" class="empty-schema">
      <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
      <p class="text-lg font-medium mb-1">No columns defined</p>
      <p class="text-sm mb-4">Set up your inventory columns first</p>
      <NuxtLink to="/settings/schema" class="setup-btn">
        Set Up Columns
      </NuxtLink>
    </div>

    <div v-else class="fields-grid">
      <div
        v-for="column in sortedColumns"
        :key="column.id"
        :class="['field-group', isWideField(column) ? 'wide' : '']"
      >
        <UiFormGroup
          :label="column.name"
          :for="column.id"
          :required="column.required"
        >
          <!-- Text input -->
          <UiInput
            v-if="column.type === 'text'"
            :id="column.id"
            v-model="formData[column.id]"
            type="text"
            input-class="field-input"
            :required="column.required"
            :placeholder="`Enter ${column.name.toLowerCase()}`"
          />

          <!-- Number input -->
          <UiInput
            v-else-if="column.type === 'number'"
            :id="column.id"
            :model-value="formData[column.id]"
            type="number"
            step="1"
            input-class="field-input"
            :required="column.required"
            placeholder="0"
            @update:model-value="formData[column.id] = $event"
          />

          <!-- Currency input -->
          <UiInput
            v-else-if="column.type === 'currency'"
            :id="column.id"
            :model-value="formData[column.id]"
            type="number"
            step="0.01"
            min="0"
            input-class="field-input currency-input"
            :required="column.required"
            placeholder="0.00"
            @update:model-value="formData[column.id] = $event"
          >
            <template #prefix>
              <span class="currency-symbol">$</span>
            </template>
          </UiInput>

          <!-- Date input -->
          <UiDatePicker
            v-else-if="column.type === 'date'"
            :id="column.id"
            :model-value="formData[column.id] as string | undefined"
            :required="column.required"
            :placeholder="`Select ${column.name.toLowerCase()}`"
            clearable
            @update:model-value="formData[column.id] = $event"
          />

          <!-- Select input -->
          <UiSelect
            v-else-if="column.type === 'select'"
            :id="column.id"
            v-model="formData[column.id]"
            :options="getSelectOptions(column)"
            :placeholder="`Select ${column.name.toLowerCase()}...`"
            select-class="field-input"
            :required="column.required"
          />
        </UiFormGroup>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="columns.length > 0" class="form-actions">
      <UiButton
        type="button"
        variant="secondary"
        class="cancel-btn"
        @click="$emit('cancel')"
      >
        Cancel
      </UiButton>
      <UiButton
        type="submit"
        :loading="isLoading"
        :loading-text="'Saving...'"
        class="submit-btn"
      >
        {{ item ? 'Update Item' : 'Create Item' }}
      </UiButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

const props = defineProps<{
  columns: ColumnDefinition[]
  item?: DynamicInventoryItem
  isLoading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Record<string, unknown>]
  cancel: []
}>()

const formData = reactive<Record<string, string | number | undefined>>({})

const sortedColumns = computed(() => {
  return [...props.columns].sort((a, b) => a.order - b.order)
})

// Wide fields for certain types (descriptions, etc.)
const isWideField = (column: ColumnDefinition) => {
  const name = column.name.toLowerCase()
  return name.includes('description') || name.includes('notes') || name.includes('comment')
}

// Initialize form data from item or defaults
const initializeForm = () => {
  for (const column of props.columns) {
    if (props.item?.data) {
      const value = props.item.data[column.id]
      formData[column.id] = (value ?? getDefaultValue(column)) as string | number | undefined
    } else {
      formData[column.id] = getDefaultValue(column)
    }
  }
}

const getDefaultValue = (column: ColumnDefinition): string | number | undefined => {
  switch (column.type) {
    case 'number':
    case 'currency':
      return undefined
    case 'date':
      return undefined
    case 'select':
      return ''
    default:
      return ''
  }
}

// Convert column options to UiSelect format
const getSelectOptions = (column: ColumnDefinition) => {
  if (!column.options) return []
  return column.options.map((opt) => ({
    value: opt,
    label: opt,
  }))
}

// Watch for item changes
watch(() => props.item, initializeForm, { immediate: true })
watch(() => props.columns, initializeForm, { immediate: true })

const handleSubmit = () => {
  emit('submit', { ...formData })
}
</script>

<style scoped>
.form-container {
  @apply space-y-6;
}

.empty-schema {
  @apply flex flex-col items-center justify-center py-12 text-center;
  color: rgb(var(--color-surface-500));
}

.setup-btn {
  @apply px-4 py-2 rounded-lg font-medium;
  background: rgb(var(--color-primary-500));
  color: white;
}

.setup-btn:hover {
  background: rgb(var(--color-primary-600));
}

.fields-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-4;
}

.field-group {
  @apply space-y-2;
}

.field-group.wide {
  @apply sm:col-span-2;
}

/* Override form group label styles */
.field-group :deep(.label) {
  @apply block text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

/* Field input styles - applied via inputClass/selectClass props */
.field-group :deep(.field-input) {
  @apply w-full px-4 py-3 rounded-xl text-sm font-medium transition-all outline-none;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.field-group :deep(.field-input)::placeholder {
  color: rgb(var(--color-surface-400));
}

.field-group :deep(.field-input):focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

/* Currency prefix styling */
.field-group :deep(.ui-input-prefix) {
  @apply left-4;
}

.field-group :deep(.currency-symbol) {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-400));
}

.field-group :deep(.currency-input) {
  @apply pl-8;
}

.form-actions {
  @apply flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-4 border-t;
  border-color: rgba(var(--color-surface-200), 0.8);
}

/* Override UiButton styles for this form */
.form-actions .cancel-btn {
  @apply w-full sm:w-auto min-h-[48px] sm:min-h-[44px] px-6 py-3 rounded-xl font-semibold transition-all;
  background: rgba(var(--color-surface-200), 0.5) !important;
  color: rgb(var(--color-surface-600));
}

.form-actions .cancel-btn:hover {
  background: rgba(var(--color-surface-300), 0.5) !important;
}

.form-actions .submit-btn {
  @apply w-full sm:w-auto min-h-[48px] sm:min-h-[44px] px-6 py-3 rounded-xl font-semibold text-white transition-all;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600))) !important;
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.form-actions .submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

.form-actions .submit-btn:disabled {
  @apply opacity-70 cursor-not-allowed;
}
</style>
