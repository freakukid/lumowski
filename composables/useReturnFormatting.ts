import type { ReturnItemCondition } from '~/types/operation'

/**
 * Composable for formatting return-specific display strings.
 */
export const useReturnFormatting = () => {
  // Import formatRefundMethod from the consolidated location
  const { formatRefundMethod } = usePaymentFormatting()

  /**
   * Formats an item condition for display.
   */
  const formatCondition = (condition: ReturnItemCondition | string): string => {
    switch (condition) {
      case 'resellable': return 'Resellable'
      case 'damaged': return 'Damaged'
      case 'defective': return 'Defective'
      default: return condition
    }
  }

  /**
   * Formats a discount value for display.
   * @param discount - The discount amount
   * @param discountType - The type of discount ('percent' or 'fixed')
   * @param formatCurrency - Optional currency formatter function for fixed discounts
   * @returns Formatted discount string (e.g., "10%" or "$5.00")
   */
  const formatDiscount = (
    discount: number,
    discountType?: 'percent' | 'fixed',
    formatCurrency?: (amount: number) => string
  ): string => {
    if (discountType === 'percent') {
      return `${discount}%`
    }
    // For fixed discounts, use the provided formatter or fall back to basic format
    if (formatCurrency) {
      return formatCurrency(discount)
    }
    return `$${discount.toFixed(2)}`
  }

  return { formatRefundMethod, formatCondition, formatDiscount }
}
