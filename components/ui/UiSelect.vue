<template>
  <div
    ref="containerRef"
    class="ui-select"
    :class="[
      {
        'ui-select--open': isOpen,
        'ui-select--disabled': disabled,
        'ui-select--error': error,
        'ui-select--success': success,
      },
      selectClass,
    ]"
  >
    <!-- Trigger Button -->
    <button
      :id="selectId"
      ref="triggerRef"
      type="button"
      class="ui-select-trigger"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="'listbox'"
      :aria-labelledby="ariaLabelledby"
      :aria-describedby="ariaDescribedby"
      :aria-invalid="error ? 'true' : undefined"
      :aria-required="required ? 'true' : undefined"
      @click="toggleDropdown"
      @keydown="handleTriggerKeydown"
    >
      <span class="ui-select-value" :class="{ 'ui-select-placeholder': !hasValue }">
        {{ displayValue }}
      </span>
      <span class="ui-select-icon" aria-hidden="true">
        <svg
          class="ui-select-chevron"
          :class="{ 'ui-select-chevron--open': isOpen }"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M6 8l4 4 4-4"
          />
        </svg>
      </span>
    </button>

    <!-- Dropdown Panel -->
    <Teleport to="body">
      <Transition name="ui-select-dropdown">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="ui-select-dropdown"
          :style="dropdownStyle"
          role="listbox"
          :aria-activedescendant="activeOptionId"
          tabindex="-1"
          @keydown="handleListKeydown"
        >
          <div class="ui-select-options">
            <template v-for="(item, index) in normalizedOptions" :key="item.key">
              <!-- Option Group -->
              <template v-if="item.type === 'group'">
                <div class="ui-select-group-label" role="presentation">
                  {{ item.label }}
                </div>
                <div
                  v-for="(option, optIndex) in item.options"
                  :id="`${selectId}-option-${item.groupIndex}-${optIndex}`"
                  :key="option.value"
                  class="ui-select-option"
                  :class="{
                    'ui-select-option--selected': isSelected(option.value),
                    'ui-select-option--focused': focusedIndex === getFlatIndex(item.groupIndex, optIndex),
                    'ui-select-option--disabled': option.disabled,
                  }"
                  role="option"
                  :aria-selected="isSelected(option.value)"
                  :aria-disabled="option.disabled"
                  @click="!option.disabled && selectOption(option.value)"
                  @mouseenter="focusedIndex = getFlatIndex(item.groupIndex, optIndex)"
                >
                  <span class="ui-select-option-text">{{ option.label }}</span>
                  <span v-if="isSelected(option.value)" class="ui-select-option-check" aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </span>
                </div>
              </template>

              <!-- Single Option -->
              <div
                v-else
                :id="`${selectId}-option-${index}`"
                class="ui-select-option"
                :class="{
                  'ui-select-option--selected': isSelected(item.value),
                  'ui-select-option--focused': focusedIndex === index,
                  'ui-select-option--disabled': item.disabled,
                }"
                role="option"
                :aria-selected="isSelected(item.value)"
                :aria-disabled="item.disabled"
                @click="!item.disabled && selectOption(item.value)"
                @mouseenter="focusedIndex = index"
              >
                <span class="ui-select-option-text">{{ item.label }}</span>
                <span v-if="isSelected(item.value)" class="ui-select-option-check" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </span>
              </div>
            </template>

            <!-- Empty state -->
            <div v-if="normalizedOptions.length === 0" class="ui-select-empty">
              No options available
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick, useId } from 'vue'

interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface SelectOptionGroup {
  label: string
  options: SelectOption[]
}

type OptionOrGroup = SelectOption | SelectOptionGroup

interface NormalizedOption {
  type: 'option'
  key: string
  value: string | number
  label: string
  disabled?: boolean
}

interface NormalizedGroup {
  type: 'group'
  key: string
  label: string
  groupIndex: number
  options: SelectOption[]
}

type NormalizedItem = NormalizedOption | NormalizedGroup

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    options: OptionOrGroup[]
    id?: string
    name?: string
    placeholder?: string
    disabled?: boolean
    required?: boolean
    error?: boolean
    success?: boolean
    selectClass?: string
    ariaDescribedby?: string
    ariaLabel?: string
  }>(),
  {
    modelValue: '',
    id: undefined,
    name: undefined,
    placeholder: undefined,
    disabled: false,
    required: false,
    error: false,
    success: false,
    selectClass: undefined,
    ariaDescribedby: undefined,
    ariaLabel: undefined,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  change: [value: string | number]
  open: []
  close: []
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

// State
const isOpen = ref(false)
const focusedIndex = ref(-1)
const dropdownStyle = ref<Record<string, string>>({})

// IDs for accessibility
const generatedId = useId()
const selectId = computed(() => props.id || `ui-select-${generatedId}`)
const ariaLabelledby = computed(() => props.ariaLabel ? undefined : selectId.value)

// Check if option has group structure
function isOptionGroup(item: OptionOrGroup): item is SelectOptionGroup {
  return 'options' in item && Array.isArray(item.options)
}

// Normalize options for rendering (handle both flat and grouped)
const normalizedOptions = computed<NormalizedItem[]>(() => {
  const result: NormalizedItem[] = []
  let groupIndex = 0

  for (let i = 0; i < props.options.length; i++) {
    const item = props.options[i]
    if (isOptionGroup(item)) {
      result.push({
        type: 'group',
        key: `group-${groupIndex}`,
        label: item.label,
        groupIndex,
        options: item.options,
      })
      groupIndex++
    } else {
      result.push({
        type: 'option',
        key: `option-${i}`,
        value: item.value,
        label: item.label,
        disabled: item.disabled,
      })
    }
  }

  return result
})

// Flat list of all selectable options (for keyboard navigation)
const flatOptions = computed(() => {
  const result: { value: string | number; label: string; disabled?: boolean }[] = []

  for (const item of normalizedOptions.value) {
    if (item.type === 'group') {
      result.push(...item.options)
    } else {
      result.push({ value: item.value, label: item.label, disabled: item.disabled })
    }
  }

  return result
})

// Get flat index for grouped options
function getFlatIndex(groupIndex: number, optIndex: number): number {
  let index = 0
  for (const item of normalizedOptions.value) {
    if (item.type === 'group') {
      if (item.groupIndex === groupIndex) {
        return index + optIndex
      }
      index += item.options.length
    } else {
      index++
    }
  }
  return -1
}

// Check if value is selected
function isSelected(value: string | number): boolean {
  return props.modelValue === value
}

// Get display value
const hasValue = computed(() => {
  return props.modelValue !== '' && props.modelValue !== null && props.modelValue !== undefined
})

const displayValue = computed(() => {
  if (!hasValue.value) {
    return props.placeholder || 'Select...'
  }

  for (const option of flatOptions.value) {
    if (option.value === props.modelValue) {
      return option.label
    }
  }

  return props.modelValue
})

// Active option ID for aria-activedescendant
const activeOptionId = computed(() => {
  if (focusedIndex.value < 0) return undefined
  return `${selectId.value}-option-${focusedIndex.value}`
})

// Position dropdown
function positionDropdown() {
  if (!triggerRef.value || !dropdownRef.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const dropdownHeight = dropdownRef.value.offsetHeight
  const viewportHeight = window.innerHeight
  const scrollY = window.scrollY

  // Check if dropdown fits below
  const spaceBelow = viewportHeight - triggerRect.bottom
  const spaceAbove = triggerRect.top
  const fitsBelow = spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove

  // Position dropdown
  const top = fitsBelow
    ? triggerRect.bottom + scrollY + 4
    : triggerRect.top + scrollY - dropdownHeight - 4

  dropdownStyle.value = {
    position: 'absolute',
    top: `${top}px`,
    left: `${triggerRect.left}px`,
    width: `${triggerRect.width}px`,
    maxHeight: `${Math.min(300, Math.max(spaceBelow, spaceAbove) - 16)}px`,
    zIndex: '9999',
  }
}

// Open dropdown
function openDropdown() {
  if (props.disabled || isOpen.value) return

  isOpen.value = true
  emit('open')

  // Set initial focus to selected option or first option
  const selectedIndex = flatOptions.value.findIndex((opt) => opt.value === props.modelValue)
  focusedIndex.value = selectedIndex >= 0 ? selectedIndex : 0

  nextTick(() => {
    positionDropdown()
    // Use preventScroll to avoid page scrolling when focusing the dropdown
    dropdownRef.value?.focus({ preventScroll: true })
  })
}

// Close dropdown
function closeDropdown(returnFocus = true) {
  if (!isOpen.value) return

  isOpen.value = false
  focusedIndex.value = -1
  emit('close')

  if (returnFocus) {
    triggerRef.value?.focus()
  }
}

// Toggle dropdown
function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

// Select an option
function selectOption(value: string | number) {
  emit('update:modelValue', value)
  emit('change', value)
  closeDropdown()
}

// Keyboard navigation for trigger
function handleTriggerKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Enter':
    case ' ':
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      openDropdown()
      break
    case 'Escape':
      if (isOpen.value) {
        event.preventDefault()
        closeDropdown()
      }
      break
  }
}

// Keyboard navigation for listbox
function handleListKeydown(event: KeyboardEvent) {
  const enabledOptions = flatOptions.value.filter((opt) => !opt.disabled)
  const currentEnabledIndex = enabledOptions.findIndex(
    (opt) => opt.value === flatOptions.value[focusedIndex.value]?.value
  )

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (currentEnabledIndex < enabledOptions.length - 1) {
        const nextOption = enabledOptions[currentEnabledIndex + 1]
        focusedIndex.value = flatOptions.value.findIndex((opt) => opt.value === nextOption.value)
      }
      break

    case 'ArrowUp':
      event.preventDefault()
      if (currentEnabledIndex > 0) {
        const prevOption = enabledOptions[currentEnabledIndex - 1]
        focusedIndex.value = flatOptions.value.findIndex((opt) => opt.value === prevOption.value)
      }
      break

    case 'Home':
      event.preventDefault()
      if (enabledOptions.length > 0) {
        focusedIndex.value = flatOptions.value.findIndex(
          (opt) => opt.value === enabledOptions[0].value
        )
      }
      break

    case 'End':
      event.preventDefault()
      if (enabledOptions.length > 0) {
        focusedIndex.value = flatOptions.value.findIndex(
          (opt) => opt.value === enabledOptions[enabledOptions.length - 1].value
        )
      }
      break

    case 'Enter':
    case ' ':
      event.preventDefault()
      if (focusedIndex.value >= 0 && !flatOptions.value[focusedIndex.value]?.disabled) {
        selectOption(flatOptions.value[focusedIndex.value].value)
      }
      break

    case 'Escape':
      event.preventDefault()
      closeDropdown()
      break

    case 'Tab':
      closeDropdown()
      break

    default:
      // Type-ahead: jump to first option starting with typed character
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        const char = event.key.toLowerCase()
        const startIndex = focusedIndex.value + 1
        const options = flatOptions.value

        // Search from current position
        for (let i = startIndex; i < options.length; i++) {
          if (!options[i].disabled && options[i].label.toLowerCase().startsWith(char)) {
            focusedIndex.value = i
            return
          }
        }

        // Wrap around to beginning
        for (let i = 0; i < startIndex; i++) {
          if (!options[i].disabled && options[i].label.toLowerCase().startsWith(char)) {
            focusedIndex.value = i
            return
          }
        }
      }
  }
}

// Click outside handler
function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  if (
    containerRef.value &&
    !containerRef.value.contains(target) &&
    dropdownRef.value &&
    !dropdownRef.value.contains(target)
  ) {
    closeDropdown(false)
  }
}

// Scroll/resize handler
function handleScrollResize() {
  if (isOpen.value) {
    positionDropdown()
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
  window.addEventListener('scroll', handleScrollResize, true)
  window.addEventListener('resize', handleScrollResize)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  window.removeEventListener('scroll', handleScrollResize, true)
  window.removeEventListener('resize', handleScrollResize)
})

// Watch for focus index changes to scroll into view
watch(focusedIndex, (index) => {
  if (index < 0 || !dropdownRef.value) return

  const optionEl = dropdownRef.value.querySelector(
    `[id="${selectId.value}-option-${index}"]`
  ) as HTMLElement

  if (optionEl) {
    // Get the scrollable container (ui-select-options)
    const scrollContainer = dropdownRef.value.querySelector('.ui-select-options')
    if (scrollContainer && scrollContainer.contains(optionEl)) {
      // Manually scroll within the container to avoid affecting page scroll
      const containerRect = scrollContainer.getBoundingClientRect()
      const optionRect = optionEl.getBoundingClientRect()

      if (optionRect.bottom > containerRect.bottom) {
        // Option is below visible area - scroll down
        scrollContainer.scrollTop += optionRect.bottom - containerRect.bottom
      } else if (optionRect.top < containerRect.top) {
        // Option is above visible area - scroll up
        scrollContainer.scrollTop -= containerRect.top - optionRect.top
      }
    }
  }
})

// Expose for external use
defineExpose({
  selectId,
  open: openDropdown,
  close: closeDropdown,
  toggle: toggleDropdown,
})
</script>

<style scoped>
/* Container */
.ui-select {
  @apply relative w-full;
}

/* Trigger Button */
.ui-select-trigger {
  @apply w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-base md:text-sm
    font-medium outline-none transition-all duration-200 min-h-[44px] text-left cursor-pointer;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgb(var(--color-surface-300));
  color: rgb(var(--color-surface-900));
  box-shadow: inset 0 1px 2px rgba(var(--color-surface-900), 0.04);
}

.ui-select-trigger:hover:not(:disabled) {
  border-color: rgb(var(--color-surface-400));
  background: rgba(var(--color-surface-50), 0.8);
}

.ui-select-trigger:focus-visible {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
  outline: none;
}

.ui-select--open .ui-select-trigger {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.ui-select-trigger:disabled {
  @apply opacity-60 cursor-not-allowed;
  background: rgba(var(--color-surface-100), 0.5);
  border-color: rgba(var(--color-surface-200), 0.5);
}

/* Error state */
.ui-select--error .ui-select-trigger {
  border-color: rgb(var(--color-error-500)) !important;
  background: rgba(var(--color-error-500), 0.05);
}

.ui-select--error .ui-select-trigger:focus-visible,
.ui-select--error.ui-select--open .ui-select-trigger {
  box-shadow: var(--focus-ring-error);
}

/* Success state */
.ui-select--success .ui-select-trigger {
  border-color: rgb(var(--color-success-500)) !important;
  background: rgba(var(--color-success-500), 0.05);
}

.ui-select--success .ui-select-trigger:focus-visible,
.ui-select--success.ui-select--open .ui-select-trigger {
  box-shadow: var(--focus-ring-success);
}

/* Value display */
.ui-select-value {
  @apply flex-1 truncate;
}

.ui-select-placeholder {
  color: rgb(var(--color-surface-400));
}

/* Chevron icon */
.ui-select-icon {
  @apply flex-shrink-0 flex items-center justify-center;
  color: rgb(var(--color-surface-400));
}

.ui-select-chevron {
  @apply w-5 h-5 transition-transform duration-200;
}

.ui-select-chevron--open {
  transform: rotate(180deg);
}

/* Dropdown panel */
.ui-select-dropdown {
  @apply overflow-hidden rounded-xl;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.1),
    0 4px 12px rgba(0, 0, 0, 0.05);
}

/* Dark theme dropdown */
html[data-theme="midnight"] .ui-select-dropdown {
  background: rgb(var(--color-surface-100));
  border-color: rgba(var(--color-surface-200), 0.4);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.3),
    0 4px 12px rgba(0, 0, 0, 0.2);
}

.ui-select-options {
  @apply overflow-y-auto py-1;
  max-height: inherit;
}

/* Group label */
.ui-select-group-label {
  @apply px-3 py-2 text-xs font-semibold uppercase tracking-wider;
  color: rgb(var(--color-surface-500));
}

/* Option */
.ui-select-option {
  @apply flex items-center justify-between gap-2 px-4 py-2.5 cursor-pointer transition-colors duration-100 min-h-[44px];
  color: rgb(var(--color-surface-700));
}

.ui-select-option:hover:not(.ui-select-option--disabled) {
  background: rgba(var(--color-surface-100), 0.8);
}

.ui-select-option--focused:not(.ui-select-option--disabled) {
  background: rgba(var(--color-primary-500), 0.08);
  color: rgb(var(--color-surface-900));
}

html[data-theme="midnight"] .ui-select-option--focused:not(.ui-select-option--disabled) {
  background: rgba(var(--color-primary-500), 0.15);
}

.ui-select-option--selected {
  background: rgba(var(--color-primary-500), 0.08);
  color: rgb(var(--color-primary-700));
  font-weight: 500;
}

html[data-theme="midnight"] .ui-select-option--selected {
  background: rgba(var(--color-primary-500), 0.12);
  color: rgb(var(--color-primary-400));
}

.ui-select-option--selected.ui-select-option--focused {
  background: rgba(var(--color-primary-500), 0.12);
}

html[data-theme="midnight"] .ui-select-option--selected.ui-select-option--focused {
  background: rgba(var(--color-primary-500), 0.2);
}

.ui-select-option--disabled {
  @apply opacity-50 cursor-not-allowed;
}

.ui-select-option-text {
  @apply flex-1 truncate text-sm;
}

.ui-select-option-check {
  @apply flex-shrink-0 w-5 h-5;
  color: rgb(var(--color-primary-500));
}

html[data-theme="midnight"] .ui-select-option-check {
  color: rgb(var(--color-primary-400));
}

/* Empty state */
.ui-select-empty {
  @apply px-4 py-6 text-center text-sm;
  color: rgb(var(--color-surface-400));
}

/* Dropdown animation */
.ui-select-dropdown-enter-active,
.ui-select-dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.ui-select-dropdown-enter-from,
.ui-select-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .ui-select-trigger,
  .ui-select-chevron,
  .ui-select-option,
  .ui-select-dropdown-enter-active,
  .ui-select-dropdown-leave-active {
    transition: none !important;
  }
}
</style>
