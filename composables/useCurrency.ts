/**
 * Composable for currency formatting utilities.
 */
export function useCurrency() {
  /**
   * Formats a number as USD currency.
   *
   * @param value - The numeric value to format
   * @returns Formatted currency string (e.g., "$1,234.56")
   */
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value)
  }

  return { formatCurrency }
}
