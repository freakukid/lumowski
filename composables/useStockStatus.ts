import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

/**
 * Determines if an inventory item is low on stock.
 *
 * Compares the quantity value against the minimum quantity threshold.
 * Returns false if either column is not provided or values are not valid numbers.
 *
 * @param item - The inventory item to check
 * @param quantityColumn - Column definition for quantity (role: 'quantity')
 * @param minQuantityColumn - Column definition for minimum quantity (role: 'minQuantity')
 * @returns true if quantity is at or below minimum, false otherwise
 *
 * @example
 * ```typescript
 * const quantityCol = columns.find(c => c.role === 'quantity')
 * const minQuantityCol = columns.find(c => c.role === 'minQuantity')
 * const lowStock = isLowStock(item, quantityCol, minQuantityCol)
 * ```
 */
export function isLowStock(
  item: DynamicInventoryItem,
  quantityColumn: ColumnDefinition | undefined,
  minQuantityColumn: ColumnDefinition | undefined
): boolean {
  if (!quantityColumn || !minQuantityColumn) return false

  const qty = Number(item.data[quantityColumn.id]) || 0
  const min = Number(item.data[minQuantityColumn.id]) || 0

  return qty <= min
}

/**
 * Composable for stock status checking with column resolution.
 *
 * Provides a reactive isLowStock function that automatically resolves
 * quantity and minQuantity columns from the provided columns array.
 *
 * @param columns - Ref or computed of column definitions
 * @returns Object with checkLowStock function and resolved column refs
 *
 * @example
 * ```typescript
 * const { checkLowStock, quantityColumn, minQuantityColumn } = useStockStatus(
 *   computed(() => props.columns)
 * )
 *
 * // In template or computed
 * const isLow = checkLowStock(item)
 * ```
 */
export function useStockStatus(columns: Ref<ColumnDefinition[]> | ComputedRef<ColumnDefinition[]>) {
  const quantityColumn = computed(() => columns.value.find((c) => c.role === 'quantity'))
  const minQuantityColumn = computed(() => columns.value.find((c) => c.role === 'minQuantity'))

  /**
   * Checks if an item is low on stock using the resolved columns.
   *
   * @param item - The inventory item to check
   * @returns true if quantity is at or below minimum threshold
   */
  function checkLowStock(item: DynamicInventoryItem): boolean {
    return isLowStock(item, quantityColumn.value, minQuantityColumn.value)
  }

  return {
    checkLowStock,
    quantityColumn,
    minQuantityColumn,
  }
}
