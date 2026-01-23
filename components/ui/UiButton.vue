<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <slot
      v-if="loading"
      name="loading"
    >
      <svg
        class="ui-button-spinner"
        :class="{ 'mr-2': !iconOnly && (loadingText || $slots.default) }"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </slot>

    <!-- Icon left slot -->
    <slot
      v-if="!loading"
      name="icon-left"
    />

    <!-- Button content -->
    <span
      v-if="!iconOnly"
      class="ui-button-content"
    >
      <template v-if="loading && loadingText">
        {{ loadingText }}
      </template>
      <slot v-else />
    </span>

    <!-- Icon right slot -->
    <slot
      v-if="!loading"
      name="icon-right"
    />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ButtonType = 'button' | 'submit' | 'reset'
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  /**
   * The button type attribute
   */
  type?: ButtonType
  /**
   * The button variant/style
   */
  variant?: ButtonVariant
  /**
   * The button size
   */
  size?: ButtonSize
  /**
   * Whether the button is disabled
   */
  disabled?: boolean
  /**
   * Whether the button is in a loading state
   */
  loading?: boolean
  /**
   * Text to display when loading (replaces default slot content)
   */
  loadingText?: string
  /**
   * Whether the button should take full width
   */
  block?: boolean
  /**
   * Whether the button only contains an icon (no text)
   */
  iconOnly?: boolean
}>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  loadingText: undefined,
  block: false,
  iconOnly: false,
})

const emit = defineEmits<{
  /**
   * Emitted when the button is clicked
   */
  'click': [event: MouseEvent]
}>()

const buttonClasses = computed(() => {
  const classes = ['btn']

  // Add variant class
  classes.push(`btn-${props.variant}`)

  // Add size class (md is default, no extra class needed)
  if (props.size === 'sm') {
    classes.push('btn-sm')
  } else if (props.size === 'lg') {
    classes.push('btn-lg')
  }

  // Add block class
  if (props.block) {
    classes.push('w-full')
  }

  // Add icon-only class
  if (props.iconOnly) {
    classes.push('ui-button-icon-only')
  }

  // Add loading class
  if (props.loading) {
    classes.push('ui-button-loading')
  }

  return classes
})

function handleClick(event: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<style scoped>
.ui-button-spinner {
  @apply w-4 h-4 animate-spin;
}

.ui-button-content {
  @apply inline-flex items-center;
}

.ui-button-icon-only {
  @apply p-2.5;
}

.ui-button-icon-only.btn-sm {
  @apply p-1.5;
}

.ui-button-icon-only.btn-lg {
  @apply p-3.5;
}

.ui-button-loading {
  @apply cursor-wait;
}
</style>
