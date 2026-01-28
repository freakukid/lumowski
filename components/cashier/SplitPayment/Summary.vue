<template>
  <div class="payment-summary">
    <!-- Screen reader live region for balance updates -->
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ balanceAnnouncement }}
    </div>

    <!-- Remaining Balance Display -->
    <div :class="['remaining-balance', balanceState]">
      <div class="balance-header">
        <span class="balance-label">Remaining Balance</span>
        <span :class="['balance-amount', balanceState]">
          {{ formatCurrency(remainingBalance) }}
        </span>
      </div>
      <div class="balance-indicator">
        <template v-if="balanceState === 'unpaid'">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="balance-status">Enter payment amounts</span>
        </template>
        <template v-else-if="balanceState === 'partial'">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span class="balance-status">{{ formatCurrency(remainingBalance) }} remaining</span>
        </template>
        <template v-else-if="balanceState === 'paid'">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="balance-status">Fully paid</span>
        </template>
        <template v-else-if="balanceState === 'overpaid'">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="balance-status">Overpaid by {{ formatCurrency(Math.abs(remainingBalance)) }}</span>
        </template>
      </div>
    </div>

    <!-- Payments Breakdown -->
    <div v-if="payments.length > 0" class="payments-breakdown">
      <div class="breakdown-header">
        <span class="breakdown-title">Payment Breakdown</span>
      </div>
      <ul class="payments-list">
        <li
          v-for="(payment, index) in payments"
          :key="payment.id"
          class="payment-item"
        >
          <div class="payment-method">
            <component :is="getPaymentIcon(payment.method)" class="w-4 h-4" />
            <span class="method-label">
              {{ getMethodLabel(payment.method) }}
              <template v-if="payment.method === 'CARD' && payment.cardType">
                ({{ getCardLabel(payment.cardType) }})
              </template>
              <template v-if="payment.method === 'CHECK' && payment.checkNumber">
                #{{ payment.checkNumber }}
              </template>
            </span>
          </div>
          <span class="payment-amount">{{ formatCurrency(payment.amount) }}</span>
        </li>
      </ul>
      <div class="total-paid-row">
        <span class="total-label">Total Paid</span>
        <span class="total-amount">{{ formatCurrency(totalPaid) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Payment summary component showing breakdown of all payments
 * and the remaining balance with visual status indicators.
 */
import { h } from 'vue'
import type { SplitPaymentEntry, PaymentMethod, CardType } from '~/types/operation'

interface Props {
  /** Array of payment entries */
  payments: SplitPaymentEntry[]
  /** The grand total to be paid */
  grandTotal: number
}

const props = defineProps<Props>()

/**
 * Calculate total paid from all payments.
 */
const totalPaid = computed(() => {
  return props.payments.reduce((sum, payment) => sum + payment.amount, 0)
})

/**
 * Calculate remaining balance.
 */
const remainingBalance = computed(() => {
  return props.grandTotal - totalPaid.value
})

/**
 * Determine the balance state for styling.
 */
type BalanceState = 'unpaid' | 'partial' | 'paid' | 'overpaid'
const balanceState = computed<BalanceState>(() => {
  // Use relative epsilon for floating point comparison
  const epsilon = Math.max(0.01, props.grandTotal * 0.0001)

  if (totalPaid.value <= 0) {
    return 'unpaid'
  }
  if (remainingBalance.value > epsilon) {
    return 'partial'
  }
  if (Math.abs(remainingBalance.value) <= epsilon) {
    return 'paid'
  }
  return 'overpaid'
})

/**
 * Screen reader announcement for balance changes.
 */
const balanceAnnouncement = computed(() => {
  switch (balanceState.value) {
    case 'unpaid':
      return `Total due: ${formatCurrency(props.grandTotal)}`
    case 'partial':
      return `Remaining balance: ${formatCurrency(remainingBalance.value)}`
    case 'paid':
      return 'Payment complete. Ready to submit.'
    case 'overpaid':
      return `Warning: Overpaid by ${formatCurrency(Math.abs(remainingBalance.value))}`
    default:
      return ''
  }
})

/**
 * Formats a number as USD currency.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

/**
 * Get the display label for a payment method.
 */
function getMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    CHECK: 'Check',
    OTHER: 'Other',
  }
  return labels[method] || method
}

/**
 * Get the display label for a card type.
 */
function getCardLabel(cardType: CardType): string {
  const labels: Record<CardType, string> = {
    VISA: 'Visa',
    MASTERCARD: 'Mastercard',
    AMEX: 'Amex',
    DISCOVER: 'Discover',
  }
  return labels[cardType] || cardType
}

// Icon components using render function (Vue runtime doesn't include template compiler)
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
 * Get the icon component for a payment method.
 */
function getPaymentIcon(method: PaymentMethod) {
  const icons: Record<PaymentMethod, unknown> = {
    CASH: CashIcon,
    CARD: CardIcon,
    CHECK: CheckIcon,
    OTHER: OtherIcon,
  }
  return icons[method] || OtherIcon
}
</script>

<style scoped>
.payment-summary {
  @apply space-y-4;
}

/* Remaining Balance Display */
.remaining-balance {
  @apply p-4 rounded-xl;
  border: 2px solid;
}

.remaining-balance.unpaid {
  background: rgba(var(--color-surface-100), 0.5);
  border-color: rgba(var(--color-surface-300), 0.5);
}

.remaining-balance.partial {
  background: rgba(var(--color-warning-500), 0.08);
  border-color: rgba(var(--color-warning-500), 0.4);
}

.remaining-balance.paid {
  background: rgba(var(--color-success-500), 0.08);
  border-color: rgba(var(--color-success-500), 0.4);
}

.remaining-balance.overpaid {
  background: rgba(var(--color-error-500), 0.08);
  border-color: rgba(var(--color-error-500), 0.4);
}

.balance-header {
  @apply flex items-center justify-between mb-2;
}

.balance-label {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-600));
}

.balance-amount {
  @apply text-2xl font-bold;
}

.balance-amount.unpaid {
  color: rgb(var(--color-surface-700));
}

.balance-amount.partial {
  color: rgb(var(--color-warning-600));
}

.balance-amount.paid {
  color: rgb(var(--color-success-600));
}

.balance-amount.overpaid {
  color: rgb(var(--color-error-600));
}

.balance-indicator {
  @apply flex items-center gap-2 text-sm;
}

.remaining-balance.unpaid .balance-indicator {
  color: rgb(var(--color-surface-500));
}

.remaining-balance.partial .balance-indicator {
  color: rgb(var(--color-warning-600));
}

.remaining-balance.paid .balance-indicator {
  color: rgb(var(--color-success-600));
}

.remaining-balance.overpaid .balance-indicator {
  color: rgb(var(--color-error-600));
}

.balance-status {
  @apply font-medium;
}

/* Payments Breakdown */
.payments-breakdown {
  @apply rounded-xl overflow-hidden;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.breakdown-header {
  @apply px-4 py-3;
  background: rgba(var(--color-surface-100), 0.5);
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.6);
}

.breakdown-title {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-600));
}

.payments-list {
  @apply divide-y;
  divide-color: rgba(var(--color-surface-200), 0.5);
}

.payment-item {
  @apply flex items-center justify-between px-4 py-3;
}

.payment-method {
  @apply flex items-center gap-2;
  color: rgb(var(--color-surface-600));
}

.method-label {
  @apply text-sm font-medium;
}

.payment-amount {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.total-paid-row {
  @apply flex items-center justify-between px-4 py-3;
  background: rgba(var(--color-surface-100), 0.5);
  border-top: 1px solid rgba(var(--color-surface-200), 0.6);
}

.total-label {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.total-amount {
  @apply text-lg font-bold;
  color: rgb(var(--color-primary-600));
}

/* Screen reader only */
.sr-only {
  @apply absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0;
  clip: rect(0, 0, 0, 0);
}
</style>
