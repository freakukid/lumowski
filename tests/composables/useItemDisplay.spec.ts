import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'

/**
 * Tests for useItemDisplay composable
 *
 * The composable provides:
 * - getItemName: Gets display name from item based on column with 'name' role or first text column
 * - getItemQuantity: Gets quantity from item based on column with 'quantity' role
 * - getItemCost: Gets cost from item based on column with 'cost' role
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)

// Import after mocks are set up
import { useItemDisplay } from '~/composables/useItemDisplay'

// ============================================================================
// Test Utilities
// ============================================================================

function createColumn(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id: 'col-1',
    name: 'Column 1',
    type: 'text',
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
// Tests: Initialization
// ============================================================================

describe('useItemDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should return composable with all expected functions', () => {
      const columns = createColumnsRef([])
      const display = useItemDisplay(columns)

      expect(display).toHaveProperty('getItemName')
      expect(display).toHaveProperty('getItemQuantity')
      expect(display).toHaveProperty('getItemCost')
      expect(typeof display.getItemName).toBe('function')
      expect(typeof display.getItemQuantity).toBe('function')
      expect(typeof display.getItemCost).toBe('function')
    })
  })

  // ============================================================================
  // Tests: getItemName
  // ============================================================================

  describe('getItemName', () => {
    describe('with name role column', () => {
      it('should return name from column with name role', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: 'Widget Pro' })

        expect(display.getItemName(item)).toBe('Widget Pro')
      })

      it('should prioritize name role over other columns', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'title', type: 'text', order: 0 }),
          createColumn({ id: 'name', role: 'name', order: 1 }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ title: 'First Column', name: 'Name Column' })

        expect(display.getItemName(item)).toBe('Name Column')
      })

      it('should return Untitled when name role value is null', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: null })

        expect(display.getItemName(item)).toBe('Untitled')
      })

      it('should return Untitled when name role value is undefined', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({})

        expect(display.getItemName(item)).toBe('Untitled')
      })

      it('should convert non-string name values to string', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: 12345 })

        expect(display.getItemName(item)).toBe('12345')
      })

      it('should handle boolean name values', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: true })

        expect(display.getItemName(item)).toBe('true')
      })

      it('should handle zero as name value', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: 0 })

        expect(display.getItemName(item)).toBe('0')
      })
    })

    describe('fallback to first text column', () => {
      it('should use first text column when no name role exists', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'qty', type: 'number', order: 0 }),
          createColumn({ id: 'title', type: 'text', order: 1 }),
          createColumn({ id: 'desc', type: 'text', order: 2 }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ qty: 10, title: 'My Title', desc: 'Description' })

        // Should use first text column found (by array order, not by 'order' property)
        expect(display.getItemName(item)).toBe('My Title')
      })

      it('should return Untitled when first text column value is null', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'title', type: 'text' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ title: null })

        expect(display.getItemName(item)).toBe('Untitled')
      })

      it('should return Untitled when first text column value is undefined', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'title', type: 'text' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({})

        expect(display.getItemName(item)).toBe('Untitled')
      })
    })

    describe('no suitable column', () => {
      it('should return Untitled when no columns exist', () => {
        const columns = createColumnsRef([])
        const display = useItemDisplay(columns)

        const item = createItem({ name: 'Widget' })

        expect(display.getItemName(item)).toBe('Untitled')
      })

      it('should return Untitled when only non-text columns exist', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'qty', type: 'number' }),
          createColumn({ id: 'price', type: 'currency' }),
          createColumn({ id: 'date', type: 'date' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ qty: 10, price: 19.99, date: '2024-01-15' })

        expect(display.getItemName(item)).toBe('Untitled')
      })
    })

    describe('edge cases', () => {
      it('should handle empty string name', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: '' })

        expect(display.getItemName(item)).toBe('')
      })

      it('should handle whitespace-only name', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: '   ' })

        expect(display.getItemName(item)).toBe('   ')
      })

      it('should handle special characters in name', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: '<script>alert("xss")</script>' })

        expect(display.getItemName(item)).toBe('<script>alert("xss")</script>')
      })

      it('should handle unicode characters in name', () => {
        const columns = createColumnsRef([
          createColumn({ id: 'name', role: 'name' }),
        ])
        const display = useItemDisplay(columns)

        const item = createItem({ name: 'Widget Pro Max Ultra+' })

        expect(display.getItemName(item)).toBe('Widget Pro Max Ultra+')
      })
    })
  })

  // ============================================================================
  // Tests: getItemQuantity
  // ============================================================================

  describe('getItemQuantity', () => {
    it('should return quantity from column with quantity role', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: 100 })

      expect(display.getItemQuantity(item)).toBe(100)
    })

    it('should return 0 when no quantity column exists', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ name: 'Widget' })

      expect(display.getItemQuantity(item)).toBe(0)
    })

    it('should return 0 when quantity value is null', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: null })

      expect(display.getItemQuantity(item)).toBe(0)
    })

    it('should return 0 when quantity value is undefined', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({})

      expect(display.getItemQuantity(item)).toBe(0)
    })

    it('should return 0 when quantity value is non-numeric string', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: 'not a number' })

      expect(display.getItemQuantity(item)).toBe(0)
    })

    it('should convert numeric string to number', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: '50' })

      expect(display.getItemQuantity(item)).toBe(50)
    })

    it('should handle decimal quantities', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: 10.5 })

      expect(display.getItemQuantity(item)).toBe(10.5)
    })

    it('should handle zero quantity', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: 0 })

      expect(display.getItemQuantity(item)).toBe(0)
    })

    it('should handle negative quantities', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: -5 })

      expect(display.getItemQuantity(item)).toBe(-5)
    })

    it('should handle very large quantities', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ qty: 999999999 })

      expect(display.getItemQuantity(item)).toBe(999999999)
    })
  })

  // ============================================================================
  // Tests: getItemCost
  // ============================================================================

  describe('getItemCost', () => {
    it('should return cost from column with cost role', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ cost: 15.99 })

      expect(display.getItemCost(item)).toBe(15.99)
    })

    it('should return 0 when no cost column exists', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'price', role: 'price', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ name: 'Widget', price: 29.99 })

      expect(display.getItemCost(item)).toBe(0)
    })

    it('should return 0 when cost value is null', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ cost: null })

      expect(display.getItemCost(item)).toBe(0)
    })

    it('should return 0 when cost value is undefined', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({})

      expect(display.getItemCost(item)).toBe(0)
    })

    it('should return 0 when cost value is non-numeric string', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ cost: 'expensive' })

      expect(display.getItemCost(item)).toBe(0)
    })

    it('should convert numeric string to number', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ cost: '25.50' })

      expect(display.getItemCost(item)).toBe(25.5)
    })

    it('should handle decimal costs', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ cost: 99.99 })

      expect(display.getItemCost(item)).toBe(99.99)
    })

    it('should handle zero cost', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ cost: 0 })

      expect(display.getItemCost(item)).toBe(0)
    })

    it('should handle negative costs', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ cost: -10.5 })

      expect(display.getItemCost(item)).toBe(-10.5)
    })
  })

  // ============================================================================
  // Tests: Reactive Behavior
  // ============================================================================

  describe('reactive behavior', () => {
    it('should reflect column changes dynamically', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'title', type: 'text' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ title: 'Old Title', name: 'New Name' })

      // Initially uses first text column (title)
      expect(display.getItemName(item)).toBe('Old Title')

      // Add a name role column
      columns.value = [
        createColumn({ id: 'title', type: 'text' }),
        createColumn({ id: 'name', role: 'name' }),
      ]

      // Now should use name role
      expect(display.getItemName(item)).toBe('New Name')
    })

    it('should handle columns being emptied', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ name: 'Widget', qty: 100, cost: 15.99 })

      expect(display.getItemName(item)).toBe('Widget')
      expect(display.getItemQuantity(item)).toBe(100)
      expect(display.getItemCost(item)).toBe(15.99)

      // Empty columns
      columns.value = []

      expect(display.getItemName(item)).toBe('Untitled')
      expect(display.getItemQuantity(item)).toBe(0)
      expect(display.getItemCost(item)).toBe(0)
    })

    it('should handle column role changes', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'col1', name: 'Column 1', type: 'text', role: 'name' }),
        createColumn({ id: 'col2', name: 'Column 2', type: 'text' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ col1: 'First', col2: 'Second' })

      expect(display.getItemName(item)).toBe('First')

      // Change name role to col2
      columns.value = [
        createColumn({ id: 'col1', name: 'Column 1', type: 'text' }),
        createColumn({ id: 'col2', name: 'Column 2', type: 'text', role: 'name' }),
      ]

      expect(display.getItemName(item)).toBe('Second')
    })
  })

  // ============================================================================
  // Tests: Multiple Items
  // ============================================================================

  describe('multiple items', () => {
    it('should work correctly across multiple items', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const items = [
        createItem({ name: 'Widget A', qty: 10, cost: 5.99 }, '1'),
        createItem({ name: 'Widget B', qty: 20, cost: 7.99 }, '2'),
        createItem({ name: 'Widget C', qty: 30, cost: 9.99 }, '3'),
      ]

      expect(display.getItemName(items[0])).toBe('Widget A')
      expect(display.getItemName(items[1])).toBe('Widget B')
      expect(display.getItemName(items[2])).toBe('Widget C')

      expect(display.getItemQuantity(items[0])).toBe(10)
      expect(display.getItemQuantity(items[1])).toBe(20)
      expect(display.getItemQuantity(items[2])).toBe(30)

      expect(display.getItemCost(items[0])).toBe(5.99)
      expect(display.getItemCost(items[1])).toBe(7.99)
      expect(display.getItemCost(items[2])).toBe(9.99)
    })

    it('should handle items with inconsistent data', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
      ])
      const display = useItemDisplay(columns)

      const items = [
        createItem({ name: 'Complete', qty: 100 }, '1'),
        createItem({ name: 'No Qty' }, '2'),
        createItem({ qty: 50 }, '3'),
        createItem({}, '4'),
      ]

      expect(display.getItemName(items[0])).toBe('Complete')
      expect(display.getItemQuantity(items[0])).toBe(100)

      expect(display.getItemName(items[1])).toBe('No Qty')
      expect(display.getItemQuantity(items[1])).toBe(0)

      expect(display.getItemName(items[2])).toBe('Untitled')
      expect(display.getItemQuantity(items[2])).toBe(50)

      expect(display.getItemName(items[3])).toBe('Untitled')
      expect(display.getItemQuantity(items[3])).toBe(0)
    })
  })

  // ============================================================================
  // Tests: Complex Column Configurations
  // ============================================================================

  describe('complex column configurations', () => {
    it('should handle columns with multiple roles', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'name', role: 'name' }),
        createColumn({ id: 'qty', role: 'quantity', type: 'number' }),
        createColumn({ id: 'min', role: 'minQuantity', type: 'number' }),
        createColumn({ id: 'price', role: 'price', type: 'currency' }),
        createColumn({ id: 'cost', role: 'cost', type: 'currency' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({
        name: 'Widget',
        qty: 100,
        min: 10,
        price: 29.99,
        cost: 15.99,
      })

      expect(display.getItemName(item)).toBe('Widget')
      expect(display.getItemQuantity(item)).toBe(100)
      expect(display.getItemCost(item)).toBe(15.99)
    })

    it('should handle select type columns', () => {
      const columns = createColumnsRef([
        createColumn({
          id: 'category',
          type: 'select',
          options: ['Electronics', 'Clothing', 'Food'],
        }),
        createColumn({ id: 'name', role: 'name' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ category: 'Electronics', name: 'Phone' })

      expect(display.getItemName(item)).toBe('Phone')
    })

    it('should handle date type columns', () => {
      const columns = createColumnsRef([
        createColumn({ id: 'created', type: 'date' }),
        createColumn({ id: 'name', role: 'name' }),
      ])
      const display = useItemDisplay(columns)

      const item = createItem({ created: '2024-01-15', name: 'Widget' })

      expect(display.getItemName(item)).toBe('Widget')
    })
  })
})
