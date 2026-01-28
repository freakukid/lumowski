import { h, type FunctionalComponent } from 'vue'
import type { PaymentMethod } from '~/types/operation'

/**
 * Cash payment icon (bills/money).
 */
export const CashIcon: FunctionalComponent = () => {
  return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
    h('path', {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2',
      d: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    }),
  ])
}
CashIcon.displayName = 'CashIcon'

/**
 * Card payment icon (credit/debit card).
 */
export const CardIcon: FunctionalComponent = () => {
  return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
    h('path', {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2',
      d: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    }),
  ])
}
CardIcon.displayName = 'CardIcon'

/**
 * Check payment icon (document).
 */
export const CheckIcon: FunctionalComponent = () => {
  return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
    h('path', {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2',
      d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    }),
  ])
}
CheckIcon.displayName = 'CheckIcon'

/**
 * Other payment icon (transfer arrows).
 */
export const OtherPaymentIcon: FunctionalComponent = () => {
  return h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
    h('path', {
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '2',
      d: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    }),
  ])
}
OtherPaymentIcon.displayName = 'OtherPaymentIcon'

/**
 * Map of payment methods to their icon components.
 */
export const PAYMENT_ICONS: Record<PaymentMethod | 'OTHER', FunctionalComponent> = {
  CASH: CashIcon,
  CARD: CardIcon,
  CHECK: CheckIcon,
  OTHER: OtherPaymentIcon,
}

/**
 * Returns the appropriate icon component for a payment method.
 *
 * @param method - The payment method (CASH, CARD, CHECK, OTHER)
 * @returns The corresponding icon component
 */
export function getPaymentIcon(method: PaymentMethod | null): FunctionalComponent {
  return PAYMENT_ICONS[method || 'OTHER']
}
