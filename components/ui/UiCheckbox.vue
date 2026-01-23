<template>
  <label
    :for="checkboxId"
    class="ui-checkbox-label"
  >
    <input
      :id="checkboxId"
      type="checkbox"
      :checked="modelValue"
      :name="name"
      :disabled="disabled"
      class="checkbox"
      @change="handleChange"
    />
    <span
      v-if="$slots.default || label"
      class="ui-checkbox-text"
    >
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * The checkbox checked state (v-model)
   */
  modelValue?: boolean
  /**
   * The checkbox id attribute
   */
  id?: string
  /**
   * The checkbox name attribute
   */
  name?: string
  /**
   * Whether the checkbox is disabled
   */
  disabled?: boolean
  /**
   * Label text for the checkbox
   */
  label?: string
}>(), {
  modelValue: false,
  id: undefined,
  name: undefined,
  disabled: false,
  label: undefined,
})

const emit = defineEmits<{
  /**
   * Emitted when the checkbox state changes
   */
  'update:modelValue': [value: boolean]
  /**
   * Emitted when the checkbox state changes
   */
  'change': [event: Event]
}>()

const generatedId = useId()
const checkboxId = computed(() => props.id || `ui-checkbox-${generatedId}`)

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
  emit('change', event)
}

// Expose the checkbox ID for external use
defineExpose({
  checkboxId,
})
</script>

<style scoped>
.ui-checkbox-label {
  @apply inline-flex items-center gap-2 cursor-pointer;
}

.ui-checkbox-label:has(input:disabled) {
  @apply cursor-not-allowed opacity-60;
}

.ui-checkbox-text {
  @apply text-sm font-medium select-none;
  color: rgb(var(--color-surface-700));
}
</style>
