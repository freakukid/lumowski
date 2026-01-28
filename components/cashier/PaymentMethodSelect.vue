<template>
  <div class="payment-method-select">
    <!-- Screen reader live region for announcements -->
    <div
      ref="liveRegion"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ announcement }}
    </div>

    <!-- Payment Method Options -->
    <div
      id="payment-method-label"
      class="sr-only"
    >
      Select payment method
    </div>
    <div
      role="radiogroup"
      aria-labelledby="payment-method-label"
      class="payment-options"
    >
      <button
        v-for="option in paymentOptions"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="modelValue === option.value"
        :aria-label="option.label"
        :class="['payment-option', { active: modelValue === option.value }]"
        @click="selectPaymentMethod(option.value)"
      >
        <component :is="option.icon" class="w-5 h-5 flex-shrink-0" />
        <span class="option-label">{{ option.label }}</span>
      </button>
    </div>

    <!-- Card Type Sub-Selector (shown when Card is selected) -->
    <Transition name="slide-fade">
      <div
        v-if="modelValue === 'CARD'"
        class="sub-section"
      >
        <span id="card-type-label" class="sub-section-label">Card Type</span>
        <div
          role="radiogroup"
          aria-labelledby="card-type-label"
          class="card-type-options"
        >
          <button
            v-for="cardOption in cardTypeOptions"
            :key="cardOption.value"
            type="button"
            role="radio"
            :aria-checked="cardType === cardOption.value"
            :aria-label="cardOption.label"
            :class="[
              'card-type-option',
              { active: cardType === cardOption.value },
              { error: showCardTypeError && !cardType }
            ]"
            @click="selectCardType(cardOption.value)"
          >
            <span class="card-type-label">{{ cardOption.label }}</span>
          </button>
        </div>
        <!-- Validation error message -->
        <Transition name="fade">
          <div v-if="showCardTypeError && !cardType" class="error-message">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Please select a card type</span>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Check Number Input (shown when Check is selected) -->
    <Transition name="slide-fade">
      <div
        v-if="modelValue === 'CHECK'"
        class="sub-section"
      >
        <label for="check-number" class="sub-section-label">Check Number</label>
        <input
          id="check-number"
          ref="checkNumberInput"
          :value="checkNumber"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="Enter check number..."
          class="input check-number-input"
          aria-label="Check number"
          aria-describedby="check-number-hint"
          @input="handleCheckNumberInput"
        />
        <span id="check-number-hint" class="sr-only">
          Enter the check number from your check
        </span>
      </div>
    </Transition>

    <!-- Cash Tendered / Change Calculator (shown when Cash is selected) -->
    <Transition name="slide-fade" @after-enter="focusCashInput">
      <div
        v-if="modelValue === 'CASH' && grandTotal !== undefined"
        class="sub-section"
        :class="cashValidationClass"
      >
        <label for="cash-tendered" class="sub-section-label">Cash Tendered</label>

        <!-- Cash Input -->
        <div class="cash-input-wrapper">
          <span class="cash-input-prefix">$</span>
          <input
            id="cash-tendered"
            ref="cashTenderedInput"
            :value="displayCashValue"
            type="text"
            inputmode="decimal"
            placeholder="0.00"
            class="input cash-tendered-input"
            :class="{ 'input-error': cashValidationState === 'insufficient', 'input-success': cashValidationState === 'exact' || cashValidationState === 'valid' }"
            :aria-invalid="cashValidationState === 'insufficient'"
            :aria-describedby="cashValidationState !== 'default' ? 'cash-validation-message' : undefined"
            @input="handleCashInput"
            @blur="formatCashOnBlur"
            @keydown="handleCashKeydown"
          />
        </div>

        <!-- Quick Cash Buttons -->
        <div
          role="group"
          aria-label="Quick cash amount buttons"
          class="quick-cash-buttons"
        >
          <div class="quick-cash-grid">
            <button
              v-for="amount in quickCashAmounts"
              :key="amount"
              type="button"
              class="quick-cash-btn"
              :aria-label="`Add ${amount} dollars`"
              @click="addQuickCash(amount)"
            >
              ${{ amount }}
            </button>
          </div>
          <button
            type="button"
            class="quick-cash-btn exact-btn"
            aria-label="Set exact amount"
            @click="setExactAmount"
          >
            Exact
          </button>
        </div>

        <!-- Change Due Display / Validation Message -->
        <Transition name="fade">
          <div
            v-if="cashValidationState !== 'default'"
            id="cash-validation-message"
            :class="['cash-validation-message', cashValidationState]"
          >
            <template v-if="cashValidationState === 'insufficient'">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Insufficient amount (need {{ formatCurrency(amountShort) }} more)</span>
            </template>
            <template v-else-if="cashValidationState === 'exact'">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Exact amount</span>
            </template>
            <template v-else-if="cashValidationState === 'valid'">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span class="change-label">Change due:</span>
              <span class="change-amount">{{ formatCurrency(changeDue) }}</span>
            </template>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * Payment method selector component for the cashier.
 *
 * Provides a radio-group interface for selecting payment methods (CASH, CARD, CHECK, OTHER).
 * When CARD is selected, displays a sub-selector for card type (VISA, MASTERCARD, AMEX, DISCOVER).
 * When CHECK is selected, displays an input field for the check number.
 * When CASH is selected, displays a cash tendered input with quick-select buttons and change calculator.
 *
 * Includes:
 * - Full keyboard navigation support
 * - Screen reader announcements via live region
 * - Focus management (auto-focus on CHECK input or CASH input when selected)
 * - Proper cleanup when switching payment methods
 * - Validation error display for missing card type
 * - Cash tendered / change due calculator with visual validation states
 *
 * @example
 * ```vue
 * <CashierPaymentMethodSelect
 *   v-model="formData.paymentMethod"
 *   v-model:card-type="formData.cardType"
 *   v-model:check-number="formData.checkNumber"
 *   v-model:cash-tendered="formData.cashTendered"
 *   :grand-total="grandTotal"
 *   :show-card-type-error="showCardTypeError"
 * />
 * ```
 */
import { h } from 'vue'
import type { PaymentMethod, CardType } from '~/types/operation'

interface Props {
  /** The currently selected payment method */
  modelValue: PaymentMethod
  /** The selected card type (when payment method is CARD) */
  cardType?: CardType
  /** The check number (when payment method is CHECK) */
  checkNumber?: string
  /** Whether to show card type validation error */
  showCardTypeError?: boolean
  /** The sale's grand total (required for cash tendered calculator) */
  grandTotal?: number
  /** The cash amount tendered by the customer */
  cashTendered?: number
}

const props = withDefaults(defineProps<Props>(), {
  cardType: undefined,
  checkNumber: '',
  showCardTypeError: false,
  grandTotal: undefined,
  cashTendered: undefined,
})

const emit = defineEmits<{
  /** Emitted when payment method changes */
  'update:modelValue': [value: PaymentMethod]
  /** Emitted when card type changes */
  'update:cardType': [value: CardType | undefined]
  /** Emitted when check number changes */
  'update:checkNumber': [value: string]
  /** Emitted when cash tendered changes */
  'update:cashTendered': [value: number | undefined]
}>()

// Refs for focus management
const checkNumberInput = ref<HTMLInputElement | null>(null)
const cashTenderedInput = ref<HTMLInputElement | null>(null)
const liveRegion = ref<HTMLDivElement | null>(null)
const announcement = ref('')

// Local state for cash input display (allows typing without immediate formatting)
const localCashDisplay = ref('')

/**
 * Quick cash denomination buttons (additive).
 */
const quickCashAmounts = [1, 5, 10, 20, 50, 100]

/**
 * Computed display value for cash input.
 * Shows local display value when actively editing, otherwise formats from prop.
 */
const displayCashValue = computed(() => {
  if (localCashDisplay.value !== '') {
    return localCashDisplay.value
  }
  if (props.cashTendered !== undefined && props.cashTendered > 0) {
    return props.cashTendered.toFixed(2)
  }
  return ''
})

/**
 * Calculates the change due (tendered - total).
 * Returns 0 if tendered is undefined or less than total.
 */
const changeDue = computed(() => {
  if (props.cashTendered === undefined || props.grandTotal === undefined) {
    return 0
  }
  return Math.max(0, props.cashTendered - props.grandTotal)
})

/**
 * Calculates how much more cash is needed when insufficient.
 */
const amountShort = computed(() => {
  if (props.cashTendered === undefined || props.grandTotal === undefined) {
    return 0
  }
  return Math.max(0, props.grandTotal - props.cashTendered)
})

/**
 * Determines the validation state of the cash input.
 */
type CashValidationState = 'default' | 'insufficient' | 'exact' | 'valid'
const cashValidationState = computed<CashValidationState>(() => {
  if (props.cashTendered === undefined || props.cashTendered === 0) {
    return 'default'
  }
  if (props.grandTotal === undefined) {
    return 'default'
  }
  // Use relative epsilon for floating point comparison, with 0.01 USD minimum precision
  // This ensures proper handling for normal values while scaling appropriately for edge cases
  const epsilon = Math.max(0.01, props.grandTotal * 0.0001)
  if (props.cashTendered < props.grandTotal - epsilon) {
    return 'insufficient'
  }
  if (Math.abs(props.cashTendered - props.grandTotal) < epsilon) {
    return 'exact'
  }
  return 'valid'
})

/**
 * CSS class for the cash sub-section based on validation state.
 */
const cashValidationClass = computed(() => {
  return {
    'cash-insufficient': cashValidationState.value === 'insufficient',
    'cash-valid': cashValidationState.value === 'exact' || cashValidationState.value === 'valid',
  }
})

/**
 * Formats a number as USD currency.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

/**
 * Handles cash input, allowing only valid currency characters.
 */
function handleCashInput(event: Event): void {
  const target = event.target as HTMLInputElement
  let value = target.value

  // Remove any characters that aren't numbers or decimal point
  value = value.replace(/[^\d.]/g, '')

  // Ensure only one decimal point
  // When user pastes "1.2.3", treat as "1.23" (ignore extra dots after the first)
  const parts = value.split('.')
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('')
  }

  // Limit decimal places to 2
  if (parts.length === 2 && parts[1].length > 2) {
    value = parts[0] + '.' + parts[1].slice(0, 2)
  }

  localCashDisplay.value = value

  // Parse and emit the numeric value
  const numericValue = parseFloat(value)
  if (!isNaN(numericValue) && numericValue >= 0) {
    emit('update:cashTendered', numericValue)
  } else if (value === '' || value === '.') {
    emit('update:cashTendered', undefined)
  }
}

/**
 * Formats the cash input to 2 decimal places on blur.
 */
function formatCashOnBlur(): void {
  if (props.cashTendered !== undefined && props.cashTendered > 0) {
    localCashDisplay.value = ''
    // The displayCashValue computed will now show the formatted value
  } else {
    localCashDisplay.value = ''
  }
}

/**
 * Handles keydown events on cash input for better UX.
 */
function handleCashKeydown(event: KeyboardEvent): void {
  // Allow: backspace, delete, tab, escape, enter, decimal point
  if (
    event.key === 'Backspace' ||
    event.key === 'Delete' ||
    event.key === 'Tab' ||
    event.key === 'Escape' ||
    event.key === 'Enter' ||
    event.key === '.' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === 'Home' ||
    event.key === 'End'
  ) {
    return
  }
  // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if (event.ctrlKey && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
    return
  }
  // Block non-numeric characters
  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

/**
 * Adds a quick cash amount to the current tendered amount (additive).
 */
function addQuickCash(amount: number): void {
  const currentAmount = props.cashTendered ?? 0
  const newAmount = currentAmount + amount
  localCashDisplay.value = ''
  emit('update:cashTendered', newAmount)

  // Announce the addition
  announce(`Added ${amount} dollars. Total tendered: ${formatCurrency(newAmount)}`)
}

/**
 * Sets the cash tendered to the exact grand total amount.
 */
function setExactAmount(): void {
  if (props.grandTotal !== undefined) {
    localCashDisplay.value = ''
    emit('update:cashTendered', props.grandTotal)
    announce(`Exact amount set: ${formatCurrency(props.grandTotal)}`)
  }
}

/**
 * Focuses the cash input after the transition completes.
 */
function focusCashInput(): void {
  nextTick(() => {
    if (cashTenderedInput.value) {
      cashTenderedInput.value.focus()
    }
  })
}

// Cash icon component using render function (Vue runtime doesn't include template compiler)
const CashIcon = {
  render() {
    return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
      }),
    ])
  },
}

// Card icon component using render function (Vue runtime doesn't include template compiler)
const CardIcon = {
  render() {
    return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      }),
    ])
  },
}

// Check icon component using render function (Vue runtime doesn't include template compiler)
const CheckIcon = {
  render() {
    return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      }),
    ])
  },
}

// Other icon component using render function (Vue runtime doesn't include template compiler)
const OtherIcon = {
  render() {
    return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': '2',
        d: 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      }),
    ])
  },
}

/**
 * Payment method options with icons and labels.
 */
const paymentOptions = [
  { value: 'CASH' as PaymentMethod, label: 'Cash', icon: CashIcon },
  { value: 'CARD' as PaymentMethod, label: 'Card', icon: CardIcon },
  { value: 'CHECK' as PaymentMethod, label: 'Check', icon: CheckIcon },
  { value: 'OTHER' as PaymentMethod, label: 'Other', icon: OtherIcon },
]

/**
 * Card type options for sub-selector.
 */
const cardTypeOptions: { value: CardType; label: string }[] = [
  { value: 'VISA', label: 'Visa' },
  { value: 'MASTERCARD', label: 'Mastercard' },
  { value: 'AMEX', label: 'American Express' },
  { value: 'DISCOVER', label: 'Discover' },
]

/**
 * Announce a message to screen readers.
 */
function announce(message: string): void {
  // Clear first to ensure re-announcement of same message
  announcement.value = ''
  nextTick(() => {
    announcement.value = message
  })
}

/**
 * Handle payment method selection with cleanup of conditional fields.
 */
function selectPaymentMethod(method: PaymentMethod): void {
  const previousMethod = props.modelValue
  emit('update:modelValue', method)

  // Clear cardType if switching away from CARD
  if (previousMethod === 'CARD' && method !== 'CARD') {
    emit('update:cardType', undefined)
  }

  // Clear checkNumber if switching away from CHECK
  if (previousMethod === 'CHECK' && method !== 'CHECK') {
    emit('update:checkNumber', '')
  }

  // Clear cashTendered if switching away from CASH
  if (previousMethod === 'CASH' && method !== 'CASH') {
    localCashDisplay.value = ''
    emit('update:cashTendered', undefined)
  }

  // Announce the selection
  const methodLabel = paymentOptions.find((o) => o.value === method)?.label || method
  let announcementText = `${methodLabel} selected`

  if (method === 'CARD') {
    announcementText += '. Card type selection now available'
  } else if (method === 'CHECK') {
    announcementText += '. Check number input now available'
  } else if (method === 'CASH') {
    announcementText += '. Cash tendered input now available'
  }

  announce(announcementText)

  // Focus management (cash input is handled by transition @after-enter)
  nextTick(() => {
    if (method === 'CHECK' && checkNumberInput.value) {
      checkNumberInput.value.focus()
    }
  })
}

/**
 * Handle card type selection.
 */
function selectCardType(type: CardType): void {
  emit('update:cardType', type)
  const typeLabel = cardTypeOptions.find((o) => o.value === type)?.label || type
  announce(`${typeLabel} selected`)
}

/**
 * Handle check number input.
 */
function handleCheckNumberInput(event: Event): void {
  const target = event.target as HTMLInputElement
  emit('update:checkNumber', target.value)
}
</script>

<style scoped>
.payment-method-select {
  @apply w-full;
}

.payment-options {
  @apply grid grid-cols-2 gap-2;
}

/* Medium desktop: 2x2 grid layout */
@media (min-width: 640px) {
  .payment-options {
    @apply flex flex-wrap;
  }
}

/* Large desktop: single row layout */
@media (min-width: 900px) {
  .payment-options {
    @apply flex-nowrap;
  }
}

.payment-option {
  @apply flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all min-h-[44px];
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-500));
}

/* Medium desktop: buttons can grow but have a minimum width */
@media (min-width: 640px) {
  .payment-option {
    @apply flex-row gap-2 py-2.5 px-4;
    flex: 1 1 calc(50% - 0.5rem);
    min-width: 120px;
  }
}

/* Large desktop: single row with equal sizing */
@media (min-width: 900px) {
  .payment-option {
    flex: 1 1 0%;
    min-width: 90px;
  }
}

.payment-option:hover {
  background: rgba(var(--color-surface-200), 0.5);
  border-color: rgba(var(--color-surface-300), 0.8);
  color: rgb(var(--color-surface-600));
}

.payment-option:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

.payment-option.active {
  background: rgba(var(--color-primary-500), 0.08);
  border-color: rgb(var(--color-primary-500));
  color: rgb(var(--color-primary-600));
}

.option-label {
  @apply text-xs font-semibold;
}

@media (min-width: 640px) {
  .option-label {
    @apply text-sm;
  }
}

/* Sub-section container (card type / check number) */
.sub-section {
  @apply mt-3 p-3 rounded-xl;
  background: rgba(var(--color-surface-50), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.6);
}

.sub-section-label {
  @apply block text-sm font-medium mb-2;
  color: rgb(var(--color-surface-600));
}

/* Card type options */
.card-type-options {
  @apply grid grid-cols-2 gap-2;
}

@media (min-width: 640px) {
  .card-type-options {
    @apply flex flex-nowrap;
  }
}

.card-type-option {
  @apply flex items-center justify-center py-3 px-3 rounded-lg transition-all min-h-[44px];
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-500));
}

@media (min-width: 640px) {
  .card-type-option {
    @apply flex-1;
    min-width: 80px;
  }
}

.card-type-option:hover {
  background: rgba(var(--color-surface-200), 0.5);
  border-color: rgba(var(--color-surface-300), 0.8);
  color: rgb(var(--color-surface-600));
}

.card-type-option:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

.card-type-option.active {
  background: rgba(var(--color-primary-500), 0.08);
  border-color: rgb(var(--color-primary-500));
  color: rgb(var(--color-primary-600));
}

.card-type-option.error {
  border-color: rgba(var(--color-error-500), 0.5);
}

.card-type-label {
  @apply text-xs font-semibold text-center;
}

@media (min-width: 640px) {
  .card-type-label {
    @apply text-sm;
  }
}

/* Check number input */
.check-number-input {
  @apply w-full;
}

/* Cash Tendered Section */
.sub-section.cash-insufficient {
  background: rgba(var(--color-error-500), 0.04);
  border-color: rgba(var(--color-error-500), 0.3);
}

.sub-section.cash-valid {
  background: rgba(var(--color-success-500), 0.04);
  border-color: rgba(var(--color-success-500), 0.3);
}

/* Cash Input Wrapper */
.cash-input-wrapper {
  @apply relative flex items-center;
}

.cash-input-prefix {
  @apply absolute left-4 text-lg font-semibold pointer-events-none;
  color: rgb(var(--color-surface-500));
}

.cash-tendered-input {
  @apply w-full text-right text-xl font-semibold;
  padding-left: 2rem;
}

/* Quick Cash Buttons */
.quick-cash-buttons {
  @apply mt-3;
}

.quick-cash-grid {
  @apply grid grid-cols-3 gap-2 mb-2;
}

@media (min-width: 640px) {
  .quick-cash-grid {
    @apply flex flex-wrap gap-2 mb-0;
  }

  .quick-cash-buttons {
    @apply flex flex-wrap items-center gap-2;
  }

  .exact-btn {
    @apply flex-shrink-0;
    min-width: 70px;
  }
}

.quick-cash-btn {
  @apply flex items-center justify-center py-2.5 px-3 rounded-lg transition-all min-h-[44px] font-semibold text-sm;
  background: rgba(var(--color-surface-100), 0.8);
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-600));
}

@media (min-width: 640px) {
  .quick-cash-btn {
    @apply flex-1 py-2;
  }
}

.quick-cash-btn:hover {
  background: rgba(var(--color-surface-200), 0.8);
  border-color: rgba(var(--color-surface-300), 0.8);
  color: rgb(var(--color-surface-700));
}

.quick-cash-btn:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

.quick-cash-btn:active {
  transform: scale(0.97);
}

.exact-btn {
  @apply w-full min-h-[44px];
  background: rgba(var(--color-primary-500), 0.08);
  border-color: rgba(var(--color-primary-500), 0.3);
  color: rgb(var(--color-primary-600));
}

@media (min-width: 640px) {
  .exact-btn {
    @apply w-auto;
  }
}

.exact-btn:hover {
  background: rgba(var(--color-primary-500), 0.15);
  border-color: rgba(var(--color-primary-500), 0.5);
  color: rgb(var(--color-primary-700));
}

/* Cash Validation Message */
.cash-validation-message {
  @apply flex items-center gap-2 mt-3 text-sm font-medium;
}

.cash-validation-message.insufficient {
  color: rgb(var(--color-error-600));
}

.cash-validation-message.exact,
.cash-validation-message.valid {
  color: rgb(var(--color-success-600));
}

.cash-validation-message .change-label {
  color: rgb(var(--color-surface-600));
}

.cash-validation-message .change-amount {
  @apply text-lg font-bold;
  color: rgb(var(--color-success-600));
}

/* Error message */
.error-message {
  @apply flex items-center gap-1.5 mt-2 text-sm;
  color: rgb(var(--color-error-500));
}

/* Screen reader only */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}

/* Animations */
.slide-fade-enter-active {
  transition: all 200ms ease-out;
}

.slide-fade-leave-active {
  transition: all 150ms ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
