<template>
  <div class="ui-input-wrapper">
    <!-- Prefix slot (icons, text, etc.) -->
    <div
      v-if="$slots.prefix"
      class="ui-input-prefix"
    >
      <slot name="prefix" />
    </div>

    <input
      :id="inputId"
      :value="modelValue"
      :type="type"
      :name="name"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :min="min"
      :max="max"
      :step="step"
      :minlength="minlength"
      :maxlength="maxlength"
      :autocomplete="autocomplete"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="ariaDescribedby"
      :class="[
        'input',
        {
          'input-error': error,
          'input-success': success,
          'has-prefix': $slots.prefix,
          'has-suffix': $slots.suffix,
        },
        inputClass,
      ]"
      @input="handleInput"
      @focus="$emit('focus', $event)"
      @blur="$emit('blur', $event)"
    />

    <!-- Suffix slot (icons, buttons, etc.) -->
    <div
      v-if="$slots.suffix"
      class="ui-input-suffix"
    >
      <slot name="suffix" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date'

const props = withDefaults(defineProps<{
  /**
   * The input value (v-model)
   */
  modelValue?: string | number
  /**
   * The input type
   */
  type?: InputType
  /**
   * The input id attribute
   */
  id?: string
  /**
   * The input name attribute
   */
  name?: string
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Whether the input is disabled
   */
  disabled?: boolean
  /**
   * Whether the input is readonly
   */
  readonly?: boolean
  /**
   * Whether the input is required
   */
  required?: boolean
  /**
   * Whether the input has an error state
   */
  error?: boolean
  /**
   * Whether the input has a success state
   */
  success?: boolean
  /**
   * Minimum value (for number/date types)
   */
  min?: string | number
  /**
   * Maximum value (for number/date types)
   */
  max?: string | number
  /**
   * Step value (for number type)
   */
  step?: string | number
  /**
   * Minimum length for text input
   */
  minlength?: number
  /**
   * Maximum length for text input
   */
  maxlength?: number
  /**
   * Autocomplete attribute
   */
  autocomplete?: string
  /**
   * Additional CSS classes for the input element
   */
  inputClass?: string
  /**
   * ID(s) of elements that describe this input for accessibility
   */
  ariaDescribedby?: string
}>(), {
  modelValue: '',
  type: 'text',
  id: undefined,
  name: undefined,
  placeholder: undefined,
  disabled: false,
  readonly: false,
  required: false,
  error: false,
  success: false,
  min: undefined,
  max: undefined,
  step: undefined,
  minlength: undefined,
  maxlength: undefined,
  autocomplete: undefined,
  inputClass: undefined,
  ariaDescribedby: undefined,
})

const emit = defineEmits<{
  /**
   * Emitted when the input value changes
   */
  'update:modelValue': [value: string | number]
  /**
   * Emitted when the input receives focus
   */
  'focus': [event: FocusEvent]
  /**
   * Emitted when the input loses focus
   */
  'blur': [event: FocusEvent]
  /**
   * Emitted on every input event
   */
  'input': [event: Event]
}>()

const generatedId = useId()
const inputId = computed(() => props.id || `ui-input-${generatedId}`)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = props.type === 'number' ? target.valueAsNumber : target.value
  emit('update:modelValue', value)
  emit('input', event)
}

// Expose the input ID for external use (e.g., associating labels)
defineExpose({
  inputId,
})
</script>

<style scoped>
.ui-input-wrapper {
  @apply relative flex items-center;
}

.ui-input-prefix {
  @apply absolute left-3 flex items-center pointer-events-none;
  color: rgb(var(--color-surface-400));
}

.ui-input-suffix {
  @apply absolute right-3 flex items-center;
  color: rgb(var(--color-surface-400));
}

.input.has-prefix {
  @apply pl-10;
}

.input.has-suffix {
  @apply pr-10;
}
</style>
