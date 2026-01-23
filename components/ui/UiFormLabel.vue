<template>
  <label
    :for="htmlFor"
    :class="['label', { 'label-required': required }]"
  >
    <slot />
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /**
   * The id of the form element this label is associated with
   */
  for?: string
  /**
   * Whether the associated field is required (shows asterisk)
   */
  required?: boolean
}>(), {
  for: undefined,
  required: false,
})

// Rename 'for' prop to 'htmlFor' for template usage since 'for' is a reserved word in JavaScript
const htmlFor = computed(() => props.for)
</script>
