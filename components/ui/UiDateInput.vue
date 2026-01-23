<template>
  <div
    class="ui-date-input-wrapper"
    :class="{
      'ui-date-input-error': error,
      'ui-date-input-disabled': disabled,
    }"
    @click="openPicker"
  >
    <!-- Left icon: calendar for date/datetime, clock for time -->
    <div class="ui-date-input-icon">
      <svg
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          v-if="mode === 'time'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <path
          v-else
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>

    <!-- Formatted display value or placeholder -->
    <span
      class="ui-date-input-display"
      :class="{ 'is-placeholder': !modelValue }"
    >
      {{ displayText }}
    </span>

    <!-- Clear button (only visible when value exists and not disabled) -->
    <button
      v-if="modelValue && !disabled"
      type="button"
      class="ui-date-input-clear"
      aria-label="Clear date"
      @click.stop="clearValue"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    <!-- Hidden native input positioned absolutely for picker trigger -->
    <input
      ref="nativeInputRef"
      :type="nativeInputType"
      :value="modelValue"
      :min="min"
      :max="max"
      :disabled="disabled"
      :required="required"
      class="ui-date-input-native"
      :aria-label="placeholder || 'Select date'"
      @input="handleInput"
      @change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

type DateInputMode = 'date' | 'time' | 'datetime'

const props = withDefaults(defineProps<{
  /**
   * The input value as ISO date string (YYYY-MM-DD for date, HH:mm for time, YYYY-MM-DDTHH:mm for datetime)
   */
  modelValue?: string
  /**
   * Input mode: date, time, or datetime
   */
  mode?: DateInputMode
  /**
   * Placeholder text shown when no value is selected
   */
  placeholder?: string
  /**
   * Whether the input is disabled
   */
  disabled?: boolean
  /**
   * Whether the input is required
   */
  required?: boolean
  /**
   * Whether the input has an error state
   */
  error?: boolean
  /**
   * Minimum allowed value (ISO string)
   */
  min?: string
  /**
   * Maximum allowed value (ISO string)
   */
  max?: string
}>(), {
  modelValue: undefined,
  mode: 'date',
  placeholder: undefined,
  disabled: false,
  required: false,
  error: false,
  min: undefined,
  max: undefined,
})

const emit = defineEmits<{
  /**
   * Emitted when the input value changes
   */
  'update:modelValue': [value: string | undefined]
}>()

const nativeInputRef = ref<HTMLInputElement | null>(null)

/**
 * Map the mode prop to the native input type
 */
const nativeInputType = computed(() => {
  switch (props.mode) {
    case 'time':
      return 'time'
    case 'datetime':
      return 'datetime-local'
    default:
      return 'date'
  }
})

/**
 * Format the display text using Intl.DateTimeFormat
 * - date mode: "Jan 21, 2026"
 * - time mode: "2:30 PM"
 * - datetime mode: "Jan 21, 2026, 2:30 PM"
 */
const displayText = computed(() => {
  if (!props.modelValue) {
    return props.placeholder || getDefaultPlaceholder()
  }

  try {
    // For time-only mode, create a date object with today's date
    if (props.mode === 'time') {
      const [hours, minutes] = props.modelValue.split(':').map(Number)
      const tempDate = new Date()
      tempDate.setHours(hours, minutes, 0, 0)

      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(tempDate)
    }

    // For date and datetime modes, parse the ISO string
    const date = new Date(props.modelValue)

    if (Number.isNaN(date.getTime())) {
      return props.modelValue // Return raw value if parsing fails
    }

    if (props.mode === 'datetime') {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(date)
    }

    // Default: date mode
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  } catch {
    // If formatting fails, return the raw value
    return props.modelValue
  }
})

/**
 * Get default placeholder based on mode
 */
function getDefaultPlaceholder(): string {
  switch (props.mode) {
    case 'time':
      return 'Select time'
    case 'datetime':
      return 'Select date and time'
    default:
      return 'Select date'
  }
}

/**
 * Open the native date picker
 */
function openPicker() {
  if (props.disabled) return
  nativeInputRef.value?.showPicker?.()
  nativeInputRef.value?.focus()
}

/**
 * Handle input events from the native input
 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value || undefined
  emit('update:modelValue', value)
}

/**
 * Handle change events (some browsers only fire change, not input)
 */
function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  const value = target.value || undefined
  emit('update:modelValue', value)
}

/**
 * Clear the current value
 */
function clearValue() {
  emit('update:modelValue', undefined)
}

// Expose the native input ref for external use
defineExpose({
  nativeInputRef,
})
</script>

<style scoped>
.ui-date-input-wrapper {
  @apply relative flex items-center px-3 py-2 rounded-lg cursor-pointer bg-white dark:bg-surface-200 border border-surface-300 text-surface-900;
  transition: border-color 200ms ease-in-out, box-shadow 200ms ease-in-out;
}

.ui-date-input-wrapper:hover:not(.ui-date-input-disabled) {
  @apply border-surface-400;
}

.ui-date-input-wrapper:focus-within {
  @apply outline-none ring-2 ring-primary-500 border-transparent;
}

.ui-date-input-wrapper.ui-date-input-error {
  border-color: rgb(var(--color-error-500)) !important;
  background: rgba(var(--color-error-500), 0.05);
}

.ui-date-input-wrapper.ui-date-input-error:focus-within {
  box-shadow: var(--focus-ring-error);
}

.ui-date-input-wrapper.ui-date-input-disabled {
  @apply opacity-60 cursor-not-allowed bg-surface-100 border-surface-200;
}

.ui-date-input-icon {
  @apply flex-shrink-0 mr-2 text-surface-400;
}

.ui-date-input-wrapper:focus-within .ui-date-input-icon {
  @apply text-primary-500;
}

.ui-date-input-display {
  @apply flex-1 text-sm truncate select-none text-surface-900;
}

.ui-date-input-display.is-placeholder {
  @apply text-surface-400;
}

.ui-date-input-clear {
  @apply flex-shrink-0 ml-2 p-1 rounded-md transition-colors text-surface-400;
}

.ui-date-input-clear:hover {
  @apply text-surface-600 bg-surface-200/50;
}

.ui-date-input-clear:active {
  @apply bg-surface-300/50;
}

/* Hidden native input that covers the entire wrapper for picker trigger */
.ui-date-input-native {
  @apply absolute inset-0 w-full h-full opacity-0 cursor-pointer;
  /* Ensure the native input receives clicks but is invisible */
  z-index: 1;
}

.ui-date-input-native:disabled {
  @apply cursor-not-allowed;
}

/* Position clear button above the native input */
.ui-date-input-clear {
  position: relative;
  z-index: 2;
}
</style>
