<template>
  <div class="ui-number-input-wrapper">
    <!-- Decrement button -->
    <button
      type="button"
      class="number-stepper-btn number-stepper-btn-left"
      :disabled="disabled || isAtMin"
      aria-label="Decrease value"
      @mousedown="startDecrement"
      @mouseup="stopRepeat"
      @mouseleave="stopRepeat"
      @touchstart.prevent="startDecrement"
      @touchend.prevent="stopRepeat"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M20 12H4"
        />
      </svg>
    </button>

    <!-- Prefix -->
    <span
      v-if="prefix"
      class="number-input-prefix"
    >
      {{ prefix }}
    </span>

    <!-- Input field -->
    <input
      :id="inputId"
      ref="inputRef"
      type="number"
      :value="displayValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :aria-describedby="ariaDescribedby"
      class="number-input"
      :class="{ 'has-prefix': prefix, 'has-suffix': suffix }"
      @input="handleInput"
      @keydown="handleKeydown"
      @blur="handleBlur"
    />

    <!-- Suffix -->
    <span
      v-if="suffix"
      class="number-input-suffix"
    >
      {{ suffix }}
    </span>

    <!-- Increment button -->
    <button
      type="button"
      class="number-stepper-btn number-stepper-btn-right"
      :disabled="disabled || isAtMax"
      aria-label="Increase value"
      @mousedown="startIncrement"
      @mouseup="stopRepeat"
      @mouseleave="stopRepeat"
      @touchstart.prevent="startIncrement"
      @touchend.prevent="stopRepeat"
    >
      <svg
        class="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * The input value (v-model)
   */
  modelValue?: number
  /**
   * Minimum allowed value
   */
  min?: number
  /**
   * Maximum allowed value
   */
  max?: number
  /**
   * Step increment value
   */
  step?: number
  /**
   * Whether the input is disabled
   */
  disabled?: boolean
  /**
   * Prefix text displayed before the value (e.g., "$")
   */
  prefix?: string
  /**
   * Suffix text displayed after the value (e.g., "%")
   */
  suffix?: string
  /**
   * The input id attribute
   */
  id?: string
  /**
   * ID(s) of elements that describe this input for accessibility
   */
  ariaDescribedby?: string
}>(), {
  modelValue: 0,
  min: undefined,
  max: undefined,
  step: 1,
  disabled: false,
  prefix: undefined,
  suffix: undefined,
  id: undefined,
  ariaDescribedby: undefined,
})

const emit = defineEmits<{
  /**
   * Emitted when the input value changes
   */
  'update:modelValue': [value: number]
}>()

const generatedId = useId()
const inputId = computed(() => props.id || `ui-number-input-${generatedId}`)
const inputRef = ref<HTMLInputElement | null>(null)

// Timer refs for long press repeat functionality
const repeatTimer = ref<number | null>(null)
const initialDelay = 400 // ms before repeat starts
const repeatInterval = 100 // ms between repeats

/**
 * Display value that handles NaN and undefined gracefully
 */
const displayValue = computed(() => {
  if (props.modelValue === undefined || Number.isNaN(props.modelValue)) {
    return ''
  }
  return props.modelValue
})

/**
 * Check if the current value is at the minimum
 */
const isAtMin = computed(() => {
  if (props.min === undefined) return false
  return props.modelValue !== undefined && props.modelValue <= props.min
})

/**
 * Check if the current value is at the maximum
 */
const isAtMax = computed(() => {
  if (props.max === undefined) return false
  return props.modelValue !== undefined && props.modelValue >= props.max
})

/**
 * Clamp a value within the min/max bounds
 */
function clampValue(value: number): number {
  let result = value

  if (props.min !== undefined && result < props.min) {
    result = props.min
  }
  if (props.max !== undefined && result > props.max) {
    result = props.max
  }

  return result
}

/**
 * Round to avoid floating point issues
 */
function roundToStep(value: number): number {
  // Round to avoid floating point precision issues
  const decimals = (props.step.toString().split('.')[1] || '').length
  return Number(value.toFixed(decimals))
}

/**
 * Update the value with proper clamping and rounding
 */
function updateValue(newValue: number) {
  const clamped = clampValue(newValue)
  const rounded = roundToStep(clamped)
  emit('update:modelValue', rounded)
}

/**
 * Increment the value by one step
 */
function increment() {
  const currentValue = props.modelValue ?? 0
  updateValue(currentValue + props.step)
}

/**
 * Decrement the value by one step
 */
function decrement() {
  const currentValue = props.modelValue ?? 0
  updateValue(currentValue - props.step)
}

/**
 * Start repeating increment on long press
 */
function startIncrement() {
  increment()
  repeatTimer.value = window.setTimeout(() => {
    repeatTimer.value = window.setInterval(increment, repeatInterval)
  }, initialDelay)
}

/**
 * Start repeating decrement on long press
 */
function startDecrement() {
  decrement()
  repeatTimer.value = window.setTimeout(() => {
    repeatTimer.value = window.setInterval(decrement, repeatInterval)
  }, initialDelay)
}

/**
 * Stop the repeat timer
 */
function stopRepeat() {
  if (repeatTimer.value !== null) {
    clearTimeout(repeatTimer.value)
    clearInterval(repeatTimer.value)
    repeatTimer.value = null
  }
}

/**
 * Handle direct input changes
 */
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  const rawValue = target.valueAsNumber

  if (Number.isNaN(rawValue)) {
    // Allow empty input during typing
    return
  }

  updateValue(rawValue)
}

/**
 * Handle blur event to ensure valid value
 */
function handleBlur() {
  const currentValue = props.modelValue

  // If the current value is undefined or NaN, reset to min or 0
  if (currentValue === undefined || Number.isNaN(currentValue)) {
    const fallback = props.min !== undefined ? props.min : 0
    emit('update:modelValue', fallback)
    return
  }

  // Ensure value is clamped on blur
  const clamped = clampValue(currentValue)
  if (clamped !== currentValue) {
    emit('update:modelValue', clamped)
  }
}

/**
 * Handle keyboard navigation
 */
function handleKeydown(event: KeyboardEvent) {
  if (props.disabled) return

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault()
      increment()
      break
    case 'ArrowDown':
      event.preventDefault()
      decrement()
      break
  }
}

// Clean up on unmount
onBeforeUnmount(() => {
  stopRepeat()
})

// Expose the input ID and ref for external use
defineExpose({
  inputId,
  inputRef,
})
</script>

<style scoped>
.ui-number-input-wrapper {
  @apply relative flex items-center;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  border-radius: 0.75rem;
  transition: border-color 200ms ease-in-out, box-shadow 200ms ease-in-out;
}

.ui-number-input-wrapper:hover:not(:focus-within) {
  border-color: rgba(var(--color-surface-400), 0.6);
}

.ui-number-input-wrapper:focus-within {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

/* Base stepper button styles */
.number-stepper-btn {
  @apply flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] transition-colors select-none;
  color: rgb(var(--color-surface-500));
  background: transparent;
}

.number-stepper-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.number-stepper-btn:active:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.5);
}

.number-stepper-btn:disabled {
  @apply opacity-40 cursor-not-allowed;
}

.number-stepper-btn-left {
  border-right: 1px solid rgba(var(--color-surface-300), 0.5);
  border-radius: 0.625rem 0 0 0.625rem;
}

.number-stepper-btn-right {
  border-left: 1px solid rgba(var(--color-surface-300), 0.5);
  border-radius: 0 0.625rem 0.625rem 0;
}

.number-input {
  @apply flex-1 min-w-0 px-3 py-3 text-center text-base md:text-sm font-medium outline-none bg-transparent min-h-[44px];
  color: rgb(var(--color-surface-900));
  /* Reset any browser styling on number inputs */
  -moz-appearance: textfield;
}

.number-input::-webkit-outer-spin-button,
.number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.number-input.has-prefix {
  @apply pl-1;
}

.number-input.has-suffix {
  @apply pr-1;
}

.number-input:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.number-input-prefix,
.number-input-suffix {
  @apply text-base md:text-sm font-medium select-none;
  color: rgb(var(--color-surface-500));
}

.number-input-prefix {
  @apply ml-2;
}

.number-input-suffix {
  @apply mr-2;
}

/* Disabled state for wrapper */
.ui-number-input-wrapper:has(.number-input:disabled) {
  @apply opacity-60;
  background: rgba(var(--color-surface-100), 0.5);
  border-color: rgba(var(--color-surface-200), 0.5);
}
</style>
