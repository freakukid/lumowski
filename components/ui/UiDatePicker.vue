<template>
  <div class="ui-date-picker">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      type="button"
      :id="pickerId"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-haspopup="'dialog'"
      :aria-describedby="ariaDescribedby"
      :class="[
        'date-picker-trigger',
        {
          'is-open': isOpen,
          'is-error': error,
          'is-disabled': disabled,
        },
      ]"
      @click="toggleOpen"
      @keydown="handleTriggerKeydown"
    >
      <!-- Calendar Icon -->
      <svg
        class="trigger-icon"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>

      <!-- Display Value -->
      <span
        class="trigger-display"
        :class="{ 'is-placeholder': !modelValue }"
      >
        {{ displayText }}
      </span>

      <!-- Chevron Icon -->
      <svg
        class="trigger-chevron"
        :class="{ 'is-rotated': isOpen }"
        fill="none"
        viewBox="0 0 20 20"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M6 8l4 4 4-4"
        />
      </svg>
    </button>

    <!-- Calendar Popup (Teleported to body) -->
    <Teleport to="body">
      <Transition name="calendar-popup">
        <div
          v-if="isOpen"
          ref="popupRef"
          role="dialog"
          aria-modal="true"
          :aria-label="`Choose date, ${currentMonthLabel} ${viewYear}`"
          :class="['calendar-popup', { 'is-mobile': isMobile }]"
          :style="popupStyle"
          @keydown="handlePopupKeydown"
        >
          <!-- Mobile Backdrop -->
          <div
            v-if="isMobile"
            class="calendar-backdrop"
            @click="closePopup"
          />

          <!-- Calendar Content -->
          <div class="calendar-content">
            <!-- Header: Month/Year Navigation -->
            <div class="calendar-header">
              <button
                type="button"
                class="nav-button"
                aria-label="Previous month"
                @click="goToPreviousMonth"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <span class="calendar-title">
                {{ currentMonthLabel }} {{ viewYear }}
              </span>

              <button
                type="button"
                class="nav-button"
                aria-label="Next month"
                @click="goToNextMonth"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            <!-- Weekday Headers -->
            <div
              class="weekday-headers"
              role="row"
            >
              <span
                v-for="day in weekdayLabels"
                :key="day"
                class="weekday-label"
                role="columnheader"
              >
                {{ day }}
              </span>
            </div>

            <!-- Day Grid -->
            <div
              ref="gridRef"
              class="day-grid"
              role="grid"
              :aria-label="`${currentMonthLabel} ${viewYear}`"
            >
              <button
                v-for="(day, index) in calendarDays"
                :key="`${day.date}-${index}`"
                type="button"
                role="gridcell"
                :tabindex="day.isCurrentMonth && !day.isDisabled ? 0 : -1"
                :aria-selected="day.isSelected ? 'true' : undefined"
                :aria-current="day.isToday ? 'date' : undefined"
                :aria-disabled="day.isDisabled ? 'true' : undefined"
                :disabled="day.isDisabled"
                :class="[
                  'day-cell',
                  {
                    'is-other-month': !day.isCurrentMonth,
                    'is-today': day.isToday,
                    'is-selected': day.isSelected,
                    'is-disabled': day.isDisabled,
                  },
                ]"
                @click="selectDay(day)"
                @keydown="handleDayKeydown($event, day, index)"
              >
                <span class="day-number">{{ day.dayNumber }}</span>
                <span
                  v-if="day.isToday && !day.isSelected"
                  class="today-indicator"
                  aria-hidden="true"
                />
              </button>
            </div>

            <!-- Footer: Today & Clear Buttons -->
            <div class="calendar-footer">
              <button
                type="button"
                class="footer-btn today-btn"
                @click="goToToday"
              >
                Today
              </button>
              <button
                v-if="clearable && modelValue"
                type="button"
                class="footer-btn clear-btn"
                @click="clearValue"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted, useId } from 'vue'

interface Props {
  /** The selected date value in ISO format (YYYY-MM-DD) */
  modelValue?: string
  /** Placeholder text when no date is selected */
  placeholder?: string
  /** The input id attribute */
  id?: string
  /** Whether the date picker is disabled */
  disabled?: boolean
  /** Whether a date selection is required */
  required?: boolean
  /** Whether the input has an error state */
  error?: boolean
  /** Minimum selectable date in ISO format (YYYY-MM-DD) */
  min?: string
  /** Maximum selectable date in ISO format (YYYY-MM-DD) */
  max?: string
  /** Whether the clear button is shown */
  clearable?: boolean
  /** ID(s) of elements that describe this input for accessibility */
  ariaDescribedby?: string
  /** First day of week: 0 = Sunday, 1 = Monday */
  firstDayOfWeek?: 0 | 1
}

interface DayCell {
  date: string // ISO format YYYY-MM-DD
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  isDisabled: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: 'Select date',
  id: undefined,
  disabled: false,
  required: false,
  error: false,
  min: undefined,
  max: undefined,
  clearable: true,
  ariaDescribedby: undefined,
  firstDayOfWeek: 0,
})

const emit = defineEmits<{
  /** Emitted when the selected date changes */
  'update:modelValue': [value: string | undefined]
}>()

// Refs
const triggerRef = ref<HTMLButtonElement | null>(null)
const popupRef = ref<HTMLDivElement | null>(null)
const gridRef = ref<HTMLDivElement | null>(null)
const isOpen = ref(false)
const isMobile = ref(false)
const popupPosition = ref({ top: 0, left: 0, placement: 'bottom' as 'bottom' | 'top' })

// View state (the month/year currently being viewed in the calendar)
const viewMonth = ref(new Date().getMonth())
const viewYear = ref(new Date().getFullYear())

// Generate unique ID
const generatedId = useId()
const pickerId = computed(() => props.id || `ui-date-picker-${generatedId}`)

// Weekday labels based on firstDayOfWeek
const weekdayLabels = computed(() => {
  const labels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  if (props.firstDayOfWeek === 1) {
    return [...labels.slice(1), labels[0]]
  }
  return labels
})

// Current month label for display
const currentMonthLabel = computed(() => {
  const date = new Date(viewYear.value, viewMonth.value, 1)
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)
})

// Format display text using Intl.DateTimeFormat
const displayText = computed(() => {
  if (!props.modelValue) {
    return props.placeholder
  }

  try {
    // Parse the ISO date string (YYYY-MM-DD)
    const [year, month, day] = props.modelValue.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    if (Number.isNaN(date.getTime())) {
      return props.modelValue
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  } catch {
    return props.modelValue
  }
})

// Generate calendar days for the current view
const calendarDays = computed((): DayCell[] => {
  const days: DayCell[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayStr = formatDateToISO(today)

  // First day of the view month
  const firstOfMonth = new Date(viewYear.value, viewMonth.value, 1)
  // Last day of the view month
  const lastOfMonth = new Date(viewYear.value, viewMonth.value + 1, 0)

  // Calculate the starting day offset
  let startDayOfWeek = firstOfMonth.getDay()
  if (props.firstDayOfWeek === 1) {
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1
  }

  // Days from previous month
  const prevMonth = new Date(viewYear.value, viewMonth.value, 0)
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonth.getDate() - i
    const date = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), dayNum)
    const dateStr = formatDateToISO(date)

    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
      isDisabled: isDateDisabled(dateStr),
    })
  }

  // Days of current month
  for (let dayNum = 1; dayNum <= lastOfMonth.getDate(); dayNum++) {
    const date = new Date(viewYear.value, viewMonth.value, dayNum)
    const dateStr = formatDateToISO(date)

    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
      isDisabled: isDateDisabled(dateStr),
    })
  }

  // Days from next month to fill 6 rows (42 cells)
  const remainingCells = 42 - days.length
  for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
    const date = new Date(viewYear.value, viewMonth.value + 1, dayNum)
    const dateStr = formatDateToISO(date)

    days.push({
      date: dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
      isDisabled: isDateDisabled(dateStr),
    })
  }

  return days
})

// Popup positioning style
const popupStyle = computed(() => {
  if (isMobile.value) {
    return {} // Mobile uses fixed positioning via CSS
  }

  return {
    top: `${popupPosition.value.top}px`,
    left: `${popupPosition.value.left}px`,
  }
})

/**
 * Format a Date object to ISO string (YYYY-MM-DD)
 */
function formatDateToISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Check if a date is disabled based on min/max constraints
 */
function isDateDisabled(dateStr: string): boolean {
  if (props.min && dateStr < props.min) {
    return true
  }
  if (props.max && dateStr > props.max) {
    return true
  }
  return false
}

/**
 * Check if viewport is mobile-sized
 */
function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

/**
 * Calculate popup position to avoid viewport overflow.
 *
 * Since the popup uses position: fixed, coordinates must be relative to
 * the viewport only. getBoundingClientRect() already returns viewport-relative
 * coordinates, so we must NOT add scroll offsets.
 */
function calculatePopupPosition() {
  if (!triggerRef.value || !popupRef.value || isMobile.value) return

  const triggerRect = triggerRef.value.getBoundingClientRect()
  const popupRect = popupRef.value.getBoundingClientRect()
  const popupWidth = 320
  const popupHeight = popupRect.height || 380 // Use actual height or fallback
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  const padding = 8

  // Default: position below the trigger (viewport-relative, no scroll offset)
  let top = triggerRect.bottom + padding
  let left = triggerRect.left
  let placement: 'bottom' | 'top' = 'bottom'

  // Check if popup would overflow bottom of viewport
  if (triggerRect.bottom + popupHeight + padding > viewportHeight) {
    // Position above the trigger
    top = triggerRect.top - popupHeight - padding
    placement = 'top'
  }

  // Check horizontal overflow (viewport-relative)
  if (left + popupWidth > viewportWidth - padding) {
    left = viewportWidth - popupWidth - padding
  }

  // Ensure not off left edge
  if (left < padding) {
    left = padding
  }

  popupPosition.value = { top, left, placement }
}

/**
 * Toggle the calendar popup
 */
function toggleOpen() {
  if (props.disabled) return

  if (isOpen.value) {
    closePopup()
  } else {
    openPopup()
  }
}

/**
 * Open the calendar popup
 */
function openPopup() {
  if (props.disabled) return

  // Set view to selected date or current date
  if (props.modelValue) {
    const [year, month] = props.modelValue.split('-').map(Number)
    viewYear.value = year
    viewMonth.value = month - 1
  } else {
    const now = new Date()
    viewYear.value = now.getFullYear()
    viewMonth.value = now.getMonth()
  }

  checkMobile()

  // First open the popup so it renders, then calculate position
  isOpen.value = true

  // Calculate position and focus after popup is rendered
  nextTick(() => {
    calculatePopupPosition()
    focusSelectedOrToday()
  })
}

/**
 * Close the calendar popup
 */
function closePopup() {
  isOpen.value = false
  triggerRef.value?.focus()
}

/**
 * Focus the selected day or today in the grid
 */
function focusSelectedOrToday() {
  if (!gridRef.value) return

  // Try to find selected day first, then today, then first day of month
  const selectedBtn = gridRef.value.querySelector('.day-cell.is-selected:not(.is-disabled)') as HTMLButtonElement
  const todayBtn = gridRef.value.querySelector('.day-cell.is-today:not(.is-disabled)') as HTMLButtonElement
  const firstDayBtn = gridRef.value.querySelector('.day-cell:not(.is-other-month):not(.is-disabled)') as HTMLButtonElement

  const targetBtn = selectedBtn || todayBtn || firstDayBtn
  if (targetBtn) {
    targetBtn.focus()
  } else if (gridRef.value) {
    // Fallback: focus the grid itself when all day buttons are disabled
    gridRef.value.setAttribute('tabindex', '-1')
    gridRef.value.focus()
  }
}

/**
 * Navigate to previous month
 */
function goToPreviousMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

/**
 * Navigate to next month
 */
function goToNextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

/**
 * Navigate to today and select it
 */
function goToToday() {
  const today = new Date()
  const todayStr = formatDateToISO(today)

  // If today is disabled, just navigate to today's month
  if (isDateDisabled(todayStr)) {
    viewYear.value = today.getFullYear()
    viewMonth.value = today.getMonth()
    return
  }

  emit('update:modelValue', todayStr)
  closePopup()
}

/**
 * Clear the selected date
 */
function clearValue() {
  emit('update:modelValue', undefined)
  closePopup()
}

/**
 * Select a day
 */
function selectDay(day: DayCell) {
  if (day.isDisabled) return

  emit('update:modelValue', day.date)
  closePopup()
}

/**
 * Handle trigger button keydown
 */
function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggleOpen()
  }
}

/**
 * Handle popup keydown (Escape to close)
 */
function handlePopupKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closePopup()
  }
}

/**
 * Handle day cell keydown for arrow key navigation
 */
function handleDayKeydown(event: KeyboardEvent, day: DayCell, index: number) {
  const key = event.key
  let targetIndex: number | null = null

  switch (key) {
    case 'ArrowLeft':
      event.preventDefault()
      targetIndex = index - 1
      break
    case 'ArrowRight':
      event.preventDefault()
      targetIndex = index + 1
      break
    case 'ArrowUp':
      event.preventDefault()
      targetIndex = index - 7
      break
    case 'ArrowDown':
      event.preventDefault()
      targetIndex = index + 7
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      selectDay(day)
      return
    default:
      return
  }

  // Navigate to target day if valid
  if (targetIndex !== null && targetIndex >= 0 && targetIndex < calendarDays.value.length) {
    const targetDay = calendarDays.value[targetIndex]

    // If navigating to a different month, update the view
    if (!targetDay.isCurrentMonth) {
      const [year, month] = targetDay.date.split('-').map(Number)
      viewYear.value = year
      viewMonth.value = month - 1

      // Focus the day after view updates
      nextTick(() => {
        const buttons = gridRef.value?.querySelectorAll('.day-cell') as NodeListOf<HTMLButtonElement>
        // Find the button with matching date in the new view
        for (const btn of buttons) {
          const dayCell = calendarDays.value.find((d) => d.date === targetDay.date && d.isCurrentMonth)
          if (dayCell) {
            const newIndex = calendarDays.value.indexOf(dayCell)
            buttons[newIndex]?.focus()
            break
          }
        }
      })
    } else {
      // Focus the target button in current view
      const buttons = gridRef.value?.querySelectorAll('.day-cell') as NodeListOf<HTMLButtonElement>
      buttons[targetIndex]?.focus()
    }
  }
}

/**
 * Handle click outside to close popup
 */
function handleClickOutside(event: MouseEvent) {
  if (!isOpen.value) return

  const target = event.target as Node
  const isInsidePopup = popupRef.value?.contains(target)
  const isInsideTrigger = triggerRef.value?.contains(target)

  if (!isInsidePopup && !isInsideTrigger) {
    closePopup()
  }
}

/**
 * Handle window resize
 */
function handleResize() {
  checkMobile()
  if (isOpen.value && !isMobile.value) {
    calculatePopupPosition()
  }
}

/**
 * Handle scroll to reposition popup
 */
function handleScroll() {
  if (isOpen.value && !isMobile.value) {
    calculatePopupPosition()
  }
}

// Watch for modelValue changes to update view
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue && isOpen.value) {
      const [year, month] = newValue.split('-').map(Number)
      viewYear.value = year
      viewMonth.value = month - 1
    }
  }
)

// Lifecycle hooks
onMounted(() => {
  checkMobile()
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll, true)
})

// Expose for external use
defineExpose({
  pickerId,
  open: openPopup,
  close: closePopup,
})
</script>

<style scoped>
/* ===== TRIGGER BUTTON ===== */
.date-picker-trigger {
  @apply flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left cursor-pointer min-h-[44px];
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
  transition: border-color 200ms ease-in-out, background-color 200ms ease-in-out, box-shadow 200ms ease-in-out;
}

.date-picker-trigger:hover:not(.is-disabled):not(.is-open) {
  border-color: rgba(var(--color-surface-400), 0.6);
}

.date-picker-trigger.is-open,
.date-picker-trigger:focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: var(--focus-ring);
  outline: none;
}

.date-picker-trigger.is-error {
  border-color: rgb(var(--color-error-500)) !important;
  background: rgba(var(--color-error-500), 0.05);
}

.date-picker-trigger.is-error:focus,
.date-picker-trigger.is-error.is-open {
  box-shadow: var(--focus-ring-error);
}

.date-picker-trigger.is-disabled {
  @apply opacity-60 cursor-not-allowed;
  background: rgba(var(--color-surface-100), 0.5);
  border-color: rgba(var(--color-surface-200), 0.5);
}

.trigger-icon {
  @apply w-5 h-5 flex-shrink-0;
  color: rgb(var(--color-surface-400));
}

.date-picker-trigger.is-open .trigger-icon,
.date-picker-trigger:focus .trigger-icon {
  color: rgb(var(--color-primary-500));
}

.trigger-display {
  @apply flex-1 text-base md:text-sm font-medium truncate;
  color: rgb(var(--color-surface-900));
}

.trigger-display.is-placeholder {
  color: rgb(var(--color-surface-400));
}

.trigger-chevron {
  @apply w-4 h-4 flex-shrink-0 transition-transform duration-200;
  color: rgb(var(--color-surface-400));
}

.trigger-chevron.is-rotated {
  transform: rotate(180deg);
}

/* ===== CALENDAR POPUP ===== */
.calendar-popup {
  @apply fixed z-50 w-80 rounded-xl overflow-hidden;
  background: rgb(var(--color-surface-50));
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.calendar-popup.is-mobile {
  @apply inset-x-0 bottom-0 w-full rounded-t-2xl rounded-b-none;
  max-height: 90vh;
}

.calendar-backdrop {
  @apply fixed inset-0 -z-10;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.calendar-content {
  @apply flex flex-col;
}

/* ===== CALENDAR HEADER ===== */
.calendar-header {
  @apply flex items-center justify-between px-3 py-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.nav-button {
  @apply flex items-center justify-center w-9 h-9 rounded-lg transition-colors;
  color: rgb(var(--color-surface-600));
}

.nav-button:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.nav-button:active {
  background: rgba(var(--color-surface-300), 0.5);
}

.nav-button:focus {
  @apply outline-none;
  box-shadow: var(--focus-ring-sm);
}

.calendar-title {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-900));
}

/* ===== WEEKDAY HEADERS ===== */
.weekday-headers {
  @apply grid grid-cols-7 px-3 py-2;
}

.weekday-label {
  @apply flex items-center justify-center w-10 h-8 text-xs font-semibold uppercase;
  color: rgb(var(--color-surface-500));
}

/* ===== DAY GRID ===== */
.day-grid {
  @apply grid grid-cols-7 gap-0.5 px-3 py-1;
}

.day-cell {
  @apply relative flex flex-col items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors;
  color: rgb(var(--color-surface-700));
}

.day-cell:hover:not(.is-disabled):not(.is-selected) {
  background: rgba(var(--color-surface-200), 0.5);
}

.day-cell:focus {
  @apply outline-none;
  box-shadow: var(--focus-ring-sm);
}

.day-cell.is-other-month {
  color: rgb(var(--color-surface-300));
}

.day-cell.is-today:not(.is-selected) {
  @apply font-bold;
  color: rgb(var(--color-primary-600));
}

.day-cell.is-selected {
  @apply font-semibold text-white;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 2px 8px rgba(var(--color-primary-500), 0.3);
}

.day-cell.is-disabled {
  @apply opacity-40 cursor-not-allowed;
}

.day-number {
  @apply relative z-10;
}

.today-indicator {
  @apply absolute bottom-1.5 w-1 h-1 rounded-full;
  background: rgb(var(--color-primary-500));
}

/* ===== CALENDAR FOOTER ===== */
.calendar-footer {
  @apply flex justify-between px-3 py-2.5;
  border-top: 1px solid rgba(var(--color-surface-200), 0.8);
  background: rgba(var(--color-surface-100), 0.5);
}

.footer-btn {
  @apply px-3 py-1.5 rounded-lg text-sm font-medium transition-colors;
}

.footer-btn:focus {
  @apply outline-none;
  box-shadow: var(--focus-ring-sm);
}

.today-btn {
  color: rgb(var(--color-primary-600));
}

.today-btn:hover {
  background: rgba(var(--color-primary-500), 0.1);
}

.clear-btn {
  color: rgb(var(--color-surface-500));
}

.clear-btn:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

/* ===== ANIMATIONS ===== */
.calendar-popup-enter-active,
.calendar-popup-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.calendar-popup-enter-from,
.calendar-popup-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

/* Mobile animation */
.calendar-popup.is-mobile.calendar-popup-enter-from,
.calendar-popup.is-mobile.calendar-popup-leave-to {
  transform: translateY(100%);
}

/* ===== MOBILE RESPONSIVE ===== */
@media (max-width: 767px) {
  .nav-button {
    @apply w-11 h-11;
  }

  .weekday-label {
    @apply w-11 h-9;
  }

  .day-cell {
    @apply w-11 h-11;
  }

  .calendar-footer {
    @apply px-4 py-3;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  }

  .footer-btn {
    @apply px-4 py-2 text-base;
  }
}
</style>
