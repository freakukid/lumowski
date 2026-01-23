import type { Ref } from 'vue'
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

/**
 * Composable for extracting display values from dynamic inventory items.
 * Provides consistent logic for getting item names and quantities based on column definitions.
 *
 * @param columns - Reactive reference to column definitions
 * @returns Object containing getItemName and getItemQuantity functions
 */
export const useItemDisplay = (columns: Ref<ColumnDefinition[]>) => {
  /**
   * Gets the display name for an inventory item.
   * First checks for a column with the 'name' role, then falls back to the first text column.
   *
   * @param item - The inventory item to extract the name from
   * @returns The item's display name, or 'Untitled' if no suitable value is found
   */
  const getItemName = (item: DynamicInventoryItem): string => {
    const nameColumn = columns.value.find((c) => c.role === 'name')
    if (nameColumn) {
      const value = item.data[nameColumn.id]
      return value != null ? String(value) : 'Untitled'
    }
    const firstTextColumn = columns.value.find((c) => c.type === 'text')
    if (firstTextColumn) {
      const value = item.data[firstTextColumn.id]
      return value != null ? String(value) : 'Untitled'
    }
    return 'Untitled'
  }

  /**
   * Gets the current quantity for an inventory item.
   * Looks for a column with the 'quantity' role.
   *
   * @param item - The inventory item to extract the quantity from
   * @returns The item's quantity, or 0 if no quantity column exists or value is invalid
   */
  const getItemQuantity = (item: DynamicInventoryItem): number => {
    const quantityColumn = columns.value.find((c) => c.role === 'quantity')
    return quantityColumn ? Number(item.data[quantityColumn.id]) || 0 : 0
  }

  /**
   * Gets the current cost for an inventory item.
   * Looks for a column with the 'cost' role.
   *
   * @param item - The inventory item to extract the cost from
   * @returns The item's cost, or 0 if no cost column exists or value is invalid
   */
  const getItemCost = (item: DynamicInventoryItem): number => {
    const costColumn = columns.value.find((c) => c.role === 'cost')
    return costColumn ? Number(item.data[costColumn.id]) || 0 : 0
  }

  return { getItemName, getItemQuantity, getItemCost }
}
