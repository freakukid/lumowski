<template>
  <div
    class="ui-toggle"
    :class="{ 'ui-toggle-right': labelPosition === 'right' }"
  >
    <!-- Label on the left (default) or right based on labelPosition -->
    <div
      v-if="($slots.label || label || $slots.description || description) && labelPosition === 'left'"
      class="ui-toggle-content"
    >
      <span
        v-if="$slots.label || label"
        :id="labelId"
        class="ui-toggle-label"
      >
        <slot name="label">{{ label }}</slot>
      </span>
      <span
        v-if="$slots.description || description"
        :id="descriptionId"
        class="ui-toggle-description"
      >
        <slot name="description">{{ description }}</slot>
      </span>
    </div>

    <!-- Toggle switch button -->
    <button
      :id="toggleId"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-labelledby="labelId"
      :aria-describedby="description || $slots.description ? descriptionId : undefined"
      :disabled="disabled"
      :class="['toggle-switch', { active: modelValue }]"
      @click="handleToggle"
    />

    <!-- Label on the right -->
    <div
      v-if="($slots.label || label || $slots.description || description) && labelPosition === 'right'"
      class="ui-toggle-content"
    >
      <span
        v-if="$slots.label || label"
        :id="labelId"
        class="ui-toggle-label"
      >
        <slot name="label">{{ label }}</slot>
      </span>
      <span
        v-if="$slots.description || description"
        :id="descriptionId"
        class="ui-toggle-description"
      >
        <slot name="description">{{ description }}</slot>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * The toggle state (v-model)
   */
  modelValue?: boolean
  /**
   * The toggle id attribute
   */
  id?: string
  /**
   * Whether the toggle is disabled
   */
  disabled?: boolean
  /**
   * Label text for the toggle
   */
  label?: string
  /**
   * Description text displayed below the label
   */
  description?: string
  /**
   * Position of the label relative to the toggle
   */
  labelPosition?: 'left' | 'right'
}>(), {
  modelValue: false,
  id: undefined,
  disabled: false,
  label: undefined,
  description: undefined,
  labelPosition: 'left',
})

const emit = defineEmits<{
  /**
   * Emitted when the toggle state changes
   */
  'update:modelValue': [value: boolean]
  /**
   * Emitted when the toggle state changes
   */
  'change': [value: boolean]
}>()

const generatedId = useId()
const toggleId = computed(() => props.id || `ui-toggle-${generatedId}`)
const labelId = computed(() => `${toggleId.value}-label`)
const descriptionId = computed(() => `${toggleId.value}-description`)

function handleToggle() {
  if (props.disabled) return
  const newValue = !props.modelValue
  emit('update:modelValue', newValue)
  emit('change', newValue)
}

// Expose the toggle ID for external use
defineExpose({
  toggleId,
})
</script>

<style scoped>
.ui-toggle {
  @apply inline-flex items-center gap-3;
}

.ui-toggle-right {
  @apply flex-row;
}

.ui-toggle-content {
  @apply flex flex-col;
}

.ui-toggle-label {
  @apply text-sm font-medium select-none;
  color: rgb(var(--color-surface-700));
}

.ui-toggle-description {
  @apply text-sm select-none;
  color: rgb(var(--color-surface-500));
}

/* Ensure the toggle button doesn't have pointer events when disabled */
.toggle-switch:disabled {
  @apply pointer-events-none;
}
</style>
