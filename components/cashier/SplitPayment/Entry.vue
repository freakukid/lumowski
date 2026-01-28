<template>
  <div class="payment-entry">
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

    <!-- Entry Header -->
    <div class="entry-header">
      <span class="entry-number">Payment {{ entryNumber }}</span>
      <button
        v-if="canRemove"
        type="button"
        class="remove-btn"
        :aria-label="`Remove payment ${entryNumber}`"
        @click="handleRemove"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>

    <!-- Payment Method Options -->
    <div
      :id="`payment-method-label-${entry.id}`"
      class="sr-only"
    >
      Select payment method for payment {{ entryNumber }}
    </div>
    <div
      role="radiogroup"
      :aria-labelledby="`payment-method-label-${entry.id}`"
      class="payment-options"
    >
      <button
        v-for="option in paymentOptions"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="entry.method === option.value"
        :aria-label="option.label"
        :class="['payment-option', { active: entry.method === option.value }]"
        @click="selectPaymentMethod(option.value)"
      >
        <component :is="option.icon" class="w-5 h-5 flex-shrink-0" />
        <span class="option-label">{{ option.label }}</span>
      </button>
    </div>

    <!-- Amount Input with Fill Remaining Button -->
    <div class="amount-section">
      <label :for="`amount-${entry.id}`" class="amount-label">Amount</label>
      <div class="amount-input-row">
        <div class="amount-input-wrapper">
          <span class="amount-input-prefix">$</span>
          <input
            :id="`amount-${entry.id}`"
            ref="amountInput"
            :value="displayAmountValue"
            type="text"
            inputmode="decimal"
            placeholder="0.00"
            class="input amount-input"
            :aria-describedby="`amount-hint-${entry.id}`"
            @input="handleAmountInput"
            @blur="formatAmountOnBlur"
            @keydown="handleAmountKeydown"
          />
        </div>
        <button
          type="button"
          class="fill-remaining-btn"
          :disabled="remainingBalance <= 0"
          :aria-label="`Fill remaining balance of ${formatCurrency(remainingBalance)}`"
          @click="fillRemaining"
        >
          Fill Remaining
        </button>
      </div>
      <span :id="`amount-hint-${entry.id}`" class="sr-only">
        Enter the payment amount. Remaining balance is {{ formatCurrency(remainingBalance) }}
      </span>
    </div>

    <!-- Card Type Sub-Selector (shown when Card is selected) -->
    <Transition name="slide-fade">
      <div
        v-if="entry.method === 'CARD'"
        class="sub-section"
      >
        <span :id="`card-type-label-${entry.id}`" class="sub-section-label">Card Type</span>
        <div
          role="radiogroup"
          :aria-labelledby="`card-type-label-${entry.id}`"
          class="card-type-options"
        >
          <button
            v-for="cardOption in cardTypeOptions"
            :key="cardOption.value"
            type="button"
            role="radio"
            :aria-checked="entry.cardType === cardOption.value"
            :aria-label="cardOption.label"
            :class="[
              'card-type-option',
              { active: entry.cardType === cardOption.value },
              { error: showCardTypeError && !entry.cardType }
            ]"
            @click="selectCardType(cardOption.value)"
          >
            <span class="card-type-label">{{ cardOption.label }}</span>
          </button>
        </div>
        <!-- Validation error message -->
        <Transition name="fade">
          <div v-if="showCardTypeError && !entry.cardType" class="error-message">
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
        v-if="entry.method === 'CHECK'"
        class="sub-section"
      >
        <label :for="`check-number-${entry.id}`" class="sub-section-label">Check Number</label>
        <input
          :id="`check-number-${entry.id}`"
          ref="checkNumberInput"
          :value="entry.checkNumber || ''"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="Enter check number..."
          class="input check-number-input"
          :aria-describedby="`check-number-hint-${entry.id}`"
          @input="handleCheckNumberInput"
        />
        <span :id="`check-number-hint-${entry.id}`" class="sr-only">
          Enter the check number from your check
        </span>
      </div>
    </Transition>

    <!-- Cash Tendered / Change Calculator (shown when Cash is selected) -->
    <Transition name="slide-fade" @after-enter="focusCashInput">
      <div
        v-if="entry.method === 'CASH' && entry.amount > 0"
        class="sub-section"
        :class="cashValidationClass"
      >
        <label :for="`cash-tendered-${entry.id}`" class="sub-section-label">Cash Tendered</label>

        <!-- Cash Input -->
        <div class="cash-input-wrapper">
          <span class="cash-input-prefix">$</span>
          <input
            :id="`cash-tendered-${entry.id}`"
            ref="cashTenderedInput"
            :value="displayCashValue"
            type="text"
            inputmode="decimal"
            placeholder="0.00"
            class="input cash-tendered-input"
            :class="{ 'input-error': cashValidationState === 'insufficient', 'input-success': cashValidationState === 'exact' || cashValidationState === 'valid' }"
            :aria-invalid="cashValidationState === 'insufficient'"
            :aria-describedby="cashValidationState !== 'default' ? `cash-validation-${entry.id}` : undefined"
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
            @click="setExactCash"
          >
            Exact
          </button>
        </div>

        <!-- Change Due Display / Validation Message -->
        <Transition name="fade">
          <div
            v-if="cashValidationState !== 'default'"
            :id="`cash-validation-${entry.id}`"
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
              <span>Insufficient amount (need {{ formatCurrency(cashAmountShort) }} more)</span>
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
 * Individual payment entry component for split payments.
 *
 * Provides payment method selection, amount input with Fill Remaining button,
 * and method-specific fields (card type, check number, cash tendered).
 */
import { h } from 'vue'
import type { PaymentMethod, CardType, SplitPaymentEntry } from '~/types/operation'

interface Props {
  /** The payment entry data */
  entry: SplitPaymentEntry
  /** The payment entry number (1-indexed for display) */
  entryNumber: number
  /** Whether this entry can be removed (false if it's the only entry) */
  canRemove: boolean
  /** The remaining balance to be paid */
  remainingBalance: number
  /** Whether to show card type validation error */
  showCardTypeError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCardTypeError: false,
})

const emit = defineEmits<{
  /** Emitted when the payment entry is updated */
  'update:entry': [value: SplitPaymentEntry]
  /** Emitted when the entry should be removed */
  'remove': []
}>()

// Refs for focus management
const amountInput = ref<HTMLInputElement | null>(null)
const checkNumberInput = ref<HTMLInputElement | null>(null)
const cashTenderedInput = ref<HTMLInputElement | null>(null)
const liveRegion = ref<HTMLDivElement | null>(null)
const announcement = ref('')

// Local state for amount input display
const localAmountDisplay = ref('')
// Local state for cash input display
const localCashDisplay = ref('')

/**
 * Quick cash denomination buttons (additive).
 */
const quickCashAmounts = [1, 5, 10, 20, 50, 100]

/**
 * Computed display value for amount input.
 */
const displayAmountValue = computed(() => {
  if (localAmountDisplay.value !== '') {
    return localAmountDisplay.value
  }
  if (props.entry.amount > 0) {
    return props.entry.amount.toFixed(2)
  }
  return ''
})

/**
 * Computed display value for cash input.
 */
const displayCashValue = computed(() => {
  if (localCashDisplay.value !== '') {
    return localCashDisplay.value
  }
  if (props.entry.cashTendered !== undefined && props.entry.cashTendered > 0) {
    return props.entry.cashTendered.toFixed(2)
  }
  return ''
})

/**
 * Calculates the change due for cash payments.
 */
const changeDue = computed(() => {
  if (props.entry.cashTendered === undefined || props.entry.amount <= 0) {
    return 0
  }
  return Math.max(0, props.entry.cashTendered - props.entry.amount)
})

/**
 * Calculates how much more cash is needed when insufficient.
 */
const cashAmountShort = computed(() => {
  if (props.entry.cashTendered === undefined || props.entry.amount <= 0) {
    return 0
  }
  return Math.max(0, props.entry.amount - props.entry.cashTendered)
})

/**
 * Determines the validation state of the cash input.
 */
type CashValidationState = 'default' | 'insufficient' | 'exact' | 'valid'
const cashValidationState = computed<CashValidationState>(() => {
  if (props.entry.cashTendered === undefined || props.entry.cashTendered === 0) {
    return 'default'
  }
  if (props.entry.amount <= 0) {
    return 'default'
  }
  // Use relative epsilon for floating point comparison
  const epsilon = Math.max(0.01, props.entry.amount * 0.0001)
  if (props.entry.cashTendered < props.entry.amount - epsilon) {
    return 'insufficient'
  }
  if (Math.abs(props.entry.cashTendered - props.entry.amount) < epsilon) {
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
 * Announce a message to screen readers.
 */
function announce(message: string): void {
  announcement.value = ''
  nextTick(() => {
    announcement.value = message
  })
}

/**
 * Updates the entry and emits to parent.
 */
function updateEntry(updates: Partial<SplitPaymentEntry>): void {
  emit('update:entry', { ...props.entry, ...updates })
}

/**
 * Handle payment method selection.
 */
function selectPaymentMethod(method: PaymentMethod): void {
  const previousMethod = props.entry.method
  const updates: Partial<SplitPaymentEntry> = { method }

  // Clear method-specific fields when switching
  if (previousMethod === 'CARD' && method !== 'CARD') {
    updates.cardType = undefined
  }
  if (previousMethod === 'CHECK' && method !== 'CHECK') {
    updates.checkNumber = undefined
  }
  if (previousMethod === 'CASH' && method !== 'CASH') {
    localCashDisplay.value = ''
    updates.cashTendered = undefined
  }

  updateEntry(updates)

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

  // Focus management
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
  updateEntry({ cardType: type })
  const typeLabel = cardTypeOptions.find((o) => o.value === type)?.label || type
  announce(`${typeLabel} selected`)
}

/**
 * Handle check number input.
 */
function handleCheckNumberInput(event: Event): void {
  const target = event.target as HTMLInputElement
  updateEntry({ checkNumber: target.value })
}

/**
 * Handle amount input.
 */
function handleAmountInput(event: Event): void {
  const target = event.target as HTMLInputElement
  let value = target.value

  // Remove any characters that aren't numbers or decimal point
  value = value.replace(/[^\d.]/g, '')

  // Ensure only one decimal point
  const parts = value.split('.')
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('')
  }

  // Limit decimal places to 2
  if (parts.length === 2 && parts[1].length > 2) {
    value = parts[0] + '.' + parts[1].slice(0, 2)
  }

  localAmountDisplay.value = value

  // Parse and emit the numeric value
  const numericValue = parseFloat(value)
  if (!isNaN(numericValue) && numericValue >= 0) {
    updateEntry({ amount: numericValue })
  } else if (value === '' || value === '.') {
    updateEntry({ amount: 0 })
  }
}

/**
 * Formats the amount input on blur.
 */
function formatAmountOnBlur(): void {
  if (props.entry.amount > 0) {
    localAmountDisplay.value = ''
  } else {
    localAmountDisplay.value = ''
  }
}

/**
 * Handles keydown events on amount input.
 */
function handleAmountKeydown(event: KeyboardEvent): void {
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
  if (event.ctrlKey && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
    return
  }
  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

/**
 * Fill the remaining balance.
 */
function fillRemaining(): void {
  if (props.remainingBalance > 0) {
    localAmountDisplay.value = ''
    updateEntry({ amount: props.remainingBalance })
    announce(`Amount set to remaining balance: ${formatCurrency(props.remainingBalance)}`)
  }
}

/**
 * Handle cash input.
 */
function handleCashInput(event: Event): void {
  const target = event.target as HTMLInputElement
  let value = target.value

  value = value.replace(/[^\d.]/g, '')
  const parts = value.split('.')
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('')
  }
  if (parts.length === 2 && parts[1].length > 2) {
    value = parts[0] + '.' + parts[1].slice(0, 2)
  }

  localCashDisplay.value = value

  const numericValue = parseFloat(value)
  if (!isNaN(numericValue) && numericValue >= 0) {
    updateEntry({ cashTendered: numericValue })
  } else if (value === '' || value === '.') {
    updateEntry({ cashTendered: undefined })
  }
}

/**
 * Formats the cash input on blur.
 */
function formatCashOnBlur(): void {
  if (props.entry.cashTendered !== undefined && props.entry.cashTendered > 0) {
    localCashDisplay.value = ''
  } else {
    localCashDisplay.value = ''
  }
}

/**
 * Handles keydown events on cash input.
 */
function handleCashKeydown(event: KeyboardEvent): void {
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
  if (event.ctrlKey && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase())) {
    return
  }
  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
  }
}

/**
 * Adds a quick cash amount to the current tendered amount.
 */
function addQuickCash(amount: number): void {
  const currentAmount = props.entry.cashTendered ?? 0
  const newAmount = currentAmount + amount
  localCashDisplay.value = ''
  updateEntry({ cashTendered: newAmount })
  announce(`Added ${amount} dollars. Total tendered: ${formatCurrency(newAmount)}`)
}

/**
 * Sets the cash tendered to the exact payment amount.
 */
function setExactCash(): void {
  if (props.entry.amount > 0) {
    localCashDisplay.value = ''
    updateEntry({ cashTendered: props.entry.amount })
    announce(`Exact amount set: ${formatCurrency(props.entry.amount)}`)
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

/**
 * Handle remove button click.
 */
function handleRemove(): void {
  emit('remove')
  announce(`Payment ${props.entryNumber} removed`)
}

/**
 * Expose focus method for parent component.
 */
function focusAmount(): void {
  nextTick(() => {
    if (amountInput.value) {
      amountInput.value.focus()
    }
  })
}

defineExpose({
  focusAmount,
})

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
</script>

<style scoped>
.payment-entry {
  @apply p-4 rounded-xl;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.entry-header {
  @apply flex items-center justify-between mb-3;
}

.entry-number {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-600));
}

.remove-btn {
  @apply p-2 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center;
  color: rgb(var(--color-surface-400));
  background: transparent;
}

.remove-btn:hover {
  color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.1);
}

.remove-btn:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

/* Payment Options */
.payment-options {
  @apply grid grid-cols-2 gap-2 mb-4;
}

/* Medium desktop: 2x2 grid layout with wrapping */
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

/* Amount Section */
.amount-section {
  @apply mb-3;
}

.amount-label {
  @apply block text-sm font-medium mb-2;
  color: rgb(var(--color-surface-600));
}

.amount-input-row {
  @apply flex gap-2;
}

.amount-input-wrapper {
  @apply relative flex-1;
}

.amount-input-prefix {
  @apply absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold pointer-events-none;
  color: rgb(var(--color-surface-500));
}

.amount-input {
  @apply w-full text-right text-lg font-semibold;
  padding-left: 2rem;
}

.fill-remaining-btn {
  @apply px-4 py-2 rounded-xl font-semibold text-sm transition-all min-h-[44px] whitespace-nowrap;
  background: rgba(var(--color-primary-500), 0.08);
  border: 2px solid rgba(var(--color-primary-500), 0.3);
  color: rgb(var(--color-primary-600));
}

.fill-remaining-btn:hover:not(:disabled) {
  background: rgba(var(--color-primary-500), 0.15);
  border-color: rgba(var(--color-primary-500), 0.5);
}

.fill-remaining-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.fill-remaining-btn:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

/* Sub-section container */
.sub-section {
  @apply mt-3 p-3 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
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
