<template>
  <textarea
    :id="textareaId"
    :value="modelValue"
    :name="name"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :rows="rows"
    :minlength="minlength"
    :maxlength="maxlength"
    :aria-invalid="error ? 'true' : undefined"
    :aria-describedby="ariaDescribedby"
    :class="['textarea', { 'input-error': error, 'input-success': success }, textareaClass]"
    :style="resizeStyle"
    @input="handleInput"
    @focus="$emit('focus', $event)"
    @blur="$emit('blur', $event)"
  />
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

type ResizeOption = 'none' | 'vertical' | 'horizontal' | 'both'

const props = withDefaults(defineProps<{
  /**
   * The textarea value (v-model)
   */
  modelValue?: string
  /**
   * The textarea id attribute
   */
  id?: string
  /**
   * The textarea name attribute
   */
  name?: string
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Whether the textarea is disabled
   */
  disabled?: boolean
  /**
   * Whether the textarea is readonly
   */
  readonly?: boolean
  /**
   * Whether the textarea is required
   */
  required?: boolean
  /**
   * Whether the textarea has an error state
   */
  error?: boolean
  /**
   * Whether the textarea has a success state
   */
  success?: boolean
  /**
   * Number of visible text lines
   */
  rows?: number
  /**
   * Minimum length for text input
   */
  minlength?: number
  /**
   * Maximum length for text input
   */
  maxlength?: number
  /**
   * Resize behavior of the textarea
   */
  resize?: ResizeOption
  /**
   * Additional CSS classes for the textarea element
   */
  textareaClass?: string
  /**
   * ID(s) of elements that describe this textarea for accessibility
   */
  ariaDescribedby?: string
}>(), {
  modelValue: '',
  id: undefined,
  name: undefined,
  placeholder: undefined,
  disabled: false,
  readonly: false,
  required: false,
  error: false,
  success: false,
  rows: 4,
  minlength: undefined,
  maxlength: undefined,
  resize: 'vertical',
  textareaClass: undefined,
  ariaDescribedby: undefined,
})

const emit = defineEmits<{
  /**
   * Emitted when the textarea value changes
   */
  'update:modelValue': [value: string]
  /**
   * Emitted when the textarea receives focus
   */
  'focus': [event: FocusEvent]
  /**
   * Emitted when the textarea loses focus
   */
  'blur': [event: FocusEvent]
  /**
   * Emitted on every input event
   */
  'input': [event: Event]
}>()

const generatedId = useId()
const textareaId = computed(() => props.id || `ui-textarea-${generatedId}`)

const resizeStyle = computed(() => ({
  resize: props.resize,
}))

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  emit('input', event)
}

// Expose the textarea ID for external use
defineExpose({
  textareaId,
})
</script>
