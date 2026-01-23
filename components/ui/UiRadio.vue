<template>
  <label
    :for="radioId"
    class="ui-radio-label"
  >
    <input
      :id="radioId"
      type="radio"
      :checked="modelValue === value"
      :value="value"
      :name="name"
      :disabled="disabled"
      class="radio"
      @change="handleChange"
    />
    <span
      v-if="$slots.default || label"
      class="ui-radio-text"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * The currently selected value in the radio group (v-model)
   */
  modelValue?: string | number | boolean
  /**
   * The value this radio button represents (required)
   */
  value: string | number | boolean
  /**
   * The radio button id attribute
   */
  id?: string
  /**
   * The radio group name attribute (required for grouping)
   */
  name: string
  /**
   * Whether the radio button is disabled
   */
  disabled?: boolean
  /**
   * Label text for the radio button
   */
  label?: string
}>(), {
  modelValue: undefined,
  id: undefined,
  disabled: false,
  label: undefined,
})

const emit = defineEmits<{
  /**
   * Emitted when this radio button is selected
   */
  'update:modelValue': [value: string | number | boolean]
  /**
   * Emitted when the radio button state changes
   */
  'change': [event: Event]
}>()

const generatedId = useId()
const radioId = computed(() => props.id || `ui-radio-${generatedId}`)

function handleChange(event: Event) {
  emit('update:modelValue', props.value)
  emit('change', event)
}

// Expose the radio ID for external use
defineExpose({
  radioId,
})
</script>

<style scoped>
.ui-radio-label {
  @apply inline-flex items-center gap-2 cursor-pointer;
}

.ui-radio-label:has(input:disabled) {
  @apply cursor-not-allowed opacity-60;
}

.ui-radio-text {
  @apply text-sm font-medium select-none;
  color: rgb(var(--color-surface-700));
}
</style>
