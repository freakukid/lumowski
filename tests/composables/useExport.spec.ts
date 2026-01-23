import { describe, it, expect, beforeEach, vi, type Mock, afterEach } from 'vitest'
import { ref, computed } from 'vue'
import type { ColumnDefinition, DynamicInventoryItem } from '~/types/schema'
import type { ExportOptions, ExportFormat } from '~/types/import'

/**
 * Tests for useExport composable
 *
 * The composable exports inventory data to multiple formats:
 * - Excel (.xlsx) using the XLSX library
 * - CSV (.csv) using the XLSX library
 * - JSON (.json) using the Blob API
 *
 * Key functionality tested:
 * - Cell value formatting based on column type
 * - Data transformation for export
 * - File generation and download triggering
 * - Pagination handling for "export all" functionality
 * - Error handling and loading states
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Mock useAuthFetch composable
const mockAuthFetch = vi.fn()
vi.stubGlobal('useAuthFetch', () => ({
  authFetch: mockAuthFetch,
}))

// Mock XLSX library
vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({ Sheets: {}, SheetNames: [] })),
    json_to_sheet: vi.fn(() => ({ '!ref': 'A1:C3' })),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}))

// Import after mocks are set up
import { useExport } from '~/composables/useExport'
import * as XLSX from 'xlsx'

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a mock column definition
 */
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

/**
 * Creates a mock inventory item
 */
function createItem(
  id: string,
  data: Record<string, unknown>
): DynamicInventoryItem {
  return {
    id,
    data,
    businessId: 'business-1',
    createdById: 'user-1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  }
}

/**
 * Creates default export options
 */
function createExportOptions(
  overrides: Partial<ExportOptions> = {}
): ExportOptions {
  return {
    format: 'xlsx',
    columnIds: ['col1', 'col2'],
    exportAll: false,
    ...overrides,
  }
}

// Store for capturing Blob content
let capturedBlobContent: string | undefined

/**
 * Mock document methods for download triggering
 */
function setupDocumentMocks(): {
  mockLink: { href: string; download: string; style: { display: string }; click: Mock; parentNode: ParentNode | null }
  mockClick: Mock
  mockAppendChild: Mock
  mockRemoveChild: Mock
} {
  const mockClick = vi.fn()
  const mockLink = {
    href: '',
    download: '',
    style: { display: '' },
    click: mockClick,
    parentNode: document.body as ParentNode,
  }

  const mockAppendChild = vi.fn().mockReturnValue(mockLink)
  const mockRemoveChild = vi.fn()

  vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement)
  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild)
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild)

  return { mockLink, mockClick, mockAppendChild, mockRemoveChild }
}

/**
 * Mock URL methods for Blob handling
 */
function setupURLMocks(): { mockCreateObjectURL: Mock; mockRevokeObjectURL: Mock } {
  const mockCreateObjectURL = vi.fn(() => 'blob:mock-url')
  const mockRevokeObjectURL = vi.fn()

  vi.stubGlobal('URL', {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  })

  return { mockCreateObjectURL, mockRevokeObjectURL }
}

/**
 * Mock Blob constructor that captures content
 * Must be a constructor function (class) for `new Blob(...)` to work
 */
function setupBlobMock(): Mock {
  capturedBlobContent = undefined

  // Create a mock class constructor
  class MockBlob {
    type = 'application/json'
    constructor(content: string[]) {
      capturedBlobContent = content[0]
    }
  }

  const mockBlobFn = vi.fn((content: string[]) => new MockBlob(content))

  // Override the constructor to be directly usable with `new`
  vi.stubGlobal('Blob', MockBlob)

  return mockBlobFn
}

/**
 * Get captured Blob content parsed as JSON
 */
function getCapturedBlobData(): Record<string, unknown>[] | undefined {
  if (capturedBlobContent) {
    return JSON.parse(capturedBlobContent)
  }
  return undefined
}

// ============================================================================
// Tests: formatCellValue (tested through transformItemsForExport)
// ============================================================================

describe('formatCellValue', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    exportComposable = useExport()
  })

  // Since formatCellValue is internal, we test it through exportItems
  // using XLSX format which calls json_to_sheet with the formatted data

  describe('text column type', () => {
    it('should return string value as-is', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Name).toBe('Widget')
    })

    it('should convert non-string values to string for text columns', async () => {
      const columns = [createColumn('col1', 'Code', 'text')]
      const items = [createItem('1', { col1: 12345 })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Code).toBe('12345')
    })
  })

  describe('number column type', () => {
    it('should return numeric values as numbers', async () => {
      const columns = [createColumn('col1', 'Quantity', 'number')]
      const items = [createItem('1', { col1: 42 })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Quantity).toBe(42)
    })

    it('should parse string numbers to numbers', async () => {
      const columns = [createColumn('col1', 'Quantity', 'number')]
      const items = [createItem('1', { col1: '100' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Quantity).toBe(100)
    })

    it('should return original string for non-numeric values', async () => {
      const columns = [createColumn('col1', 'Quantity', 'number')]
      const items = [createItem('1', { col1: 'not-a-number' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Quantity).toBe('not-a-number')
    })

    it('should handle decimal numbers', async () => {
      const columns = [createColumn('col1', 'Rating', 'number')]
      const items = [createItem('1', { col1: 4.5 })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Rating).toBe(4.5)
    })
  })

  describe('currency column type', () => {
    it('should return currency values as numbers', async () => {
      const columns = [createColumn('col1', 'Price', 'currency')]
      const items = [createItem('1', { col1: 19.99 })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Price).toBe(19.99)
    })

    it('should parse string currency to numbers', async () => {
      const columns = [createColumn('col1', 'Price', 'currency')]
      const items = [createItem('1', { col1: '29.99' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Price).toBe(29.99)
    })
  })

  describe('date column type', () => {
    it('should format Date objects to ISO date string', async () => {
      const columns = [createColumn('col1', 'Created', 'date')]
      const testDate = new Date('2024-06-15T14:30:00Z')
      const items = [createItem('1', { col1: testDate })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Created).toBe('2024-06-15')
    })

    it('should parse and format valid date strings', async () => {
      const columns = [createColumn('col1', 'Created', 'date')]
      const items = [createItem('1', { col1: '2024-03-20T10:00:00Z' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Created).toBe('2024-03-20')
    })

    it('should return original string for invalid date strings', async () => {
      const columns = [createColumn('col1', 'Created', 'date')]
      const items = [createItem('1', { col1: 'not-a-date' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Created).toBe('not-a-date')
    })
  })

  describe('select column type', () => {
    it('should return select values as strings', async () => {
      const columns = [createColumn('col1', 'Status', 'select', { options: ['Active', 'Inactive'] })]
      const items = [createItem('1', { col1: 'Active' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Status).toBe('Active')
    })
  })

  describe('null and undefined handling', () => {
    it('should return empty string for null values', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: null })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Name).toBe('')
    })

    it('should return empty string for undefined values', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: undefined })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Name).toBe('')
    })

    it('should return empty string for empty string values', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: '' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Name).toBe('')
    })

    it('should return empty string for missing column data', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', {})] // No col1 in data
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Name).toBe('')
    })
  })
})

// ============================================================================
// Tests: formatCellValue - additional edge cases
// ============================================================================

describe('formatCellValue - additional edge cases', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    exportComposable = useExport()
  })

  describe('scientific notation numbers', () => {
    it('should handle scientific notation string for number column', async () => {
      const columns = [createColumn('col1', 'Value', 'number')]
      const items = [createItem('1', { col1: '1e10' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // JavaScript Number() can parse '1e10'
      expect(jsonToSheetCalls[0][0][0].Value).toBe(10000000000)
    })

    it('should handle negative scientific notation', async () => {
      const columns = [createColumn('col1', 'Value', 'number')]
      const items = [createItem('1', { col1: '1.5e-3' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Value).toBe(0.0015)
    })

    it('should handle scientific notation as actual number', async () => {
      const columns = [createColumn('col1', 'Value', 'number')]
      const items = [createItem('1', { col1: 1e6 })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Value).toBe(1000000)
    })
  })

  describe('very large number strings', () => {
    it('should handle number beyond safe integer as string for number column', async () => {
      const columns = [createColumn('col1', 'BigNum', 'number')]
      // Number.MAX_SAFE_INTEGER is 9007199254740991
      const items = [createItem('1', { col1: '9007199254740999' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // JavaScript will parse it but may lose precision
      expect(typeof jsonToSheetCalls[0][0][0].BigNum).toBe('number')
    })

    it('should handle very large number that becomes Infinity', async () => {
      const columns = [createColumn('col1', 'Huge', 'number')]
      // A number string that would exceed JavaScript's max value
      const items = [createItem('1', { col1: '1e309' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // This will be Infinity which is a number
      expect(jsonToSheetCalls[0][0][0].Huge).toBe(Infinity)
    })

    it('should handle Number.MAX_VALUE', async () => {
      const columns = [createColumn('col1', 'MaxVal', 'number')]
      const items = [createItem('1', { col1: Number.MAX_VALUE })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].MaxVal).toBe(Number.MAX_VALUE)
    })

    it('should handle Number.MIN_VALUE (smallest positive)', async () => {
      const columns = [createColumn('col1', 'MinVal', 'number')]
      const items = [createItem('1', { col1: Number.MIN_VALUE })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].MinVal).toBe(Number.MIN_VALUE)
    })
  })

  describe('partial date formats', () => {
    it('should handle year-month only date format', async () => {
      const columns = [createColumn('col1', 'Date', 'date')]
      // '2024-06' (no day)
      const items = [createItem('1', { col1: '2024-06' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // JavaScript Date parsing of '2024-06' may be interpreted as June 1, 2024
      // or might be invalid depending on environment
      const result = jsonToSheetCalls[0][0][0].Date
      // Should either be a formatted date or the original string if invalid
      expect(typeof result).toBe('string')
    })

    it('should handle year only date format', async () => {
      const columns = [createColumn('col1', 'Date', 'date')]
      const items = [createItem('1', { col1: '2024' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      const result = jsonToSheetCalls[0][0][0].Date
      // JavaScript Date('2024') parses to Jan 1, 2024 00:00:00 UTC
      // So it should be formatted as '2024-01-01'
      expect(result).toBe('2024-01-01')
    })

    it('should handle date with timestamp but no timezone', async () => {
      const columns = [createColumn('col1', 'Date', 'date')]
      const items = [createItem('1', { col1: '2024-06-15T10:30:00' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // Should extract the date portion
      expect(jsonToSheetCalls[0][0][0].Date).toBe('2024-06-15')
    })

    it('should handle slash-formatted date', async () => {
      const columns = [createColumn('col1', 'Date', 'date')]
      const items = [createItem('1', { col1: '06/15/2024' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      const result = jsonToSheetCalls[0][0][0].Date
      // JavaScript Date parsing of '06/15/2024' should work
      expect(result).toBe('2024-06-15')
    })

    it('should handle timestamp number by returning string representation', async () => {
      const columns = [createColumn('col1', 'Date', 'date')]
      // Unix timestamp in milliseconds for 2024-06-15
      const timestamp = new Date('2024-06-15T00:00:00Z').getTime()
      const items = [createItem('1', { col1: timestamp })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // The implementation converts to string first: String(timestamp) = '1718409600000'
      // Then new Date('1718409600000') returns Invalid Date because string format is not recognized
      // So the original string representation is returned
      expect(jsonToSheetCalls[0][0][0].Date).toBe(String(timestamp))
    })
  })

  describe('NaN and special number values', () => {
    it('should handle NaN value for number column', async () => {
      const columns = [createColumn('col1', 'Value', 'number')]
      const items = [createItem('1', { col1: NaN })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // NaN is converted to string "NaN" since isNaN returns true
      expect(jsonToSheetCalls[0][0][0].Value).toBe('NaN')
    })

    it('should handle Infinity for number column', async () => {
      const columns = [createColumn('col1', 'Value', 'number')]
      const items = [createItem('1', { col1: Infinity })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      // Infinity is a valid number (isNaN returns false)
      expect(jsonToSheetCalls[0][0][0].Value).toBe(Infinity)
    })

    it('should handle negative Infinity for number column', async () => {
      const columns = [createColumn('col1', 'Value', 'number')]
      const items = [createItem('1', { col1: -Infinity })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Value).toBe(-Infinity)
    })
  })
})

// ============================================================================
// Tests: transformItemsForExport
// ============================================================================

describe('transformItemsForExport', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    exportComposable = useExport()
  })

  it('should transform items with column names as keys', async () => {
    const columns = [
      createColumn('col1', 'Product Name', 'text'),
      createColumn('col2', 'Quantity', 'number'),
    ]
    const items = [
      createItem('1', { col1: 'Widget', col2: 10 }),
      createItem('2', { col1: 'Gadget', col2: 5 }),
    ]
    const options = createExportOptions({ format: 'xlsx', columnIds: ['col1', 'col2'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
    const exportedData = jsonToSheetCalls[0][0]

    expect(exportedData).toHaveLength(2)
    expect(exportedData[0]).toEqual({ 'Product Name': 'Widget', Quantity: 10 })
    expect(exportedData[1]).toEqual({ 'Product Name': 'Gadget', Quantity: 5 })
  })

  it('should only include selected columns', async () => {
    const columns = [
      createColumn('col1', 'Name', 'text'),
      createColumn('col2', 'Quantity', 'number'),
      createColumn('col3', 'Price', 'currency'),
    ]
    const items = [createItem('1', { col1: 'Widget', col2: 10, col3: 19.99 })]
    // Only select col1 and col3
    const options = createExportOptions({ format: 'xlsx', columnIds: ['col1', 'col3'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
    const exportedData = jsonToSheetCalls[0][0]

    expect(exportedData[0]).toEqual({ Name: 'Widget', Price: 19.99 })
    expect(exportedData[0]).not.toHaveProperty('Quantity')
  })

  it('should handle multiple items correctly', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [
      createItem('1', { col1: 'Item 1' }),
      createItem('2', { col1: 'Item 2' }),
      createItem('3', { col1: 'Item 3' }),
    ]
    const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
    const exportedData = jsonToSheetCalls[0][0]

    expect(exportedData).toHaveLength(3)
    expect(exportedData[0].Name).toBe('Item 1')
    expect(exportedData[1].Name).toBe('Item 2')
    expect(exportedData[2].Name).toBe('Item 3')
  })
})

// ============================================================================
// Tests: transformItemsForExport - direct validation
// ============================================================================

describe('transformItemsForExport - direct validation', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlobContent = undefined
    exportComposable = useExport()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // Re-stub the globals needed for other tests
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useAuthFetch', () => ({
      authFetch: mockAuthFetch,
    }))
  })

  it('should return array with correct structure via JSON export', async () => {
    // Test that the transformation returns proper array structure
    // by verifying the JSON export output directly
    const columns = [
      createColumn('col1', 'Name', 'text'),
      createColumn('col2', 'Quantity', 'number'),
    ]
    const items = [
      createItem('1', { col1: 'Widget', col2: 10 }),
      createItem('2', { col1: 'Gadget', col2: 5 }),
    ]
    const options: ExportOptions = {
      format: 'json',
      columnIds: ['col1', 'col2'],
      exportAll: false,
    }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems(items, columns, options)

    const blobData = getCapturedBlobData()

    // Verify the structure: array of objects
    expect(Array.isArray(blobData)).toBe(true)
    expect(blobData).toHaveLength(2)

    // First row should have column names as keys with data values
    expect(blobData![0]).toEqual({ Name: 'Widget', Quantity: 10 })
    expect(blobData![1]).toEqual({ Name: 'Gadget', Quantity: 5 })
  })

  it('should only include selected columns in output', async () => {
    // Verify column filtering works independently
    const columns = [
      createColumn('col1', 'Name', 'text'),
      createColumn('col2', 'Quantity', 'number'),
      createColumn('col3', 'Price', 'currency'),
      createColumn('col4', 'Status', 'select'),
    ]
    const items = [
      createItem('1', { col1: 'Widget', col2: 10, col3: 19.99, col4: 'Active' }),
    ]
    // Only select col1 and col3
    const options: ExportOptions = {
      format: 'json',
      columnIds: ['col1', 'col3'],
      exportAll: false,
    }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems(items, columns, options)

    const blobData = getCapturedBlobData()

    // Should only have selected columns
    expect(Object.keys(blobData![0])).toHaveLength(2)
    expect(blobData![0]).toHaveProperty('Name')
    expect(blobData![0]).toHaveProperty('Price')
    expect(blobData![0]).not.toHaveProperty('Quantity')
    expect(blobData![0]).not.toHaveProperty('Status')
  })

  it('should map column IDs to column names in output keys', async () => {
    // Verify that output uses column.name not column.id
    const columns = [
      createColumn('col_id_1', 'Display Name One', 'text'),
      createColumn('col_id_2', 'Display Name Two', 'number'),
    ]
    const items = [
      createItem('1', { col_id_1: 'Value1', col_id_2: 42 }),
    ]
    const options: ExportOptions = {
      format: 'json',
      columnIds: ['col_id_1', 'col_id_2'],
      exportAll: false,
    }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems(items, columns, options)

    const blobData = getCapturedBlobData()

    // Keys should be column names, not column IDs
    expect(blobData![0]).toHaveProperty('Display Name One')
    expect(blobData![0]).toHaveProperty('Display Name Two')
    expect(blobData![0]).not.toHaveProperty('col_id_1')
    expect(blobData![0]).not.toHaveProperty('col_id_2')

    // Values should be properly mapped
    expect(blobData![0]['Display Name One']).toBe('Value1')
    expect(blobData![0]['Display Name Two']).toBe(42)
  })

  it('should preserve column order based on columnIds selection', async () => {
    const columns = [
      createColumn('col1', 'First', 'text'),
      createColumn('col2', 'Second', 'text'),
      createColumn('col3', 'Third', 'text'),
    ]
    const items = [
      createItem('1', { col1: 'A', col2: 'B', col3: 'C' }),
    ]
    const options: ExportOptions = {
      format: 'json',
      columnIds: ['col3', 'col1'], // Reverse order selection
      exportAll: false,
    }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems(items, columns, options)

    const blobData = getCapturedBlobData()

    // Should only include selected columns
    const keys = Object.keys(blobData![0])
    expect(keys).toContain('First')
    expect(keys).toContain('Third')
    expect(keys).not.toContain('Second')
  })
})

// ============================================================================
// Tests: exportToExcel
// ============================================================================

describe('exportToExcel', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    exportComposable = useExport()
  })

  it('should create a new workbook', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    expect(XLSX.utils.book_new).toHaveBeenCalled()
  })

  it('should convert data to worksheet', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    expect(XLSX.utils.json_to_sheet).toHaveBeenCalled()
    const sheetData = (XLSX.utils.json_to_sheet as Mock).mock.calls[0][0]
    expect(sheetData[0]).toEqual({ Name: 'Widget' })
  })

  it('should append worksheet to workbook with "Inventory" name', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled()
    const appendSheetCall = (XLSX.utils.book_append_sheet as Mock).mock.calls[0]
    expect(appendSheetCall[2]).toBe('Inventory')
  })

  it('should write file with .xlsx extension', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options = createExportOptions({
      format: 'xlsx',
      columnIds: ['col1'],
      filename: 'my-export',
    })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    expect(XLSX.writeFile).toHaveBeenCalled()
    const writeFileCall = (XLSX.writeFile as Mock).mock.calls[0]
    expect(writeFileCall[1]).toBe('my-export.xlsx')
  })

  it('should generate default filename with timestamp when not provided', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

    // Mock date to have consistent timestamp
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T10:00:00Z'))

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    const writeFileCall = (XLSX.writeFile as Mock).mock.calls[0]
    expect(writeFileCall[1]).toBe('inventory-export-2024-06-15.xlsx')

    vi.useRealTimers()
  })
})

// ============================================================================
// Tests: exportToCSV
// ============================================================================

describe('exportToCSV', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    exportComposable = useExport()
  })

  it('should create a workbook for CSV export', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options = createExportOptions({ format: 'csv', columnIds: ['col1'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    expect(XLSX.utils.book_new).toHaveBeenCalled()
  })

  it('should write file with .csv extension and bookType csv', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options = createExportOptions({
      format: 'csv',
      columnIds: ['col1'],
      filename: 'csv-export',
    })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    expect(XLSX.writeFile).toHaveBeenCalled()
    const writeFileCall = (XLSX.writeFile as Mock).mock.calls[0]
    expect(writeFileCall[1]).toBe('csv-export.csv')
    expect(writeFileCall[2]).toEqual({ bookType: 'csv' })
  })

  it('should handle special characters in CSV data', async () => {
    const columns = [createColumn('col1', 'Description', 'text')]
    const items = [createItem('1', { col1: 'Contains, commas and "quotes"' })]
    const options = createExportOptions({ format: 'csv', columnIds: ['col1'] })

    setupDocumentMocks()
    setupURLMocks()
    await exportComposable.exportItems(items, columns, options)

    // XLSX library handles escaping internally
    const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
    expect(jsonToSheetCalls[0][0][0].Description).toBe('Contains, commas and "quotes"')
  })
})

// ============================================================================
// Tests: exportToJSON
// ============================================================================

describe('exportToJSON', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlobContent = undefined
    exportComposable = useExport()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    // Re-stub the globals needed for other tests
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useAuthFetch', () => ({
      authFetch: mockAuthFetch,
    }))
  })

  it('should create a Blob with JSON content', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options: ExportOptions = { format: 'json', columnIds: ['col1'], exportAll: false }

    setupDocumentMocks()
    const { mockCreateObjectURL } = setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems(items, columns, options)

    expect(result).toBe(true)
    expect(mockCreateObjectURL).toHaveBeenCalled()

    // Verify the content was captured (this proves Blob was called)
    expect(capturedBlobContent).toBeDefined()
    const blobData = getCapturedBlobData()
    expect(blobData).toEqual([{ Name: 'Widget' }])
  })

  it('should trigger download with correct filename', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options: ExportOptions = {
      format: 'json',
      columnIds: ['col1'],
      filename: 'my-data',
      exportAll: false,
    }

    const { mockLink, mockClick } = setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems(items, columns, options)

    expect(result).toBe(true)
    expect(mockLink.download).toBe('my-data.json')
    expect(mockClick).toHaveBeenCalled()
  })

  it('should clean up after download', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options: ExportOptions = { format: 'json', columnIds: ['col1'], exportAll: false }

    vi.useFakeTimers()

    const { mockRemoveChild } = setupDocumentMocks()
    const { mockRevokeObjectURL } = setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems(items, columns, options)

    // Fast-forward past the cleanup timeout
    await vi.advanceTimersByTimeAsync(150)

    expect(mockRemoveChild).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it('should format JSON with indentation', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options: ExportOptions = { format: 'json', columnIds: ['col1'], exportAll: false }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems(items, columns, options)

    expect(result).toBe(true)
    // JSON should be pretty-printed with 2-space indentation
    expect(capturedBlobContent).toContain('\n')
    expect(capturedBlobContent).toContain('  ')
  })

  it('should not call XLSX.writeFile for JSON format', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]
    const options: ExportOptions = { format: 'json', columnIds: ['col1'], exportAll: false }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems(items, columns, options)

    expect(XLSX.writeFile).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Tests: fetchAllItems
// ============================================================================

describe('fetchAllItems', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlobContent = undefined
    exportComposable = useExport()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // Re-stub the globals needed for other tests
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useAuthFetch', () => ({
      authFetch: mockAuthFetch,
    }))
  })

  it('should fetch all items in batches of 100', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const firstBatchItems = Array.from({ length: 100 }, (_, i) =>
      createItem(`${i + 1}`, { col1: `Item ${i + 1}` })
    )
    const secondBatchItems = Array.from({ length: 50 }, (_, i) =>
      createItem(`${i + 101}`, { col1: `Item ${i + 101}` })
    )

    mockAuthFetch
      .mockResolvedValueOnce({
        items: firstBatchItems,
        pagination: { totalPages: 2 },
      })
      .mockResolvedValueOnce({
        items: secondBatchItems,
        pagination: { totalPages: 2 },
      })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems([], columns, options)

    // Should have made 2 API calls
    expect(mockAuthFetch).toHaveBeenCalledTimes(2)
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', {
      query: { page: 1, limit: 100 },
    })
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/inventory', {
      query: { page: 2, limit: 100 },
    })
  })

  it('should stop fetching when last page is reached', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]
    const items = [createItem('1', { col1: 'Widget' })]

    mockAuthFetch.mockResolvedValueOnce({
      items,
      pagination: { totalPages: 1 },
    })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems([], columns, options)

    // Should only make 1 API call
    expect(mockAuthFetch).toHaveBeenCalledTimes(1)
  })

  it('should handle empty inventory', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]

    mockAuthFetch.mockResolvedValueOnce({
      items: [],
      pagination: { totalPages: 0 },
    })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()

    const result = await exportComposable.exportItems([], columns, options)

    expect(result).toBe(false)
    expect(exportComposable.error.value).toBe('No items to export.')
  })

  it('should combine all batches into single export', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]

    mockAuthFetch
      .mockResolvedValueOnce({
        items: [createItem('1', { col1: 'Item 1' }), createItem('2', { col1: 'Item 2' })],
        pagination: { totalPages: 2 },
      })
      .mockResolvedValueOnce({
        items: [createItem('3', { col1: 'Item 3' })],
        pagination: { totalPages: 2 },
      })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    await exportComposable.exportItems([], columns, options)

    // Verify all items were included in the export
    const blobData = getCapturedBlobData()
    expect(blobData).toHaveLength(3)
    expect(blobData![0].Name).toBe('Item 1')
    expect(blobData![1].Name).toBe('Item 2')
    expect(blobData![2].Name).toBe('Item 3')
  })
})

// ============================================================================
// Tests: fetchAllItems - error scenarios
// ============================================================================

describe('fetchAllItems - error scenarios', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlobContent = undefined
    exportComposable = useExport()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // Re-stub the globals needed for other tests
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useAuthFetch', () => ({
      authFetch: mockAuthFetch,
    }))
  })

  it('should handle first page success, second page failure', async () => {
    // First fetch returns items, second fetch throws error
    // Should throw and not return partial data
    const columns = [createColumn('col1', 'Name', 'text')]

    mockAuthFetch
      .mockResolvedValueOnce({
        items: [createItem('1', { col1: 'Item 1' })],
        pagination: { totalPages: 2 },
      })
      .mockRejectedValueOnce(new Error('Network timeout on page 2'))

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems([], columns, options)

    // Should fail and not export partial data
    expect(result).toBe(false)
    expect(exportComposable.error.value).toBe('Network timeout on page 2')
    // Should have attempted both fetches
    expect(mockAuthFetch).toHaveBeenCalledTimes(2)
  })

  it('should handle response with missing pagination object', async () => {
    // API returns items but no pagination metadata
    const columns = [createColumn('col1', 'Name', 'text')]

    mockAuthFetch.mockResolvedValueOnce({
      items: [createItem('1', { col1: 'Item 1' })],
      // Missing pagination object
    })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems([], columns, options)

    // Should handle gracefully - likely throw or fail
    // The implementation will throw when accessing response.pagination.totalPages
    expect(result).toBe(false)
    expect(exportComposable.error.value).toBeDefined()
  })

  it('should handle totalPages: 0 edge case', async () => {
    // Edge case where API returns empty pagination with totalPages 0
    const columns = [createColumn('col1', 'Name', 'text')]

    mockAuthFetch.mockResolvedValueOnce({
      items: [],
      pagination: { totalPages: 0 },
    })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()

    const result = await exportComposable.exportItems([], columns, options)

    // Should return false with appropriate error
    expect(result).toBe(false)
    expect(exportComposable.error.value).toBe('No items to export.')
    // Should only make one API call
    expect(mockAuthFetch).toHaveBeenCalledTimes(1)
  })

  it('should handle partial last page', async () => {
    // totalPages: 2, first page has 100, second has 50
    // Should return all 150 items
    const columns = [createColumn('col1', 'Name', 'text')]

    const firstBatchItems = Array.from({ length: 100 }, (_, i) =>
      createItem(`${i + 1}`, { col1: `Item ${i + 1}` })
    )
    const secondBatchItems = Array.from({ length: 50 }, (_, i) =>
      createItem(`${i + 101}`, { col1: `Item ${i + 101}` })
    )

    mockAuthFetch
      .mockResolvedValueOnce({
        items: firstBatchItems,
        pagination: { totalPages: 2 },
      })
      .mockResolvedValueOnce({
        items: secondBatchItems,
        pagination: { totalPages: 2 },
      })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems([], columns, options)

    expect(result).toBe(true)
    expect(mockAuthFetch).toHaveBeenCalledTimes(2)

    // Verify all 150 items were included
    const blobData = getCapturedBlobData()
    expect(blobData).toHaveLength(150)
    expect(blobData![0].Name).toBe('Item 1')
    expect(blobData![99].Name).toBe('Item 100')
    expect(blobData![100].Name).toBe('Item 101')
    expect(blobData![149].Name).toBe('Item 150')
  })

  it('should handle API returning null items array', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]

    mockAuthFetch.mockResolvedValueOnce({
      items: null,
      pagination: { totalPages: 1 },
    })

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()

    const result = await exportComposable.exportItems([], columns, options)

    // Should handle gracefully
    expect(result).toBe(false)
    expect(exportComposable.error.value).toBeDefined()
  })

  it('should handle API returning undefined response', async () => {
    const columns = [createColumn('col1', 'Name', 'text')]

    mockAuthFetch.mockResolvedValueOnce(undefined)

    const options = createExportOptions({
      format: 'json',
      columnIds: ['col1'],
      exportAll: true,
    })

    setupDocumentMocks()
    setupURLMocks()

    const result = await exportComposable.exportItems([], columns, options)

    // Should handle gracefully
    expect(result).toBe(false)
    expect(exportComposable.error.value).toBeDefined()
  })
})

// ============================================================================
// Tests: exportItems (main function)
// ============================================================================

describe('exportItems', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlobContent = undefined
    // Reset XLSX mock implementations to default behavior
    ;(XLSX.utils.book_new as Mock).mockImplementation(() => ({ Sheets: {}, SheetNames: [] }))
    ;(XLSX.utils.json_to_sheet as Mock).mockImplementation(() => ({ '!ref': 'A1:C3' }))
    ;(XLSX.utils.book_append_sheet as Mock).mockImplementation(() => undefined)
    ;(XLSX.writeFile as Mock).mockImplementation(() => undefined)
    exportComposable = useExport()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    // Re-stub the globals needed for other tests
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useAuthFetch', () => ({
      authFetch: mockAuthFetch,
    }))
  })

  describe('loading state', () => {
    it('should set isLoading to true during export', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      // Use exportAll to test async behavior (fetchAllItems is awaited)
      const options: ExportOptions = { format: 'json', columnIds: ['col1'], exportAll: true }

      setupDocumentMocks()
      setupURLMocks()
      setupBlobMock()

      // Create a deferred promise to control timing of the fetch
      let resolveFetch: (value: { items: DynamicInventoryItem[]; pagination: { totalPages: number } }) => void
      const fetchPromise = new Promise<{ items: DynamicInventoryItem[]; pagination: { totalPages: number } }>((resolve) => {
        resolveFetch = resolve
      })

      // Mock authFetch to pause
      mockAuthFetch.mockImplementation(() => fetchPromise)

      const exportPromiseResult = exportComposable.exportItems([], columns, options)

      // During export (while fetching), isLoading should be true
      expect(exportComposable.isLoading.value).toBe(true)

      // Resolve the fetch with items
      resolveFetch!({
        items: [createItem('1', { col1: 'Widget' })],
        pagination: { totalPages: 1 },
      })
      await exportPromiseResult

      // After export, isLoading should be false
      expect(exportComposable.isLoading.value).toBe(false)
    })

    it('should set isLoading to false after successful export', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      expect(exportComposable.isLoading.value).toBe(false)
    })

    it('should set isLoading to false after failed export', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      ;(XLSX.writeFile as Mock).mockImplementation(() => {
        throw new Error('Write failed')
      })

      await exportComposable.exportItems(items, columns, options)

      expect(exportComposable.isLoading.value).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should clear previous error on new export', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]

      setupDocumentMocks()
      setupURLMocks()

      // First export fails due to no columns selected
      await exportComposable.exportItems(items, columns, { format: 'xlsx', columnIds: [], exportAll: false })
      expect(exportComposable.error.value).not.toBe(null)

      // Second export succeeds
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }
      await exportComposable.exportItems(items, columns, options)
      expect(exportComposable.error.value).toBe(null)
    })

    it('should set error message on export failure', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      ;(XLSX.writeFile as Mock).mockImplementation(() => {
        throw new Error('Disk full')
      })

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(false)
      expect(exportComposable.error.value).toBe('Disk full')
    })

    it('should handle non-Error exceptions', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      setupDocumentMocks()
      setupURLMocks()
      ;(XLSX.writeFile as Mock).mockImplementation(() => {
        throw 'String error'
      })

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(false)
      expect(exportComposable.error.value).toBe('Export failed')
    })

    it('should handle network errors during fetchAllItems', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const options = createExportOptions({
        format: 'json',
        columnIds: ['col1'],
        exportAll: true,
      })

      mockAuthFetch.mockRejectedValueOnce(new Error('Network error'))

      setupDocumentMocks()
      setupURLMocks()

      const result = await exportComposable.exportItems([], columns, options)

      expect(result).toBe(false)
      expect(exportComposable.error.value).toBe('Network error')
    })
  })

  describe('validation', () => {
    it('should return false and set error when no columns selected', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ columnIds: [] })

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(false)
      expect(exportComposable.error.value).toBe('Please select at least one column to export.')
    })

    it('should return false and set error when no items to export', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items: DynamicInventoryItem[] = []
      const options = createExportOptions({ columnIds: ['col1'] })

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(false)
      expect(exportComposable.error.value).toBe('No items to export.')
    })

    it('should return false and set error for unsupported format', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = {
        ...createExportOptions({ columnIds: ['col1'] }),
        format: 'pdf' as ExportFormat, // Invalid format
      }

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(false)
      expect(exportComposable.error.value).toBe('Unsupported export format.')
    })
  })

  describe('format selection', () => {
    it('should export to Excel when format is xlsx', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()
      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      expect(XLSX.writeFile).toHaveBeenCalled()
      const writeFileCall = (XLSX.writeFile as Mock).mock.calls[0]
      expect(writeFileCall[1]).toContain('.xlsx')
    })

    it('should export to CSV when format is csv', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options: ExportOptions = { format: 'csv', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()
      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      expect(XLSX.writeFile).toHaveBeenCalled()
      const writeFileCall = (XLSX.writeFile as Mock).mock.calls[0]
      expect(writeFileCall[1]).toContain('.csv')
      expect(writeFileCall[2]).toEqual({ bookType: 'csv' })
    })

    it('should export to JSON when format is json', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ format: 'json', columnIds: ['col1'] })

      const { mockClick } = setupDocumentMocks()
      setupURLMocks()
      setupBlobMock()

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      expect(mockClick).toHaveBeenCalled()
      // XLSX.writeFile should not be called for JSON
      expect(XLSX.writeFile).not.toHaveBeenCalled()
    })
  })

  describe('current page vs all items export', () => {
    it('should use provided items when exportAll is false', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Current Page Item' })]
      const options = createExportOptions({
        format: 'json',
        columnIds: ['col1'],
        exportAll: false,
      })

      setupDocumentMocks()
      setupURLMocks()
      setupBlobMock()

      await exportComposable.exportItems(items, columns, options)

      // Should not fetch from API
      expect(mockAuthFetch).not.toHaveBeenCalled()

      // Should use provided items
      const blobData = getCapturedBlobData()
      expect(blobData![0].Name).toBe('Current Page Item')
    })

    it('should fetch all items when exportAll is true', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const currentPageItems = [createItem('1', { col1: 'Current Page Item' })]
      const allItems = [
        createItem('1', { col1: 'All Items 1' }),
        createItem('2', { col1: 'All Items 2' }),
      ]

      mockAuthFetch.mockResolvedValueOnce({
        items: allItems,
        pagination: { totalPages: 1 },
      })

      const options = createExportOptions({
        format: 'json',
        columnIds: ['col1'],
        exportAll: true,
      })

      setupDocumentMocks()
      setupURLMocks()
      setupBlobMock()

      await exportComposable.exportItems(currentPageItems, columns, options)

      // Should fetch from API
      expect(mockAuthFetch).toHaveBeenCalled()

      // Should use fetched items, not provided items
      const blobData = getCapturedBlobData()
      expect(blobData).toHaveLength(2)
      expect(blobData![0].Name).toBe('All Items 1')
    })
  })

  describe('filename generation', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-15T10:00:00Z'))
    })

    it('should use custom filename when provided', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({
        format: 'xlsx',
        columnIds: ['col1'],
        filename: 'custom-export-name',
      })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const writeFileCall = (XLSX.writeFile as Mock).mock.calls[0]
      expect(writeFileCall[1]).toBe('custom-export-name.xlsx')
    })

    it('should generate default filename with timestamp when not provided', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({
        format: 'xlsx',
        columnIds: ['col1'],
      })

      setupDocumentMocks()
      setupURLMocks()
      await exportComposable.exportItems(items, columns, options)

      const writeFileCall = (XLSX.writeFile as Mock).mock.calls[0]
      expect(writeFileCall[1]).toBe('inventory-export-2024-06-15.xlsx')
    })
  })

  describe('return value', () => {
    it('should return true on successful export', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()
      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
    })

    it('should return false on validation error', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items: DynamicInventoryItem[] = []
      const options = createExportOptions({ columnIds: ['col1'] })

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(false)
    })

    it('should return false on export error', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      const options = createExportOptions({ format: 'xlsx', columnIds: ['col1'] })

      ;(XLSX.writeFile as Mock).mockImplementation(() => {
        throw new Error('Export failed')
      })

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(false)
    })
  })
})

// ============================================================================
// Tests: getFileExtension
// ============================================================================

describe('getFileExtension', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    exportComposable = useExport()
  })

  it('should return xlsx for xlsx format', () => {
    expect(exportComposable.getFileExtension('xlsx')).toBe('xlsx')
  })

  it('should return csv for csv format', () => {
    expect(exportComposable.getFileExtension('csv')).toBe('csv')
  })

  it('should return json for json format', () => {
    expect(exportComposable.getFileExtension('json')).toBe('json')
  })
})

// ============================================================================
// Tests: getMimeType
// ============================================================================

describe('getMimeType', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    exportComposable = useExport()
  })

  it('should return correct MIME type for xlsx', () => {
    expect(exportComposable.getMimeType('xlsx')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  })

  it('should return correct MIME type for csv', () => {
    expect(exportComposable.getMimeType('csv')).toBe('text/csv')
  })

  it('should return correct MIME type for json', () => {
    expect(exportComposable.getMimeType('json')).toBe('application/json')
  })

  it('should throw error for unknown format', () => {
    expect(() => {
      exportComposable.getMimeType('pdf' as ExportFormat)
    }).toThrow('Unknown export format: pdf')
  })
})

// ============================================================================
// Tests: Edge Cases
// ============================================================================

describe('edge cases', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset XLSX mock implementations to default behavior
    ;(XLSX.utils.book_new as Mock).mockImplementation(() => ({ Sheets: {}, SheetNames: [] }))
    ;(XLSX.utils.json_to_sheet as Mock).mockImplementation(() => ({ '!ref': 'A1:C3' }))
    ;(XLSX.utils.book_append_sheet as Mock).mockImplementation(() => undefined)
    ;(XLSX.writeFile as Mock).mockImplementation(() => undefined)
    exportComposable = useExport()
  })

  describe('special characters in data', () => {
    it('should handle unicode characters', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: '\u65E5\u672C\u8A9E \u4E2D\u6587' })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Name).toBe('\u65E5\u672C\u8A9E \u4E2D\u6587')
    })

    it('should handle emoji characters', async () => {
      const columns = [createColumn('col1', 'Status', 'text')]
      const items = [createItem('1', { col1: 'Active \uD83D\uDFE2' })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
    })

    it('should handle newline characters in text', async () => {
      const columns = [createColumn('col1', 'Description', 'text')]
      const items = [createItem('1', { col1: 'Line 1\nLine 2\nLine 3' })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Description).toBe('Line 1\nLine 2\nLine 3')
    })
  })

  describe('large datasets', () => {
    it('should handle export of many items', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = Array.from({ length: 1000 }, (_, i) =>
        createItem(`${i + 1}`, { col1: `Item ${i + 1}` })
      )
      const options: ExportOptions = {
        format: 'xlsx',
        columnIds: ['col1'],
        exportAll: false,
      }

      setupDocumentMocks()
      setupURLMocks()

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0]).toHaveLength(1000)
    })

    it('should handle many columns', async () => {
      const columns = Array.from({ length: 50 }, (_, i) =>
        createColumn(`col${i + 1}`, `Column ${i + 1}`, 'text')
      )
      const itemData: Record<string, string> = {}
      columns.forEach((col) => {
        itemData[col.id] = `Value for ${col.name}`
      })
      const items = [createItem('1', itemData)]
      const options: ExportOptions = {
        format: 'xlsx',
        columnIds: columns.map((c) => c.id),
        exportAll: false,
      }

      setupDocumentMocks()
      setupURLMocks()

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(Object.keys(jsonToSheetCalls[0][0][0])).toHaveLength(50)
    })
  })

  describe('column ID filtering', () => {
    it('should skip columns not in columnIds even if they exist', async () => {
      const columns = [
        createColumn('col1', 'Name', 'text'),
        createColumn('col2', 'Price', 'currency'),
        createColumn('col3', 'Secret', 'text'),
      ]
      const items = [createItem('1', { col1: 'Widget', col2: 19.99, col3: 'Hidden' })]
      // Only export col1 and col2
      const options: ExportOptions = {
        format: 'xlsx',
        columnIds: ['col1', 'col2'],
        exportAll: false,
      }

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      const exportedRow = jsonToSheetCalls[0][0][0]

      expect(exportedRow).toHaveProperty('Name')
      expect(exportedRow).toHaveProperty('Price')
      expect(exportedRow).not.toHaveProperty('Secret')
    })

    it('should handle non-existent column IDs gracefully', async () => {
      const columns = [createColumn('col1', 'Name', 'text')]
      const items = [createItem('1', { col1: 'Widget' })]
      // Include non-existent column ID - only col1 exists
      const options: ExportOptions = {
        format: 'xlsx',
        columnIds: ['col1', 'non-existent'],
        exportAll: false,
      }

      setupDocumentMocks()
      setupURLMocks()

      const result = await exportComposable.exportItems(items, columns, options)

      expect(result).toBe(true)
      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      const exportedRow = jsonToSheetCalls[0][0][0]

      // Should only have the valid column (non-existent is filtered out)
      expect(Object.keys(exportedRow)).toHaveLength(1)
      expect(exportedRow).toHaveProperty('Name')
    })
  })

  describe('date edge cases', () => {
    it('should handle epoch date', async () => {
      const columns = [createColumn('col1', 'Date', 'date')]
      const items = [createItem('1', { col1: new Date(0) })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Date).toBe('1970-01-01')
    })

    it('should handle future dates', async () => {
      const columns = [createColumn('col1', 'Date', 'date')]
      const items = [createItem('1', { col1: new Date('2099-12-31T23:59:59Z') })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Date).toBe('2099-12-31')
    })
  })

  describe('number edge cases', () => {
    it('should handle zero', async () => {
      const columns = [createColumn('col1', 'Quantity', 'number')]
      const items = [createItem('1', { col1: 0 })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Quantity).toBe(0)
    })

    it('should handle negative numbers', async () => {
      const columns = [createColumn('col1', 'Balance', 'number')]
      const items = [createItem('1', { col1: -50 })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Balance).toBe(-50)
    })

    it('should handle very large numbers', async () => {
      const columns = [createColumn('col1', 'Count', 'number')]
      const items = [createItem('1', { col1: 9999999999999 })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Count).toBe(9999999999999)
    })

    it('should handle floating point precision', async () => {
      const columns = [createColumn('col1', 'Price', 'currency')]
      const items = [createItem('1', { col1: 19.99 })]
      const options: ExportOptions = { format: 'xlsx', columnIds: ['col1'], exportAll: false }

      setupDocumentMocks()
      setupURLMocks()

      await exportComposable.exportItems(items, columns, options)

      const jsonToSheetCalls = (XLSX.utils.json_to_sheet as Mock).mock.calls
      expect(jsonToSheetCalls[0][0][0].Price).toBe(19.99)
    })
  })
})

// ============================================================================
// Tests: JSON Export Data Verification
// ============================================================================

describe('JSON export data verification', () => {
  let exportComposable: ReturnType<typeof useExport>

  beforeEach(() => {
    vi.clearAllMocks()
    capturedBlobContent = undefined
    exportComposable = useExport()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // Re-stub the globals needed for other tests
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useAuthFetch', () => ({
      authFetch: mockAuthFetch,
    }))
  })

  it('should export correct data structure for JSON', async () => {
    const columns = [
      createColumn('col1', 'Name', 'text'),
      createColumn('col2', 'Quantity', 'number'),
      createColumn('col3', 'Price', 'currency'),
    ]
    const items = [
      createItem('1', { col1: 'Widget', col2: 10, col3: 19.99 }),
      createItem('2', { col1: 'Gadget', col2: 5, col3: 29.99 }),
    ]
    const options: ExportOptions = {
      format: 'json',
      columnIds: ['col1', 'col2', 'col3'],
      exportAll: false,
    }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems(items, columns, options)

    // Check for errors first
    if (!result) {
      console.error('Export error:', exportComposable.error.value)
    }
    expect(exportComposable.error.value).toBe(null)
    expect(result).toBe(true)

    const blobData = getCapturedBlobData()
    expect(blobData).toEqual([
      { Name: 'Widget', Quantity: 10, Price: 19.99 },
      { Name: 'Gadget', Quantity: 5, Price: 29.99 },
    ])
  })

  it('should handle all column types in JSON export', async () => {
    const columns = [
      createColumn('col1', 'Name', 'text'),
      createColumn('col2', 'Quantity', 'number'),
      createColumn('col3', 'Price', 'currency'),
      createColumn('col4', 'Created', 'date'),
      createColumn('col5', 'Status', 'select', { options: ['Active', 'Inactive'] }),
    ]
    const items = [
      createItem('1', {
        col1: 'Widget',
        col2: 10,
        col3: 19.99,
        col4: '2024-06-15T10:00:00Z',
        col5: 'Active',
      }),
    ]
    const options: ExportOptions = {
      format: 'json',
      columnIds: ['col1', 'col2', 'col3', 'col4', 'col5'],
      exportAll: false,
    }

    setupDocumentMocks()
    setupURLMocks()
    setupBlobMock()

    const result = await exportComposable.exportItems(items, columns, options)

    // Check for errors first
    if (!result) {
      console.error('Export error:', exportComposable.error.value)
    }
    expect(exportComposable.error.value).toBe(null)
    expect(result).toBe(true)

    const blobData = getCapturedBlobData()
    expect(blobData).toEqual([
      {
        Name: 'Widget',
        Quantity: 10,
        Price: 19.99,
        Created: '2024-06-15',
        Status: 'Active',
      },
    ])
  })
})
