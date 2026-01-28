import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { ColumnDefinition } from '~/types/schema'
import type { ColumnMapping } from '~/types/import'

/**
 * Tests for useColumnMatcher composable
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Import after mocks are set up
import { useColumnMatcher } from '~/composables/useColumnMatcher'

// ============================================================================
// Test Utilities
// ============================================================================

function createColumn(
  id: string,
  name: string,
  type: ColumnDefinition['type'] = 'text',
  options?: Partial<ColumnDefinition>
): ColumnDefinition {
  return {
    id,
    name,
    type,
    order: 0,
    ...options,
  }
}

// ============================================================================
// Tests: calculateSimilarity
// ============================================================================

describe('calculateSimilarity', () => {
  let matcher: ReturnType<typeof useColumnMatcher>

  beforeEach(() => {
    vi.clearAllMocks()
    matcher = useColumnMatcher()
  })

  it('should return 1 for identical strings', () => {
    expect(matcher.calculateSimilarity('name', 'name')).toBe(1)
  })

  it('should return 0 for completely different strings', () => {
    const result = matcher.calculateSimilarity('abc', 'xyz')
    expect(result).toBeLessThan(0.5)
  })

  it('should return 0 for empty string vs non-empty', () => {
    expect(matcher.calculateSimilarity('', 'name')).toBe(0)
    expect(matcher.calculateSimilarity('name', '')).toBe(0)
  })

  it('should return 1 for two empty strings', () => {
    expect(matcher.calculateSimilarity('', '')).toBe(1)
  })

  it('should return high similarity for similar strings', () => {
    const result = matcher.calculateSimilarity('quantity', 'quantiti')
    expect(result).toBeGreaterThan(0.7)
  })

  it('should return lower similarity for less similar strings', () => {
    const result = matcher.calculateSimilarity('name', 'price')
    expect(result).toBeLessThan(0.5)
  })

  it('should handle single character strings', () => {
    expect(matcher.calculateSimilarity('a', 'a')).toBe(1)
    expect(matcher.calculateSimilarity('a', 'b')).toBe(0)
  })

  it('should handle case sensitivity (after normalization)', () => {
    expect(matcher.calculateSimilarity('Name', 'name')).toBeLessThan(1)
  })
})

// ============================================================================
// Tests: normalizeColumnName
// ============================================================================

describe('normalizeColumnName', () => {
  let matcher: ReturnType<typeof useColumnMatcher>

  beforeEach(() => {
    vi.clearAllMocks()
    matcher = useColumnMatcher()
  })

  it('should convert to lowercase', () => {
    expect(matcher.normalizeColumnName('NAME')).toBe('name')
    expect(matcher.normalizeColumnName('Name')).toBe('name')
  })

  it('should trim whitespace', () => {
    expect(matcher.normalizeColumnName('  name  ')).toBe('name')
    expect(matcher.normalizeColumnName('\tname\n')).toBe('name')
  })

  it('should remove special characters', () => {
    expect(matcher.normalizeColumnName('item-name')).toBe('itemname')
    expect(matcher.normalizeColumnName('item_name')).toBe('itemname')
    expect(matcher.normalizeColumnName('item name')).toBe('itemname')
    expect(matcher.normalizeColumnName('item.name')).toBe('itemname')
  })

  it('should keep alphanumeric characters', () => {
    expect(matcher.normalizeColumnName('item123')).toBe('item123')
    expect(matcher.normalizeColumnName('123item')).toBe('123item')
  })

  it('should handle empty string', () => {
    expect(matcher.normalizeColumnName('')).toBe('')
  })

  it('should handle string with only special characters', () => {
    expect(matcher.normalizeColumnName('---')).toBe('')
    expect(matcher.normalizeColumnName('   ')).toBe('')
  })

  it('should normalize common patterns', () => {
    expect(matcher.normalizeColumnName('Product Name')).toBe('productname')
    expect(matcher.normalizeColumnName('unit_price')).toBe('unitprice')
    expect(matcher.normalizeColumnName('SKU-Code')).toBe('skucode')
  })
})

// ============================================================================
// Tests: findBestMatch
// ============================================================================

describe('findBestMatch', () => {
  let matcher: ReturnType<typeof useColumnMatcher>

  beforeEach(() => {
    vi.clearAllMocks()
    matcher = useColumnMatcher()
  })

  describe('exact matches', () => {
    it('should find exact match with confidence 1.0', () => {
      const columns = [
        createColumn('col1', 'Name'),
        createColumn('col2', 'Price'),
      ]

      const result = matcher.findBestMatch('Name', columns)

      expect(result).not.toBeNull()
      expect(result?.schemaColumn.id).toBe('col1')
      expect(result?.confidence).toBe(1.0)
      expect(result?.matchType).toBe('exact')
    })

    it('should find exact match regardless of case', () => {
      const columns = [createColumn('col1', 'Name')]

      const result = matcher.findBestMatch('name', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('exact')
    })

    it('should find exact match with whitespace differences', () => {
      const columns = [createColumn('col1', 'Product Name')]

      const result = matcher.findBestMatch('productname', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('exact')
    })
  })

  describe('alias matches', () => {
    it('should match "qty" to "quantity" via alias', () => {
      const columns = [createColumn('col1', 'Quantity')]

      const result = matcher.findBestMatch('qty', columns)

      expect(result).not.toBeNull()
      expect(result?.confidence).toBe(0.9)
      expect(result?.matchType).toBe('alias')
    })

    it('should match "sku" to "id" via alias', () => {
      const columns = [createColumn('col1', 'SKU')]

      const result = matcher.findBestMatch('id', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('alias')
    })

    it('should match "desc" to "description" via alias', () => {
      const columns = [createColumn('col1', 'Description')]

      const result = matcher.findBestMatch('desc', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('alias')
    })

    it('should match "cost" to "unit_cost" via alias', () => {
      const columns = [createColumn('col1', 'Cost')]

      const result = matcher.findBestMatch('unit_cost', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('alias')
    })

    it('should match location aliases', () => {
      const columns = [createColumn('col1', 'Location')]

      const result = matcher.findBestMatch('bin', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('alias')
    })
  })

  describe('fuzzy matches', () => {
    it('should find fuzzy match for similar names', () => {
      const columns = [createColumn('col1', 'Quantity')]

      const result = matcher.findBestMatch('Quantty', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('fuzzy')
      expect(result?.confidence).toBeGreaterThan(0.6)
    })

    it('should not match with confidence below threshold', () => {
      const columns = [createColumn('col1', 'Name')]

      const result = matcher.findBestMatch('xyz', columns)

      expect(result).toBeNull()
    })

    it('should prefer higher confidence fuzzy matches', () => {
      const columns = [
        createColumn('col1', 'Product'),
        createColumn('col2', 'Producer'),
      ]

      const result = matcher.findBestMatch('Productt', columns)

      expect(result).not.toBeNull()
      expect(result?.schemaColumn.id).toBe('col1')
    })
  })

  describe('match priority', () => {
    it('should prefer exact match over alias match', () => {
      const columns = [
        createColumn('col1', 'Qty'),
        createColumn('col2', 'Quantity'),
      ]

      const result = matcher.findBestMatch('Quantity', columns)

      expect(result?.schemaColumn.id).toBe('col2')
      expect(result?.matchType).toBe('exact')
    })

    it('should prefer alias match over fuzzy match', () => {
      const columns = [
        createColumn('col1', 'Quantity'),
        createColumn('col2', 'Quality'),
      ]

      const result = matcher.findBestMatch('qty', columns)

      expect(result?.schemaColumn.id).toBe('col1')
      expect(result?.matchType).toBe('alias')
    })
  })

  describe('edge cases', () => {
    it('should return null for empty column list', () => {
      const result = matcher.findBestMatch('Name', [])
      expect(result).toBeNull()
    })

    it('should handle empty file column name', () => {
      const columns = [createColumn('col1', 'Name')]

      const result = matcher.findBestMatch('', columns)

      expect(result).toBeNull()
    })

    it('should handle columns with same normalized name', () => {
      const columns = [
        createColumn('col1', 'Product Name'),
        createColumn('col2', 'product-name'),
      ]

      const result = matcher.findBestMatch('productname', columns)

      expect(result).not.toBeNull()
    })
  })
})

// ============================================================================
// Tests: autoMatchColumns
// ============================================================================

describe('autoMatchColumns', () => {
  let matcher: ReturnType<typeof useColumnMatcher>

  beforeEach(() => {
    vi.clearAllMocks()
    matcher = useColumnMatcher()
  })

  it('should match all exact matches', () => {
    const fileHeaders = ['Name', 'Quantity', 'Price']
    const schemaColumns = [
      createColumn('col1', 'Name'),
      createColumn('col2', 'Quantity'),
      createColumn('col3', 'Price'),
    ]

    const result = matcher.autoMatchColumns(fileHeaders, schemaColumns)

    expect(result).toHaveLength(3)
    expect(result[0].schemaColumnId).toBe('col1')
    expect(result[1].schemaColumnId).toBe('col2')
    expect(result[2].schemaColumnId).toBe('col3')
    expect(result.every(m => m.matchType === 'exact')).toBe(true)
  })

  it('should mark unmatched columns as skip', () => {
    const fileHeaders = ['Name', 'Unknown Column']
    const schemaColumns = [createColumn('col1', 'Name')]

    const result = matcher.autoMatchColumns(fileHeaders, schemaColumns)

    expect(result).toHaveLength(2)
    expect(result[0].skip).toBe(false)
    expect(result[1].skip).toBe(true)
    expect(result[1].schemaColumnId).toBeNull()
    expect(result[1].matchType).toBe('none')
  })

  it('should not reuse schema columns', () => {
    const fileHeaders = ['Name', 'Product Name', 'Item Name']
    const schemaColumns = [createColumn('col1', 'Name')]

    const result = matcher.autoMatchColumns(fileHeaders, schemaColumns)

    expect(result[0].schemaColumnId).toBe('col1')
    expect(result[1].schemaColumnId).toBeNull()
    expect(result[2].schemaColumnId).toBeNull()
  })

  it('should include file column index and name', () => {
    const fileHeaders = ['Name', 'Price']
    const schemaColumns = [
      createColumn('col1', 'Name'),
      createColumn('col2', 'Price'),
    ]

    const result = matcher.autoMatchColumns(fileHeaders, schemaColumns)

    expect(result[0].fileColumnIndex).toBe(0)
    expect(result[0].fileColumnName).toBe('Name')
    expect(result[1].fileColumnIndex).toBe(1)
    expect(result[1].fileColumnName).toBe('Price')
  })

  it('should handle empty file headers', () => {
    const schemaColumns = [createColumn('col1', 'Name')]

    const result = matcher.autoMatchColumns([], schemaColumns)

    expect(result).toHaveLength(0)
  })

  it('should handle empty schema columns', () => {
    const fileHeaders = ['Name', 'Price']

    const result = matcher.autoMatchColumns(fileHeaders, [])

    expect(result).toHaveLength(2)
    expect(result.every(m => m.skip)).toBe(true)
  })

  it('should include confidence scores', () => {
    const fileHeaders = ['Name', 'qty']
    const schemaColumns = [
      createColumn('col1', 'Name'),
      createColumn('col2', 'Quantity'),
    ]

    const result = matcher.autoMatchColumns(fileHeaders, schemaColumns)

    expect(result[0].confidence).toBe(1.0)
    expect(result[1].confidence).toBe(0.9)
  })
})

// ============================================================================
// Tests: getAllMatches
// ============================================================================

describe('getAllMatches', () => {
  let matcher: ReturnType<typeof useColumnMatcher>

  beforeEach(() => {
    vi.clearAllMocks()
    matcher = useColumnMatcher()
  })

  it('should return all possible matches sorted by confidence', () => {
    const schemaColumns = [
      createColumn('col1', 'Name'),
      createColumn('col2', 'Quantity'),
      createColumn('col3', 'Quality'),
    ]

    const result = matcher.getAllMatches('quan', schemaColumns)

    expect(result.length).toBeGreaterThan(0)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence)
    }
  })

  it('should include exact matches first', () => {
    const schemaColumns = [
      createColumn('col1', 'Name'),
      createColumn('col2', 'Names'),
    ]

    const result = matcher.getAllMatches('Name', schemaColumns)

    expect(result[0].matchType).toBe('exact')
    expect(result[0].confidence).toBe(1.0)
  })

  it('should include fuzzy matches above threshold', () => {
    const schemaColumns = [
      createColumn('col1', 'Quantity'),
      createColumn('col2', 'Quality'),
    ]

    const result = matcher.getAllMatches('Quanity', schemaColumns)

    expect(result.length).toBeGreaterThan(0)
    expect(result.some(m => m.matchType === 'fuzzy')).toBe(true)
  })

  it('should return empty array for no matches above threshold', () => {
    const schemaColumns = [createColumn('col1', 'Name')]

    const result = matcher.getAllMatches('xyz123abc', schemaColumns)

    expect(result).toHaveLength(0)
  })

  it('should include alias matches', () => {
    const schemaColumns = [createColumn('col1', 'Quantity')]

    const result = matcher.getAllMatches('qty', schemaColumns)

    expect(result.length).toBeGreaterThan(0)
    expect(result[0].matchType).toBe('alias')
  })
})

// ============================================================================
// Tests: validateMappings
// ============================================================================

describe('validateMappings', () => {
  let matcher: ReturnType<typeof useColumnMatcher>

  beforeEach(() => {
    vi.clearAllMocks()
    matcher = useColumnMatcher()
  })

  it('should return valid when all required columns are mapped', () => {
    const mappings: ColumnMapping[] = [
      {
        fileColumnIndex: 0,
        fileColumnName: 'Name',
        schemaColumnId: 'col1',
        newColumn: null,
        skip: false,
        confidence: 1.0,
        matchType: 'exact',
      },
    ]
    const schemaColumns = [
      createColumn('col1', 'Name', 'text', { required: true }),
    ]

    const result = matcher.validateMappings(mappings, schemaColumns)

    expect(result.valid).toBe(true)
    expect(result.missingColumns).toHaveLength(0)
  })

  it('should return invalid when required column is not mapped', () => {
    const mappings: ColumnMapping[] = []
    const schemaColumns = [
      createColumn('col1', 'Name', 'text', { required: true }),
    ]

    const result = matcher.validateMappings(mappings, schemaColumns)

    expect(result.valid).toBe(false)
    expect(result.missingColumns).toHaveLength(1)
    expect(result.missingColumns[0].id).toBe('col1')
  })

  it('should ignore optional columns in validation', () => {
    const mappings: ColumnMapping[] = []
    const schemaColumns = [
      createColumn('col1', 'Name', 'text', { required: false }),
    ]

    const result = matcher.validateMappings(mappings, schemaColumns)

    expect(result.valid).toBe(true)
  })

  it('should not count skipped mappings', () => {
    const mappings: ColumnMapping[] = [
      {
        fileColumnIndex: 0,
        fileColumnName: 'Name',
        schemaColumnId: 'col1',
        newColumn: null,
        skip: true,
        confidence: 1.0,
        matchType: 'exact',
      },
    ]
    const schemaColumns = [
      createColumn('col1', 'Name', 'text', { required: true }),
    ]

    const result = matcher.validateMappings(mappings, schemaColumns)

    expect(result.valid).toBe(false)
    expect(result.missingColumns).toHaveLength(1)
  })

  it('should handle multiple required columns', () => {
    const mappings: ColumnMapping[] = [
      {
        fileColumnIndex: 0,
        fileColumnName: 'Name',
        schemaColumnId: 'col1',
        newColumn: null,
        skip: false,
        confidence: 1.0,
        matchType: 'exact',
      },
    ]
    const schemaColumns = [
      createColumn('col1', 'Name', 'text', { required: true }),
      createColumn('col2', 'Price', 'currency', { required: true }),
    ]

    const result = matcher.validateMappings(mappings, schemaColumns)

    expect(result.valid).toBe(false)
    expect(result.missingColumns).toHaveLength(1)
    expect(result.missingColumns[0].id).toBe('col2')
  })

  it('should handle empty mappings with no required columns', () => {
    const mappings: ColumnMapping[] = []
    const schemaColumns = [
      createColumn('col1', 'Name', 'text', { required: false }),
      createColumn('col2', 'Price', 'currency', { required: false }),
    ]

    const result = matcher.validateMappings(mappings, schemaColumns)

    expect(result.valid).toBe(true)
  })
})

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('edge cases', () => {
  let matcher: ReturnType<typeof useColumnMatcher>

  beforeEach(() => {
    vi.clearAllMocks()
    matcher = useColumnMatcher()
  })

  describe('unicode and special characters', () => {
    it('should normalize unicode characters', () => {
      const result = matcher.normalizeColumnName('cafe')
      expect(result).toBe('cafe')
    })

    it('should handle column names with numbers', () => {
      const columns = [createColumn('col1', 'Column1')]

      const result = matcher.findBestMatch('Column1', columns)

      expect(result).not.toBeNull()
      expect(result?.matchType).toBe('exact')
    })
  })

  describe('very long column names', () => {
    it('should handle very long column names', () => {
      const longName = 'A'.repeat(100)
      const columns = [createColumn('col1', longName)]

      const result = matcher.findBestMatch(longName, columns)

      expect(result).not.toBeNull()
    })
  })

  describe('common import patterns', () => {
    it('should match common CSV header variations', () => {
      const schemaColumns = [
        createColumn('col1', 'Product Name'),
        createColumn('col2', 'Quantity'),
        createColumn('col3', 'Unit Price'),
      ]

      expect(matcher.findBestMatch('product_name', schemaColumns)?.schemaColumn.id).toBe('col1')
      expect(matcher.findBestMatch('qty', schemaColumns)?.schemaColumn.id).toBe('col2')
      expect(matcher.findBestMatch('unit price', schemaColumns)?.schemaColumn.id).toBe('col3')
    })
  })
})
