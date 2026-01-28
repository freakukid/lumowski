import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref, computed } from 'vue'
import type { LogAction, LogChange, SchemaChange, InventoryLog } from '~/types/log'

/**
 * Tests for useLogHelpers composable
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Import after mocks are set up
import {
  useLogHelpers,
  formatGroupDate,
  groupLogsByDate,
  type LogGroup,
} from '~/composables/useLogHelpers'

// ============================================================================
// Test Utilities
// ============================================================================

function createMockLog(overrides: Partial<InventoryLog> = {}): InventoryLog {
  return {
    id: 'log-1',
    action: 'ITEM_CREATED',
    itemId: 'item-1',
    itemName: 'Test Item',
    snapshot: null,
    changes: null,
    schemaChanges: null,
    undoable: true,
    undoneAt: null,
    undoneById: null,
    createdAt: '2026-01-23T10:00:00Z',
    businessId: 'business-1',
    userId: 'user-1',
    user: {
      id: 'user-1',
      name: 'Test User',
    },
    ...overrides,
  }
}

// ============================================================================
// Tests: getActionLabel
// ============================================================================

describe('getActionLabel', () => {
  let helpers: ReturnType<typeof useLogHelpers>

  beforeEach(() => {
    vi.clearAllMocks()
    helpers = useLogHelpers()
  })

  it('should return "Created" for ITEM_CREATED action', () => {
    expect(helpers.getActionLabel('ITEM_CREATED')).toBe('Created')
  })

  it('should return "Updated" for ITEM_UPDATED action', () => {
    expect(helpers.getActionLabel('ITEM_UPDATED')).toBe('Updated')
  })

  it('should return "Deleted" for ITEM_DELETED action', () => {
    expect(helpers.getActionLabel('ITEM_DELETED')).toBe('Deleted')
  })

  it('should return "Schema Changed" for SCHEMA_UPDATED action', () => {
    expect(helpers.getActionLabel('SCHEMA_UPDATED')).toBe('Schema Changed')
  })

  it('should return the action string for unknown action', () => {
    const unknownAction = 'UNKNOWN_ACTION' as LogAction
    expect(helpers.getActionLabel(unknownAction)).toBe('UNKNOWN_ACTION')
  })
})

// ============================================================================
// Tests: getActionColors
// ============================================================================

describe('getActionColors', () => {
  let helpers: ReturnType<typeof useLogHelpers>

  beforeEach(() => {
    vi.clearAllMocks()
    helpers = useLogHelpers()
  })

  it('should return green colors for ITEM_CREATED', () => {
    const colors = helpers.getActionColors('ITEM_CREATED')
    expect(colors.bg).toContain('green')
    expect(colors.text).toContain('green')
    expect(colors.icon).toContain('green')
  })

  it('should return blue colors for ITEM_UPDATED', () => {
    const colors = helpers.getActionColors('ITEM_UPDATED')
    expect(colors.bg).toContain('blue')
    expect(colors.text).toContain('blue')
    expect(colors.icon).toContain('blue')
  })

  it('should return red colors for ITEM_DELETED', () => {
    const colors = helpers.getActionColors('ITEM_DELETED')
    expect(colors.bg).toContain('red')
    expect(colors.text).toContain('red')
    expect(colors.icon).toContain('red')
  })

  it('should return purple colors for SCHEMA_UPDATED', () => {
    const colors = helpers.getActionColors('SCHEMA_UPDATED')
    expect(colors.bg).toContain('purple')
    expect(colors.text).toContain('purple')
    expect(colors.icon).toContain('purple')
  })

  it('should return default surface colors for unknown action', () => {
    const unknownAction = 'UNKNOWN_ACTION' as LogAction
    const colors = helpers.getActionColors(unknownAction)
    expect(colors.bg).toBe('bg-surface-100')
    expect(colors.text).toBe('text-surface-700')
    expect(colors.icon).toBe('text-surface-500')
  })
})

// ============================================================================
// Tests: formatDate
// ============================================================================

describe('formatDate', () => {
  let helpers: ReturnType<typeof useLogHelpers>

  beforeEach(() => {
    vi.clearAllMocks()
    helpers = useLogHelpers()
  })

  it('should format date with time by default', () => {
    const result = helpers.formatDate('2024-06-15T14:30:00Z')
    expect(result).toMatch(/Jun|2024|15/)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('should format date with time when includeTime is true', () => {
    const result = helpers.formatDate('2024-06-15T14:30:00Z', { includeTime: true })
    expect(result).toMatch(/Jun|2024|15/)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('should format date without time when includeTime is false', () => {
    const result = helpers.formatDate('2024-06-15T14:30:00Z', { includeTime: false })
    expect(result).toMatch(/Jun|2024|15/)
    expect(result).not.toMatch(/14:30/)
  })
})

// ============================================================================
// Tests: getRelativeTime
// ============================================================================

describe('getRelativeTime', () => {
  let helpers: ReturnType<typeof useLogHelpers>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00Z'))
    helpers = useLogHelpers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "Just now" for times less than a minute ago', () => {
    const result = helpers.getRelativeTime('2026-01-23T11:59:45Z')
    expect(result).toBe('Just now')
  })

  it('should return minutes ago for times less than an hour ago', () => {
    const result = helpers.getRelativeTime('2026-01-23T11:30:00Z')
    expect(result).toBe('30m ago')
  })

  it('should return hours ago for times less than 24 hours ago', () => {
    const result = helpers.getRelativeTime('2026-01-23T06:00:00Z')
    expect(result).toBe('6h ago')
  })

  it('should return days ago for times less than 7 days ago', () => {
    const result = helpers.getRelativeTime('2026-01-20T12:00:00Z')
    expect(result).toBe('3d ago')
  })

  it('should return formatted date for times more than 7 days ago', () => {
    const result = helpers.getRelativeTime('2026-01-10T12:00:00Z')
    expect(result).toMatch(/Jan|10|2026/)
  })
})

// ============================================================================
// Tests: formatValue
// ============================================================================

describe('formatValue', () => {
  let helpers: ReturnType<typeof useLogHelpers>

  beforeEach(() => {
    vi.clearAllMocks()
    helpers = useLogHelpers()
  })

  it('should return "-" for null', () => {
    expect(helpers.formatValue(null)).toBe('-')
  })

  it('should return "-" for undefined', () => {
    expect(helpers.formatValue(undefined)).toBe('-')
  })

  it('should return "Yes" for true', () => {
    expect(helpers.formatValue(true)).toBe('Yes')
  })

  it('should return "No" for false', () => {
    expect(helpers.formatValue(false)).toBe('No')
  })

  it('should format numbers with locale string', () => {
    const result = helpers.formatValue(1000)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/1[,.]?000/)
  })

  it('should join array elements with comma and space', () => {
    expect(helpers.formatValue(['a', 'b', 'c'])).toBe('a, b, c')
  })

  it('should handle empty array', () => {
    expect(helpers.formatValue([])).toBe('')
  })

  it('should stringify objects', () => {
    const obj = { key: 'value' }
    expect(helpers.formatValue(obj)).toBe('{"key":"value"}')
  })

  it('should return strings as-is', () => {
    expect(helpers.formatValue('hello')).toBe('hello')
  })
})

// ============================================================================
// Tests: getLogSummary
// ============================================================================

describe('getLogSummary', () => {
  let helpers: ReturnType<typeof useLogHelpers>

  beforeEach(() => {
    vi.clearAllMocks()
    helpers = useLogHelpers()
  })

  describe('ITEM_CREATED', () => {
    it('should return summary with item name', () => {
      const result = helpers.getLogSummary('ITEM_CREATED', 'Widget', null, null)
      expect(result).toBe('Created "Widget"')
    })

    it('should return generic summary when item name is null', () => {
      const result = helpers.getLogSummary('ITEM_CREATED', null, null, null)
      expect(result).toBe('Created an item')
    })
  })

  describe('ITEM_UPDATED', () => {
    it('should return summary with item name and single field', () => {
      const changes: LogChange[] = [
        { field: 'col1', fieldName: 'Name', oldValue: 'Old', newValue: 'New' },
      ]
      const result = helpers.getLogSummary('ITEM_UPDATED', 'Widget', changes, null)
      expect(result).toBe('Updated "Widget" (Name)')
    })

    it('should return summary with item name and multiple fields', () => {
      const changes: LogChange[] = [
        { field: 'col1', fieldName: 'Name', oldValue: 'Old', newValue: 'New' },
        { field: 'col2', fieldName: 'Price', oldValue: 10, newValue: 20 },
        { field: 'col3', fieldName: 'Stock', oldValue: 5, newValue: 10 },
      ]
      const result = helpers.getLogSummary('ITEM_UPDATED', 'Widget', changes, null)
      expect(result).toBe('Updated "Widget" (3 fields)')
    })

    it('should return generic summary when no changes', () => {
      const result = helpers.getLogSummary('ITEM_UPDATED', 'Widget', null, null)
      expect(result).toBe('Updated "Widget"')
    })
  })

  describe('ITEM_DELETED', () => {
    it('should return summary with item name', () => {
      const result = helpers.getLogSummary('ITEM_DELETED', 'Widget', null, null)
      expect(result).toBe('Deleted "Widget"')
    })

    it('should return generic summary when item name is null', () => {
      const result = helpers.getLogSummary('ITEM_DELETED', null, null, null)
      expect(result).toBe('Deleted an item')
    })
  })

  describe('SCHEMA_UPDATED', () => {
    it('should return summary with added columns', () => {
      const schemaChanges: SchemaChange[] = [
        { type: 'added', columnId: 'col1', columnName: 'New Column' },
        { type: 'added', columnId: 'col2', columnName: 'Another Column' },
      ]
      const result = helpers.getLogSummary('SCHEMA_UPDATED', null, null, schemaChanges)
      expect(result).toBe('Schema changed (+2 columns)')
    })

    it('should return summary with mixed changes', () => {
      const schemaChanges: SchemaChange[] = [
        { type: 'added', columnId: 'col1', columnName: 'New' },
        { type: 'removed', columnId: 'col2', columnName: 'Old' },
        { type: 'modified', columnId: 'col3', columnName: 'Modified' },
      ]
      const result = helpers.getLogSummary('SCHEMA_UPDATED', null, null, schemaChanges)
      expect(result).toBe('Schema changed (+1, -1, ~1 columns)')
    })

    it('should return generic summary when no schema changes', () => {
      const result = helpers.getLogSummary('SCHEMA_UPDATED', null, null, null)
      expect(result).toBe('Schema changed')
    })
  })

  it('should return "Unknown action" for unrecognized actions', () => {
    const unknownAction = 'UNKNOWN_ACTION' as LogAction
    const result = helpers.getLogSummary(unknownAction, null, null, null)
    expect(result).toBe('Unknown action')
  })
})

// ============================================================================
// Tests: canUndo
// ============================================================================

describe('canUndo', () => {
  let helpers: ReturnType<typeof useLogHelpers>

  beforeEach(() => {
    vi.clearAllMocks()
    helpers = useLogHelpers()
  })

  it('should return true for undoable ITEM_DELETED that has not been undone', () => {
    const result = helpers.canUndo({
      undoable: true,
      undoneAt: null,
      action: 'ITEM_DELETED',
    })
    expect(result).toBe(true)
  })

  it('should return true for undoable ITEM_UPDATED that has not been undone', () => {
    const result = helpers.canUndo({
      undoable: true,
      undoneAt: null,
      action: 'ITEM_UPDATED',
    })
    expect(result).toBe(true)
  })

  it('should return false when undoable is false', () => {
    const result = helpers.canUndo({
      undoable: false,
      undoneAt: null,
      action: 'ITEM_DELETED',
    })
    expect(result).toBe(false)
  })

  it('should return false when already undone', () => {
    const result = helpers.canUndo({
      undoable: true,
      undoneAt: '2026-01-23T12:00:00Z',
      action: 'ITEM_DELETED',
    })
    expect(result).toBe(false)
  })

  it('should return false for ITEM_CREATED action', () => {
    const result = helpers.canUndo({
      undoable: true,
      undoneAt: null,
      action: 'ITEM_CREATED',
    })
    expect(result).toBe(false)
  })

  it('should return false for SCHEMA_UPDATED action', () => {
    const result = helpers.canUndo({
      undoable: true,
      undoneAt: null,
      action: 'SCHEMA_UPDATED',
    })
    expect(result).toBe(false)
  })
})

// ============================================================================
// Tests: formatGroupDate
// ============================================================================

describe('formatGroupDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "Today" for today\'s date', () => {
    const result = formatGroupDate('2026-01-23')
    expect(result).toBe('Today')
  })

  it('should return "Yesterday" for yesterday\'s date', () => {
    const result = formatGroupDate('2026-01-22')
    expect(result).toBe('Yesterday')
  })

  it('should return day name for dates within last 7 days', () => {
    const result = formatGroupDate('2026-01-21')
    expect(result).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)
  })

  it('should return month and day for dates in current year but older than 7 days', () => {
    const result = formatGroupDate('2026-01-10')
    expect(result).toMatch(/January 10/)
  })

  it('should return month, day, and year for dates in previous years', () => {
    const result = formatGroupDate('2025-12-25')
    expect(result).toMatch(/December 25, 2025/)
  })
})

// ============================================================================
// Tests: groupLogsByDate
// ============================================================================

describe('groupLogsByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-23T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return empty array for empty logs', () => {
    const result = groupLogsByDate([])
    expect(result).toEqual([])
  })

  it('should return empty array for null logs', () => {
    const result = groupLogsByDate(null as unknown as InventoryLog[])
    expect(result).toEqual([])
  })

  it('should group logs by date', () => {
    const logs: InventoryLog[] = [
      createMockLog({ id: '1', createdAt: '2026-01-23T10:00:00Z' }),
      createMockLog({ id: '2', createdAt: '2026-01-23T14:00:00Z' }),
      createMockLog({ id: '3', createdAt: '2026-01-22T10:00:00Z' }),
    ]

    const result = groupLogsByDate(logs)

    expect(result).toHaveLength(2)
    expect(result[0].dateKey).toBe('2026-01-23')
    expect(result[0].logs).toHaveLength(2)
    expect(result[1].dateKey).toBe('2026-01-22')
    expect(result[1].logs).toHaveLength(1)
  })

  it('should sort groups by date descending (most recent first)', () => {
    const logs: InventoryLog[] = [
      createMockLog({ id: '1', createdAt: '2026-01-20T10:00:00Z' }),
      createMockLog({ id: '2', createdAt: '2026-01-23T10:00:00Z' }),
      createMockLog({ id: '3', createdAt: '2026-01-21T10:00:00Z' }),
    ]

    const result = groupLogsByDate(logs)

    expect(result).toHaveLength(3)
    expect(result[0].dateKey).toBe('2026-01-23')
    expect(result[1].dateKey).toBe('2026-01-21')
    expect(result[2].dateKey).toBe('2026-01-20')
  })

  it('should include displayDate with formatted date', () => {
    const logs: InventoryLog[] = [
      createMockLog({ id: '1', createdAt: '2026-01-23T10:00:00Z' }),
    ]

    const result = groupLogsByDate(logs)

    expect(result[0].displayDate).toBe('Today')
  })
})
