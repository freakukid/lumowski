<template>
  <div class="form-group">
    <!-- Label slot or default label -->
    <slot name="label">
      <UiFormLabel
        v-if="label"
        :for="htmlFor"
        :required="required"
      >
        {{ label }}
      </UiFormLabel>
    </slot>

    <!-- Default slot for the form input -->
    <slot />

    <!-- Hint/Helper text -->
    <slot name="hint">
      <p
        v-if="hint && !error && !success"
        :id="hintId"
        class="helper-text"
      >
        {{ hint }}
      </p>
    </slot>

    <!-- Error message -->
    <slot name="error">
      <p
        v-if="error"
        :id="errorId"
        class="error-text"
        role="alert"
      >
        <svg
          class="w-4 h-4 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        {{ error }}
      </p>
    </slot>

    <!-- Success message -->
    <slot name="success">
      <p
        v-if="success && !error"
        :id="successId"
        class="success-text"
      >
        <svg
          class="w-4 h-4 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd"
          />
        </svg>
        {{ success }}
      </p>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * Label text for the form field
   */
  label?: string
  /**
   * The id of the form element this label is associated with
   */
  for?: string
  /**
   * Whether the associated field is required
   */
  required?: boolean
  /**
   * Error message to display
   */
  error?: string
  /**
   * Hint/helper text to display
   */
  hint?: string
  /**
   * Success message to display
   */
  success?: string
}>(), {
  label: undefined,
  for: undefined,
  required: false,
  error: undefined,
  hint: undefined,
  success: undefined,
})

const generatedId = useId()

// Computed IDs for aria-describedby references
const htmlFor = computed(() => props.for)
const hintId = computed(() => props.hint ? `${props.for || generatedId}-hint` : undefined)
const errorId = computed(() => props.error ? `${props.for || generatedId}-error` : undefined)
const successId = computed(() => props.success ? `${props.for || generatedId}-success` : undefined)

// Expose IDs for parent components to use with aria-describedby
defineExpose({
  hintId,
  errorId,
  successId,
})
</script>

<style scoped>
.form-group {
  @apply space-y-1;
}
</style>
