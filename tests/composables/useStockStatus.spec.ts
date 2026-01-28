import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

/**
 * Tests for useStockStatus composable
 *
 * The composable provides:
 * - isLowStock: Standalone function to check if item is low on stock
 * - useStockStatus: Composable with checkLowStock, quantityColumn, minQuantityColumn
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Import after mocks are set up
import { isLowStock, useStockStatus } from '~/composables/useStockStatus'

// ============================================================================
// Test Utilities
// ============================================================================

function createColumn(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id: 'col-1',
    name: 'Column 1',
    type: 'number',
    order: 0,
    ...overrides,
  }
}

function createItem(data: Record<string, unknown>, id = 'item-1'): DynamicInventoryItem {
  return {
    id,
    data,
    businessId: 'biz-1',
    createdById: 'user-1',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  }
}

function createColumnsRef(columns: ColumnDefinition[]): Ref<ColumnDefinition[]> {
  return ref(columns)
}

// ============================================================================
// Tests: isLowStock (standalone function)
// ============================================================================

describe('isLowStock', () => {
  describe('basic functionality', () => {
    it('should return true when quantity equals minQuantity', () => {
      const item = createItem({ qty: 10, minQty: 10 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should return true when quantity is below minQuantity', () => {
      const item = createItem({ qty: 5, minQty: 10 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should return false when quantity is above minQuantity', () => {
      const item = createItem({ qty: 15, minQty: 10 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(false)
    })

    it('should return true when quantity is 0 and minQuantity is 0', () => {
      const item = createItem({ qty: 0, minQty: 0 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })
  })

  describe('missing columns', () => {
    it('should return false when quantityColumn is undefined', () => {
      const item = createItem({ qty: 5, minQty: 10 })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, undefined, minCol)).toBe(false)
    })

    it('should return false when both columns are undefined', () => {
      const item = createItem({ qty: 5, minQty: 10 })

      expect(isLowStock(item, undefined, undefined)).toBe(false)
    })
  })

  describe('fallback threshold', () => {
    it('should use fallback threshold (default 3) when minQuantityColumn is undefined', () => {
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })

      // quantity 2 <= fallback 3, so low stock
      expect(isLowStock(createItem({ qty: 2 }), qtyCol, undefined)).toBe(true)
      // quantity 3 <= fallback 3, so low stock
      expect(isLowStock(createItem({ qty: 3 }), qtyCol, undefined)).toBe(true)
      // quantity 4 > fallback 3, so not low stock
      expect(isLowStock(createItem({ qty: 4 }), qtyCol, undefined)).toBe(false)
    })

    it('should use custom fallback threshold when provided', () => {
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })

      // Custom fallback of 5
      expect(isLowStock(createItem({ qty: 4 }), qtyCol, undefined, 5)).toBe(true)
      expect(isLowStock(createItem({ qty: 5 }), qtyCol, undefined, 5)).toBe(true)
      expect(isLowStock(createItem({ qty: 6 }), qtyCol, undefined, 5)).toBe(false)
    })

    it('should use minQuantityColumn value when defined (ignoring fallback)', () => {
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      // minQuantity is 10, so fallback of 3 should be ignored
      const item = createItem({ qty: 5, minQty: 10 })
      expect(isLowStock(item, qtyCol, minCol, 3)).toBe(true)

      // quantity 8 is above fallback 3 but below minQty 10
      const item2 = createItem({ qty: 8, minQty: 10 })
      expect(isLowStock(item2, qtyCol, minCol, 3)).toBe(true)
    })

    it('should handle zero fallback threshold', () => {
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })

      expect(isLowStock(createItem({ qty: 0 }), qtyCol, undefined, 0)).toBe(true)
      expect(isLowStock(createItem({ qty: 1 }), qtyCol, undefined, 0)).toBe(false)
    })
  })

  describe('invalid or missing values', () => {
    it('should treat null quantity as 0', () => {
      const item = createItem({ qty: null, minQty: 10 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should treat undefined quantity as 0', () => {
      const item = createItem({ minQty: 10 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should use fallback threshold when minQuantity is null', () => {
      const item = createItem({ qty: 5, minQty: null })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      // qty 5 > fallback 3, so not low stock
      expect(isLowStock(item, qtyCol, minCol)).toBe(false)

      // qty 3 <= fallback 3, so low stock
      const lowItem = createItem({ qty: 3, minQty: null })
      expect(isLowStock(lowItem, qtyCol, minCol)).toBe(true)
    })

    it('should use fallback threshold when minQuantity is undefined', () => {
      const item = createItem({ qty: 5 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      // qty 5 > fallback 3, so not low stock
      expect(isLowStock(item, qtyCol, minCol)).toBe(false)

      // qty 2 <= fallback 3, so low stock
      const lowItem = createItem({ qty: 2 })
      expect(isLowStock(lowItem, qtyCol, minCol)).toBe(true)
    })

    it('should treat non-numeric quantity as 0', () => {
      const item = createItem({ qty: 'not a number', minQty: 10 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should use fallback threshold when minQuantity is non-numeric', () => {
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      // 'invalid' is not a valid number, so fallback threshold (3) is used
      const item = createItem({ qty: 5, minQty: 'invalid' })
      expect(isLowStock(item, qtyCol, minCol)).toBe(false) // 5 > fallback 3

      const lowItem = createItem({ qty: 2, minQty: 'invalid' })
      expect(isLowStock(lowItem, qtyCol, minCol)).toBe(true) // 2 <= fallback 3
    })

    it('should handle both values as non-numeric', () => {
      const item = createItem({ qty: 'invalid', minQty: 'also invalid' })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      // qty becomes 0, minQty invalid uses fallback 3, so 0 <= 3 = low stock
      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })
  })

  describe('string number conversion', () => {
    it('should convert string numbers correctly', () => {
      const item = createItem({ qty: '5', minQty: '10' })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should handle decimal string numbers', () => {
      const item = createItem({ qty: '10.5', minQty: '10' })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle negative quantities', () => {
      const item = createItem({ qty: -5, minQty: 0 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should handle negative minQuantity', () => {
      const item = createItem({ qty: 0, minQty: -5 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      // qty 0 > minQty -5, so not low stock
      expect(isLowStock(item, qtyCol, minCol)).toBe(false)
    })

    it('should handle very large numbers', () => {
      const item = createItem({ qty: 999999999, minQty: 1000000000 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should handle decimal quantities', () => {
      const item = createItem({ qty: 10.4, minQty: 10.5 })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })

    it('should handle empty string values', () => {
      const item = createItem({ qty: '', minQty: '' })
      const qtyCol = createColumn({ id: 'qty', role: 'quantity' })
      const minCol = createColumn({ id: 'minQty', role: 'minQuantity' })

      // qty becomes 0, minQty empty string uses fallback 3, so 0 <= 3 = low stock
      expect(isLowStock(item, qtyCol, minCol)).toBe(true)
    })
  })
})

// ============================================================================
// Tests: useStockStatus (composable)
// ============================================================================

describe('useStockStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should return composable with all expected properties', () => {
      const columns = createColumnsRef([])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus).toHaveProperty('checkLowStock')
      expect(stockStatus).toHaveProperty('quantityColumn')
      expect(stockStatus).toHaveProperty('minQuantityColumn')
      expect(typeof stockStatus.checkLowStock).toBe('function')
    })

    it('should work with Ref<ColumnDefinition[]>', () => {
      const columns: Ref<ColumnDefinition[]> = ref([
        createColumn({ id: 'qty', role: 'quantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.quantityColumn.value).toBeDefined()
    })

    it('should work with ComputedRef<ColumnDefinition[]>', () => {
      const baseColumns = ref([createColumn({ id: 'qty', role: 'quantity' })])
      const columns: ComputedRef<ColumnDefinition[]> = computed(() => baseColumns.value)
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.quantityColumn.value).toBeDefined()
    })
  })

  describe('quantityColumn computed', () => {
    it('should find column with quantity role', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'price', role: 'price', type: 'currency' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.quantityColumn.value?.id).toBe('qty')
      expect(stockStatus.quantityColumn.value?.role).toBe('quantity')
    })

    it('should return undefined when no quantity column exists', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'price', role: 'price', type: 'currency' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.quantityColumn.value).toBeUndefined()
    })

    it('should be reactive to column changes', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.quantityColumn.value).toBeUndefined()

      // Add quantity column
      columns.value = [
        ...columns.value,
        createColumn({ id: 'qty', role: 'quantity' }),
      ]

      expect(stockStatus.quantityColumn.value?.id).toBe('qty')
    })
  })

  describe('minQuantityColumn computed', () => {
    it('should find column with minQuantity role', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.minQuantityColumn.value?.id).toBe('minQty')
      expect(stockStatus.minQuantityColumn.value?.role).toBe('minQuantity')
    })

    it('should return undefined when no minQuantity column exists', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.minQuantityColumn.value).toBeUndefined()
    })

    it('should be reactive to column changes', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.minQuantityColumn.value).toBeUndefined()

      // Add minQuantity column
      columns.value = [
        ...columns.value,
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ]

      expect(stockStatus.minQuantityColumn.value?.id).toBe('minQty')
    })
  })

  describe('checkLowStock', () => {
    it('should return true when item is low on stock', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ qty: 5, minQty: 10 })

      expect(stockStatus.checkLowStock(item)).toBe(true)
    })

    it('should return false when item is not low on stock', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ qty: 15, minQty: 10 })

      expect(stockStatus.checkLowStock(item)).toBe(false)
    })

    it('should return false when quantity column is missing', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ qty: 5, minQty: 10 })

      expect(stockStatus.checkLowStock(item)).toBe(false)
    })

    it('should use fallback threshold when minQuantity column is missing', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      // Default fallback is 3
      expect(stockStatus.checkLowStock(createItem({ qty: 2 }))).toBe(true)
      expect(stockStatus.checkLowStock(createItem({ qty: 3 }))).toBe(true)
      expect(stockStatus.checkLowStock(createItem({ qty: 4 }))).toBe(false)
    })

    it('should return false when both columns are missing', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
      ])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ qty: 5, minQty: 10 })

      expect(stockStatus.checkLowStock(item)).toBe(false)
    })

    it('should be reactive to column changes', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
      ])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ qty: 5, minQty: 10 })

      // Initially false because columns don't have quantity/minQuantity
      expect(stockStatus.checkLowStock(item)).toBe(false)

      // Add the required columns
      columns.value = [
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ]

      // Now should return true
      expect(stockStatus.checkLowStock(item)).toBe(true)
    })
  })

  describe('multiple items', () => {
    it('should correctly identify low stock items in a list', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const items = [
        createItem({ qty: 5, minQty: 10 }, '1'),   // Low
        createItem({ qty: 15, minQty: 10 }, '2'),  // OK
        createItem({ qty: 10, minQty: 10 }, '3'),  // Low (equal)
        createItem({ qty: 0, minQty: 5 }, '4'),    // Low
        createItem({ qty: 100, minQty: 0 }, '5'),  // OK
      ]

      const lowStockItems = items.filter((item) => stockStatus.checkLowStock(item))

      expect(lowStockItems).toHaveLength(3)
      expect(lowStockItems.map((i) => i.id)).toEqual(['1', '3', '4'])
    })

    it('should handle items with varying data completeness', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const items = [
        createItem({ qty: 5, minQty: 10 }, '1'),    // Low: 5 <= 10
        createItem({ qty: 5 }, '2'),                 // No min, uses fallback 3, 5 > 3, not low
        createItem({ minQty: 10 }, '3'),             // No qty (0), 0 <= 10, low
        createItem({}, '4'),                         // qty=0, no min uses fallback 3, 0 <= 3, low
        createItem({ qty: null, minQty: null }, '5'),// qty=0, null min uses fallback 3, 0 <= 3, low
      ]

      expect(stockStatus.checkLowStock(items[0])).toBe(true)  // 5 <= 10
      expect(stockStatus.checkLowStock(items[1])).toBe(false) // 5 > fallback 3
      expect(stockStatus.checkLowStock(items[2])).toBe(true)  // 0 <= 10
      expect(stockStatus.checkLowStock(items[3])).toBe(true)  // 0 <= fallback 3
      expect(stockStatus.checkLowStock(items[4])).toBe(true)  // 0 <= fallback 3
    })
  })

  describe('fallback threshold option', () => {
    it('should use default fallback threshold of 3', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      expect(stockStatus.checkLowStock(createItem({ qty: 3 }))).toBe(true)
      expect(stockStatus.checkLowStock(createItem({ qty: 4 }))).toBe(false)
    })

    it('should use custom fallback threshold when provided', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
      ])
      const stockStatus = useStockStatus(columns, { fallbackThreshold: 5 })

      expect(stockStatus.checkLowStock(createItem({ qty: 5 }))).toBe(true)
      expect(stockStatus.checkLowStock(createItem({ qty: 6 }))).toBe(false)
    })

    it('should ignore fallback when minQuantity column exists', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns, { fallbackThreshold: 100 })

      // minQty is 10, so fallback of 100 should be ignored
      const item = createItem({ qty: 15, minQty: 10 })
      expect(stockStatus.checkLowStock(item)).toBe(false)

      // qty 5 <= minQty 10, so low stock
      const lowItem = createItem({ qty: 5, minQty: 10 })
      expect(stockStatus.checkLowStock(lowItem)).toBe(true)
    })

    it('should work with zero fallback threshold', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
      ])
      const stockStatus = useStockStatus(columns, { fallbackThreshold: 0 })

      expect(stockStatus.checkLowStock(createItem({ qty: 0 }))).toBe(true)
      expect(stockStatus.checkLowStock(createItem({ qty: 1 }))).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty columns array', () => {
      const columns = createColumnsRef([])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ qty: 5, minQty: 10 })

      expect(stockStatus.quantityColumn.value).toBeUndefined()
      expect(stockStatus.minQuantityColumn.value).toBeUndefined()
      expect(stockStatus.checkLowStock(item)).toBe(false)
    })

    it('should handle columns being cleared', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ qty: 5, minQty: 10 })
      expect(stockStatus.checkLowStock(item)).toBe(true)

      // Clear columns
      columns.value = []

      expect(stockStatus.checkLowStock(item)).toBe(false)
    })

    it('should handle column ID changes', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'quantity', role: 'quantity' }),
        createColumn({ id: 'min_quantity', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const item = createItem({ quantity: 5, min_quantity: 10 })

      expect(stockStatus.quantityColumn.value?.id).toBe('quantity')
      expect(stockStatus.minQuantityColumn.value?.id).toBe('min_quantity')
      expect(stockStatus.checkLowStock(item)).toBe(true)
    })

    it('should find first matching column when multiple have same role', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty1', role: 'quantity', order: 0 }),
        createColumn({ id: 'qty2', role: 'quantity', order: 1 }),
      ])
      const stockStatus = useStockStatus(columns)

      // Should find first one in array
      expect(stockStatus.quantityColumn.value?.id).toBe('qty1')
    })
  })

  describe('integration with isLowStock function', () => {
    it('should use the same logic as isLowStock function', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity' }),
        createColumn({ id: 'minQty', role: 'minQuantity' }),
      ])
      const stockStatus = useStockStatus(columns)

      const testCases = [
        { qty: 5, minQty: 10, expected: true },
        { qty: 10, minQty: 10, expected: true },
        { qty: 15, minQty: 10, expected: false },
        { qty: 0, minQty: 0, expected: true },
        { qty: 1, minQty: 0, expected: false },
      ]

      for (const testCase of testCases) {
        const item = createItem({ qty: testCase.qty, minQty: testCase.minQty })

        const composableResult = stockStatus.checkLowStock(item)
        const functionResult = isLowStock(
          item,
          stockStatus.quantityColumn.value,
          stockStatus.minQuantityColumn.value
        )

        expect(composableResult).toBe(testCase.expected)
        expect(composableResult).toBe(functionResult)
      }
    })
  })
})
