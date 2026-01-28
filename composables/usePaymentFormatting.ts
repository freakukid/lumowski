import type { PaymentMethod, CardType, RefundMethod } from '~/types/operation'

/**
 * Card type options for payment/refund forms.
 */
export const CARD_TYPES = [
  { value: 'VISA' as CardType, label: 'Visa' },
  { value: 'MASTERCARD' as CardType, label: 'Mastercard' },
  { value: 'AMEX' as CardType, label: 'American Express' },
  { value: 'DISCOVER' as CardType, label: 'Discover' },
] as const

/**
 * Composable for formatting payment method display strings.
 */
export const usePaymentFormatting = () => {
  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    CHECK: 'Check',
    OTHER: 'Other',
  }

  /**
   * Formats a payment method for display.
   * @param method - Payment method enum value
   * @param cardType - Optional card type for CARD payments
   * @returns Human-readable payment method string
   */
  const formatPaymentMethod = (
    method: PaymentMethod | string | null,
    cardType?: CardType | string | null
  ): string => {
    if (!method) return ''
    const label = PAYMENT_METHOD_LABELS[method] || method
    if (method === 'CARD' && cardType) {
      return `${label} (${cardType})`
    }
    return label
  }

  /**
   * Formats a refund method for display.
   * Handles RefundMethod values including 'ORIGINAL_METHOD'.
   * @param method - Refund method enum value
   * @param cardType - Optional card type for CARD refunds
   * @returns Human-readable refund method string
   */
  const formatRefundMethod = (
    method: RefundMethod | string | null,
    cardType?: CardType | string | null
  ): string => {
    if (!method) return 'N/A'
    switch (method) {
      case 'CASH': return 'Cash'
      case 'CARD': return cardType ? `Card (${cardType})` : 'Card'
      case 'ORIGINAL_METHOD': return 'Original Payment Method'
      default: return method
    }
  }

  return { formatPaymentMethod, formatRefundMethod, PAYMENT_METHOD_LABELS }
}
