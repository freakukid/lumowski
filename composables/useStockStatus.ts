import { computed, type Ref, type ComputedRef } from 'vue'
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

/**
 * Determines if an inventory item is low on stock.
 *
 * Compares the quantity value against the minimum quantity threshold.
 * Uses the fallback threshold when:
 * - minQuantityColumn is not provided, OR
 * - the item's minQuantity value is empty/undefined/null, OR
 * - the item's minQuantity value is not a valid number
 *
 * Returns false if quantityColumn is not provided.
 *
 * @param item - The inventory item to check
 * @param quantityColumn - Column definition for quantity (role: 'quantity')
 * @param minQuantityColumn - Column definition for minimum quantity (role: 'minQuantity')
 * @param fallbackThreshold - Threshold to use when minQuantity is not set (default: 3)
 * @returns true if quantity is at or below threshold, false otherwise
 *
 * @example
 * ```typescript
 * const quantityCol = columns.find(c => c.role === 'quantity')
 * const minQuantityCol = columns.find(c => c.role === 'minQuantity')
 * const lowStock = isLowStock(item, quantityCol, minQuantityCol)
 *
 * // With custom fallback threshold when minQuantity is undefined or empty
 * const lowStock = isLowStock(item, quantityCol, minQuantityCol, 5)
 * ```
 */
export function isLowStock(
  item: DynamicInventoryItem,
  quantityColumn: ColumnDefinition | undefined,
  minQuantityColumn: ColumnDefinition | undefined,
  fallbackThreshold: number = 3
): boolean {
  if (!quantityColumn) return false

  const qty = Number(item.data[quantityColumn.id]) || 0

  // Use minQuantity if the column exists AND has a valid numeric value, otherwise use fallback
  const minQtyValue = minQuantityColumn ? item.data[minQuantityColumn.id] : undefined
  const hasMinQuantityValue = minQtyValue !== undefined && minQtyValue !== null && minQtyValue !== ''
  const numericMinQty = hasMinQuantityValue ? Number(minQtyValue) : NaN
  const threshold = Number.isNaN(numericMinQty) ? fallbackThreshold : numericMinQty

  return qty <= threshold
}

/**
 * Options for the useStockStatus composable.
 */
export interface UseStockStatusOptions {
  /**
   * Fallback threshold to use when minQuantity column is not defined.
   * Defaults to 3.
   */
  fallbackThreshold?: number
}

/**
 * Composable for stock status checking with column resolution.
 *
 * Provides a reactive isLowStock function that automatically resolves
 * quantity and minQuantity columns from the provided columns array.
 *
 * @param columns - Ref or computed of column definitions
 * @param options - Optional configuration including fallbackThreshold
 * @returns Object with checkLowStock function and resolved column refs
 *
 * @example
 * ```typescript
 * const { checkLowStock, quantityColumn, minQuantityColumn } = useStockStatus(
 *   computed(() => props.columns)
 * )
 *
 * // With custom fallback threshold
 * const { checkLowStock } = useStockStatus(
 *   computed(() => props.columns),
 *   { fallbackThreshold: 5 }
 * )
 *
 * // In template or computed
 * const isLow = checkLowStock(item)
 * ```
 */
export function useStockStatus(
  columns: Ref<ColumnDefinition[]> | ComputedRef<ColumnDefinition[]>,
  options: UseStockStatusOptions = {}
) {
  const { fallbackThreshold = 3 } = options

  const quantityColumn = computed(() => columns.value.find((c) => c.role === 'quantity'))
  const minQuantityColumn = computed(() => columns.value.find((c) => c.role === 'minQuantity'))

  /**
   * Checks if an item is low on stock using the resolved columns.
   *
   * @param item - The inventory item to check
   * @returns true if quantity is at or below threshold
   */
  function checkLowStock(item: DynamicInventoryItem): boolean {
    return isLowStock(item, quantityColumn.value, minQuantityColumn.value, fallbackThreshold)
  }

  return {
    checkLowStock,
    quantityColumn,
    minQuantityColumn,
  }
}
