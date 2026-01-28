/**
 * Composable for return-related calculations.
 * Provides shared calculation logic used across return components.
 */
export const useReturnCalculations = () => {
  /**
   * Calculates refund amount for a returned item based on original pricing and discount.
   * Handles both percentage and fixed discount types.
   * Includes defensive checks to prevent NaN results from undefined or invalid values.
   *
   * @param quantity - Number of items being returned
   * @param pricePerItem - Original price per item
   * @param discount - Discount amount (percentage 0-100 or fixed amount)
   * @param discountType - Type of discount ('percent' or 'fixed')
   * @param originalQty - Original quantity sold (used to calculate per-unit fixed discount)
   * @returns Refund amount for the given quantity (always a valid number, defaults to 0)
   */
  const calculateItemRefund = (
    quantity: number,
    pricePerItem: number,
    discount: number | undefined,
    discountType: 'percent' | 'fixed' | undefined,
    originalQty: number
  ): number => {
    // Defensive checks: ensure all numeric inputs are valid, default to 0 if not
    const safeQuantity = Number.isFinite(quantity) ? quantity : 0
    const safePrice = Number.isFinite(pricePerItem) ? pricePerItem : 0
    const safeDiscount: number = (discount !== undefined && Number.isFinite(discount)) ? discount : 0
    const safeOriginalQty = Number.isFinite(originalQty) && originalQty > 0 ? originalQty : 1

    const grossTotal = safePrice * safeQuantity
    if (safeDiscount <= 0) return grossTotal

    if (discountType === 'percent') {
      return grossTotal * (1 - safeDiscount / 100)
    } else {
      // Fixed discount distributed proportionally per unit
      const discountPerUnit = safeDiscount / safeOriginalQty
      return grossTotal - (discountPerUnit * safeQuantity)
    }
  }

  return { calculateItemRefund }
}
