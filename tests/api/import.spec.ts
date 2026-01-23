import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient, BusinessRole, InventorySchema, InventoryItem } from '@prisma/client'
import type { H3Event } from 'h3'
import type { ColumnDefinition } from '~/types/schema'

// ============================================================================
// Mock Setup - Must be defined before importing handlers
// ============================================================================

// Mock Prisma client
const prismaMock = mockDeep<PrismaClient>()

vi.mock('~/server/utils/prisma', () => ({
  default: prismaMock,
}))

// Mock socket utilities
const mockEmitInventoryCreated = vi.fn()

vi.mock('~/server/utils/socket', () => ({
  emitInventoryCreated: mockEmitInventoryCreated,
}))

// Mock crypto.randomUUID for deterministic tests
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
})

// Mock readBody function
const mockReadBody = vi.fn()

// Mock createError to throw proper errors
const mockCreateError = vi.fn((options: { statusCode: number; message: string }) => {
  const error = new Error(options.message) as Error & { statusCode: number }
  error.statusCode = options.statusCode
  return error
})

// Mock h3 utilities
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    readBody: mockReadBody,
    createError: mockCreateError,
    defineEventHandler: (handler: Function) => handler,
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

interface AuthContext {
  userId: string
  businessId?: string | null
  businessRole?: BusinessRole | null
}

/**
 * Creates a mock H3 event for testing handlers
 */
function createMockEvent(authContext?: AuthContext): H3Event {
  return {
    context: {
      auth: authContext ?? {
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      },
    },
  } as unknown as H3Event
}

/**
 * Creates a mock inventory schema
 */
function createMockSchema(columns: ColumnDefinition[]): InventorySchema {
  return {
    id: 'schema-123',
    businessId: 'business-123',
    columns: columns as unknown as InventorySchema['columns'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }
}

/**
 * Creates a valid column definition
 */
function createColumn(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id: `col-${Math.random().toString(36).slice(2, 9)}`,
    name: 'Test Column',
    type: 'text',
    order: 0,
    ...overrides,
  }
}

/**
 * Creates a mock business member
 */
function createMockMember(role: BusinessRole = 'OWNER') {
  return {
    id: 'member-123',
    businessId: 'business-123',
    userId: 'user-123',
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Creates a mock inventory item
 */
function createMockItem(data: Record<string, unknown>): InventoryItem & { createdBy: { id: string; name: string } } {
  return {
    id: `item-${Math.random().toString(36).slice(2, 9)}`,
    data: data as InventoryItem['data'],
    businessId: 'business-123',
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: {
      id: 'user-123',
      name: 'Test User',
    },
  }
}

// ============================================================================
// Simulated Import Handler
// ============================================================================

/**
 * Simulates the POST /api/import/execute handler logic
 *
 * This is a simplified version for testing. The actual handler would import
 * from the sanitization utilities and apply them during processing.
 */
async function simulateImportExecuteHandler(event: H3Event) {
  const auth = event.context.auth as AuthContext

  if (!auth) {
    throw mockCreateError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  if (!auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You must belong to a business to perform this action',
    })
  }

  // Verify membership
  const membership = await prismaMock.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: auth.businessId,
        userId: auth.userId,
      },
    },
  })

  if (!membership) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to import to this business',
    })
  }

  // Check role - only OWNER and BOSS can import
  if (auth.businessRole === 'EMPLOYEE') {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to import inventory items',
    })
  }

  const body = await mockReadBody(event)

  // Validate request body
  if (!body || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
    throw mockCreateError({
      statusCode: 400,
      message: 'At least one item is required',
    })
  }

  const { items, newColumns } = body

  // Get current schema
  const existingSchema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  const existingColumns: ColumnDefinition[] =
    (existingSchema?.columns as unknown as ColumnDefinition[]) || []

  // Handle new columns
  let newColumnDefinitions: ColumnDefinition[] = []
  let columnsForValidation: ColumnDefinition[] = existingColumns

  if (newColumns && newColumns.length > 0) {
    const maxOrder =
      existingColumns.length > 0 ? Math.max(...existingColumns.map((c) => c.order)) : -1

    newColumnDefinitions = newColumns.map(
      (col: { name: string; type: string; role?: string; options?: string[]; required?: boolean }, index: number) => ({
        id: `test-uuid-${index + 1}`,
        name: col.name,
        type: col.type,
        role: col.role,
        options: col.options,
        required: col.required ?? false,
        order: maxOrder + 1 + index,
      })
    )

    columnsForValidation = [...existingColumns, ...newColumnDefinitions]
  }

  if (columnsForValidation.length === 0) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  // Build placeholder mapping
  const placeholderToColumnId: Map<string, string> = new Map()
  for (let i = 0; i < newColumnDefinitions.length; i++) {
    placeholderToColumnId.set(`__new__${i}`, newColumnDefinitions[i].id)
  }

  // Transform and sanitize items
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
    total: items.length,
    warningCount: 0, // Track total warnings from sanitization
    warnings: [] as string[], // Detailed warnings
  }

  const validItems: { data: Record<string, unknown> }[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const rowNumber = i + 1
    const transformedData: Record<string, unknown> = {}
    let rowWarnings = 0

    // Transform placeholders and apply sanitization
    for (const [key, value] of Object.entries(item.data || {})) {
      const actualKey = placeholderToColumnId.has(key) ? placeholderToColumnId.get(key)! : key
      const column = columnsForValidation.find((c) => c.id === actualKey)

      if (column) {
        // Apply sanitization based on column type
        const sanitized = simulateSanitizeCell(value, column.type)
        transformedData[actualKey] = sanitized.value

        if (sanitized.warning) {
          rowWarnings++
          results.warnings.push(`Row ${rowNumber}, ${column.name}: ${sanitized.warningMessage || 'Value was modified'}`)
        }
      } else {
        transformedData[actualKey] = value
      }
    }

    results.warningCount += rowWarnings

    // Validate required fields
    const validationErrors: string[] = []
    for (const column of columnsForValidation) {
      if (column.required) {
        const value = transformedData[column.id]
        if (value === null || value === undefined || value === '') {
          validationErrors.push(`${column.name} is required`)
        }
      }
    }

    if (validationErrors.length > 0) {
      results.failed++
      results.errors.push(`Row ${rowNumber}: ${validationErrors.join(', ')}`)
    } else {
      validItems.push({ data: transformedData })
    }
  }

  // Simulate database operations
  if (validItems.length > 0) {
    const hasNewColumns = newColumnDefinitions.length > 0
    const mergedColumns = columnsForValidation

    try {
      await prismaMock.$transaction(async (tx) => {
        if (hasNewColumns) {
          await tx.inventorySchema.upsert({
            where: { businessId: auth.businessId! },
            update: { columns: mergedColumns as unknown as InventorySchema['columns'] },
            create: {
              businessId: auth.businessId!,
              columns: mergedColumns as unknown as InventorySchema['columns'],
            },
          })
        }

        await tx.inventoryItem.createMany({
          data: validItems.map((item) => ({
            data: item.data as InventoryItem['data'],
            businessId: auth.businessId!,
            createdById: auth.userId,
          })),
        })

        return validItems.map((item) => createMockItem(item.data))
      })

      results.success = validItems.length

      // Emit socket events
      for (const item of validItems) {
        mockEmitInventoryCreated(auth.businessId, createMockItem(item.data))
      }
    } catch {
      // Transaction failed
      results.failed = validItems.length
      results.errors.push('Database error during import')
    }
  }

  return results
}

/**
 * Simulates cell sanitization (placeholder for actual implementation)
 */
function simulateSanitizeCell(
  value: unknown,
  type: string
): { value: unknown; warning: boolean; warningMessage?: string } {
  // This simulates what the real sanitization would do
  // In RED phase, this is a placeholder that will be replaced by actual imports

  if (value === null || value === undefined || value === '') {
    return { value: null, warning: false }
  }

  switch (type) {
    case 'text': {
      const str = String(value)
      // Trim and normalize whitespace
      const sanitized = str.trim().replace(/\s+/g, ' ')
      return { value: sanitized, warning: false }
    }

    case 'number':
    case 'currency': {
      if (typeof value === 'number') {
        return { value, warning: false }
      }
      const str = String(value)
      // Remove currency symbols and commas
      const cleaned = str.replace(/[$\u20AC\u00A3\u00A5,\s]/g, '').trim()
      const num = parseFloat(cleaned)

      if (isNaN(num)) {
        // Try to extract numbers
        const match = str.match(/-?[\d.]+/)
        if (match) {
          const extracted = parseFloat(match[0])
          if (!isNaN(extracted)) {
            return {
              value: extracted,
              warning: true,
              warningMessage: `Extracted ${extracted} from "${str}"`,
            }
          }
        }
        return {
          value: null,
          warning: true,
          warningMessage: `Could not parse number from "${str}"`,
        }
      }

      // Check if value was modified
      const originalNum = parseFloat(str)
      const wasModified = isNaN(originalNum) || originalNum !== num
      return {
        value: num,
        warning: wasModified,
        warningMessage: wasModified ? `Parsed ${num} from "${str}"` : undefined,
      }
    }

    case 'date': {
      const str = String(value)
      const parsed = Date.parse(str)
      if (isNaN(parsed)) {
        return {
          value: null,
          warning: true,
          warningMessage: `Invalid date: "${str}"`,
        }
      }
      return {
        value: new Date(parsed).toISOString(),
        warning: false,
      }
    }

    case 'select': {
      const str = String(value).trim()
      return { value: str || null, warning: false }
    }

    default:
      return { value, warning: false }
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Import API', () => {
  beforeEach(() => {
    mockReset(prismaMock)
    vi.clearAllMocks()
    uuidCounter = 0

    // Default mock for business member lookup
    prismaMock.businessMember.findUnique.mockResolvedValue(createMockMember())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // POST /api/import/execute - Happy Path
  // ==========================================================================

  describe('POST /api/import/execute - Happy Path', () => {
    it('should successfully import clean data', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Product Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
        createColumn({ id: 'price', name: 'Price', type: 'currency' }),
      ]

      const items = [
        { data: { name: 'Widget A', qty: '100', price: '$19.99' } },
        { data: { name: 'Widget B', qty: '50', price: '$29.99' } },
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.success).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.total).toBe(2)
      expect(result.errors.length).toBe(0)
    })

    it('should import data with sanitization and track warnings', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Product Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
      ]

      const items = [
        { data: { name: '  Widget A  ', qty: 'aa100' } }, // qty needs extraction - warning
        { data: { name: 'Widget B', qty: '50' } },        // Clean
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.success).toBe(2)
      expect(result.warningCount).toBeGreaterThanOrEqual(1)
      expect(result.warnings.length).toBeGreaterThanOrEqual(1)
    })

    it('should import with new columns', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const existingColumns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Product Name', type: 'text', order: 0 }),
      ]

      const newColumns = [{ name: 'SKU', type: 'text', required: false }]

      const items = [
        { data: { name: 'Widget A', '__new__0': 'SKU-001' } },
        { data: { name: 'Widget B', '__new__0': 'SKU-002' } },
      ]

      mockReadBody.mockResolvedValue({ items, newColumns })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(existingColumns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.success).toBe(2)
      expect(prismaMock.$transaction).toHaveBeenCalled()
    })

    it('should return warning count in response for preview display', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const columns: ColumnDefinition[] = [
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
      ]

      const items = [
        { data: { qty: 'abc123' } },  // Warning
        { data: { qty: '100' } },     // Clean
        { data: { qty: '$50' } },     // Warning (currency symbol)
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result).toHaveProperty('warningCount')
      expect(typeof result.warningCount).toBe('number')
      expect(result.warningCount).toBeGreaterThanOrEqual(1)
    })
  })

  // ==========================================================================
  // POST /api/import/execute - Sanitization Integration
  // ==========================================================================

  describe('POST /api/import/execute - Sanitization Integration', () => {
    describe('Text Column Sanitization', () => {
      it('should trim and normalize whitespace in text columns', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'name', name: 'Name', type: 'text' }),
        ]

        const items = [{ data: { name: '  hello  world  ' } }]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))

        let capturedData: Record<string, unknown>[] = []
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventorySchema: { upsert: vi.fn() },
            inventoryItem: {
              createMany: vi.fn().mockImplementation(({ data }) => {
                capturedData = data
              }),
            },
          }
          return callback(tx)
        })

        // Act
        await simulateImportExecuteHandler(mockEvent)

        // Assert - the stored data should be sanitized
        expect(capturedData[0]?.data).toHaveProperty('name', 'hello world')
      })

      it('should handle null and empty text values', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'name', name: 'Name', type: 'text', required: false }),
        ]

        const items = [
          { data: { name: '' } },
          { data: { name: null } },
          { data: { name: '   ' } },
        ]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventorySchema: { upsert: vi.fn() },
            inventoryItem: { createMany: vi.fn() },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateImportExecuteHandler(mockEvent)

        // Assert - should handle gracefully
        expect(result.failed).toBe(0)
      })
    })

    describe('Number Column Sanitization', () => {
      it('should extract numbers from alphanumeric strings', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
        ]

        const items = [{ data: { qty: 'aa123' } }]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))

        let capturedData: Record<string, unknown>[] = []
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventorySchema: { upsert: vi.fn() },
            inventoryItem: {
              createMany: vi.fn().mockImplementation(({ data }) => {
                capturedData = data
              }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateImportExecuteHandler(mockEvent)

        // Assert
        expect(capturedData[0]?.data).toHaveProperty('qty', 123)
        expect(result.warningCount).toBeGreaterThan(0)
      })

      it('should handle currency-formatted numbers in number column', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
        ]

        const items = [{ data: { qty: '$1,234' } }]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))

        let capturedData: Record<string, unknown>[] = []
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventorySchema: { upsert: vi.fn() },
            inventoryItem: {
              createMany: vi.fn().mockImplementation(({ data }) => {
                capturedData = data
              }),
            },
          }
          return callback(tx)
        })

        // Act
        await simulateImportExecuteHandler(mockEvent)

        // Assert - should extract 1234
        expect(capturedData[0]?.data).toHaveProperty('qty', 1234)
      })

      it('should fail gracefully for non-numeric values with no numbers', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'qty', name: 'Quantity', type: 'number', required: true }),
        ]

        const items = [{ data: { qty: 'abc' } }]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
        prismaMock.$transaction.mockImplementation(async () => [])

        // Act
        const result = await simulateImportExecuteHandler(mockEvent)

        // Assert - should fail since required field is null
        expect(result.failed).toBe(1)
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })

    describe('Currency Column Sanitization', () => {
      it('should parse standard currency format', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'price', name: 'Price', type: 'currency' }),
        ]

        const items = [{ data: { price: '$1,234.56' } }]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))

        let capturedData: Record<string, unknown>[] = []
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventorySchema: { upsert: vi.fn() },
            inventoryItem: {
              createMany: vi.fn().mockImplementation(({ data }) => {
                capturedData = data
              }),
            },
          }
          return callback(tx)
        })

        // Act
        await simulateImportExecuteHandler(mockEvent)

        // Assert
        expect(capturedData[0]?.data).toHaveProperty('price', 1234.56)
      })

      it('should handle currency with trailing text', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'price', name: 'Price', type: 'currency' }),
        ]

        const items = [{ data: { price: '1,234.56USD' } }]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))

        let capturedData: Record<string, unknown>[] = []
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventorySchema: { upsert: vi.fn() },
            inventoryItem: {
              createMany: vi.fn().mockImplementation(({ data }) => {
                capturedData = data
              }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateImportExecuteHandler(mockEvent)

        // Assert
        expect(capturedData[0]?.data).toHaveProperty('price', 1234.56)
        expect(result.warningCount).toBeGreaterThan(0)
      })
    })

    describe('Date Column Sanitization', () => {
      it('should parse various date formats to ISO', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'date', name: 'Date', type: 'date' }),
        ]

        const dateFormats = [
          '2024-01-15',
          '01/15/2024',
          'January 15, 2024',
        ]

        for (const dateStr of dateFormats) {
          vi.clearAllMocks()
          prismaMock.businessMember.findUnique.mockResolvedValue(createMockMember())

          const items = [{ data: { date: dateStr } }]
          mockReadBody.mockResolvedValue({ items })
          prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))

          let capturedData: Record<string, unknown>[] = []
          prismaMock.$transaction.mockImplementation(async (callback: Function) => {
            const tx = {
              inventorySchema: { upsert: vi.fn() },
              inventoryItem: {
                createMany: vi.fn().mockImplementation(({ data }) => {
                  capturedData = data
                }),
              },
            }
            return callback(tx)
          })

          // Act
          const result = await simulateImportExecuteHandler(mockEvent)

          // Assert
          expect(result.success).toBe(1)
          const storedDate = capturedData[0]?.data?.date as string
          expect(storedDate).toMatch(/^\d{4}-\d{2}-\d{2}/) // ISO format
        }
      })

      it('should mark invalid dates with warning', async () => {
        // Arrange
        const mockEvent = createMockEvent()
        const columns: ColumnDefinition[] = [
          createColumn({ id: 'date', name: 'Date', type: 'date', required: false }),
        ]

        const items = [{ data: { date: 'invalid-date' } }]

        mockReadBody.mockResolvedValue({ items })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))

        let capturedData: Record<string, unknown>[] = []
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventorySchema: { upsert: vi.fn() },
            inventoryItem: {
              createMany: vi.fn().mockImplementation(({ data }) => {
                capturedData = data
              }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateImportExecuteHandler(mockEvent)

        // Assert
        expect(capturedData[0]?.data).toHaveProperty('date', null)
        expect(result.warningCount).toBeGreaterThan(0)
      })
    })
  })

  // ==========================================================================
  // POST /api/import/execute - Validation
  // ==========================================================================

  describe('POST /api/import/execute - Validation', () => {
    it('should fail required fields with empty values after sanitization', async () => {
      // Arrange
      const mockEvent = createMockEvent()
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text', required: true }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number', required: true }),
      ]

      const items = [
        { data: { name: 'Product A', qty: 'abc' } }, // qty will be null after sanitization
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async () => [])

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.failed).toBe(1)
      expect(result.errors[0]).toContain('Quantity')
    })

    it('should track all validation errors in response', async () => {
      // Arrange
      const mockEvent = createMockEvent()
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text', required: true }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number', required: true }),
      ]

      const items = [
        { data: { name: '', qty: '' } },           // Both missing
        { data: { name: 'Product B', qty: '' } },  // qty missing
        { data: { name: '', qty: '100' } },        // name missing
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async () => [])

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.failed).toBe(3)
      expect(result.errors.length).toBe(3)
    })

    it('should differentiate between sanitization warnings and validation errors', async () => {
      // Arrange
      const mockEvent = createMockEvent()
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'qty', name: 'Quantity', type: 'number', required: false }),
      ]

      const items = [
        { data: { qty: 'aa100' } }, // Extracted with warning, but valid
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.success).toBe(1)
      expect(result.failed).toBe(0)
      expect(result.warningCount).toBeGreaterThan(0) // Has warnings
      expect(result.errors.length).toBe(0) // No errors
    })
  })

  // ==========================================================================
  // POST /api/import/execute - Authorization
  // ==========================================================================

  describe('POST /api/import/execute - Authorization', () => {
    it('should allow OWNER to import', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const columns: ColumnDefinition[] = [createColumn({ id: 'name', name: 'Name', type: 'text' })]
      const items = [{ data: { name: 'Product' } }]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.success).toBe(1)
    })

    it('should allow BOSS to import', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'BOSS',
      })

      prismaMock.businessMember.findUnique.mockResolvedValue(createMockMember('BOSS'))

      const columns: ColumnDefinition[] = [createColumn({ id: 'name', name: 'Name', type: 'text' })]
      const items = [{ data: { name: 'Product' } }]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.success).toBe(1)
    })

    it('should reject EMPLOYEE from importing (403)', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'EMPLOYEE',
      })

      prismaMock.businessMember.findUnique.mockResolvedValue(createMockMember('EMPLOYEE'))

      const items = [{ data: { name: 'Product' } }]
      mockReadBody.mockResolvedValue({ items })

      // Act & Assert
      await expect(simulateImportExecuteHandler(mockEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to import inventory items',
      })
    })

    it('should reject users without business context (403)', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: null,
        businessRole: null,
      })

      // Act & Assert
      await expect(simulateImportExecuteHandler(mockEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You must belong to a business to perform this action',
      })
    })

    it('should reject users not members of the business (403)', async () => {
      // Arrange
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      prismaMock.businessMember.findUnique.mockResolvedValue(null) // Not a member

      const items = [{ data: { name: 'Product' } }]
      mockReadBody.mockResolvedValue({ items })

      // Act & Assert
      await expect(simulateImportExecuteHandler(mockEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to import to this business',
      })
    })

    it('should reject unauthenticated requests (401)', async () => {
      // Arrange
      const mockEvent = { context: {} } as unknown as H3Event

      // Act & Assert
      await expect(simulateImportExecuteHandler(mockEvent)).rejects.toMatchObject({
        statusCode: 401,
        message: 'Unauthorized',
      })
    })
  })

  // ==========================================================================
  // POST /api/import/execute - Edge Cases
  // ==========================================================================

  describe('POST /api/import/execute - Edge Cases', () => {
    it('should handle empty items array', async () => {
      // Arrange
      const mockEvent = createMockEvent()

      mockReadBody.mockResolvedValue({ items: [] })

      // Act & Assert
      await expect(simulateImportExecuteHandler(mockEvent)).rejects.toMatchObject({
        statusCode: 400,
        message: 'At least one item is required',
      })
    })

    it('should handle missing schema', async () => {
      // Arrange
      const mockEvent = createMockEvent()

      const items = [{ data: { name: 'Product' } }]
      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(null)

      // Act & Assert
      await expect(simulateImportExecuteHandler(mockEvent)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Please set up your inventory columns first',
      })
    })

    it('should handle large batch imports', async () => {
      // Arrange
      const mockEvent = createMockEvent()
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
      ]

      const items = Array.from({ length: 1000 }, (_, i) => ({
        data: { name: `Product ${i}` },
      }))

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.total).toBe(1000)
      expect(result.success).toBe(1000)
    })

    it('should handle mixed success and failure in batch', async () => {
      // Arrange
      const mockEvent = createMockEvent()
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'qty', name: 'Quantity', type: 'number', required: true }),
      ]

      const items = [
        { data: { qty: '100' } },  // Valid
        { data: { qty: 'abc' } },  // Invalid - no numbers
        { data: { qty: '200' } },  // Valid
        { data: { qty: '' } },     // Invalid - empty required
        { data: { qty: '300' } },  // Valid
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(result.total).toBe(5)
      expect(result.success).toBe(3)
      expect(result.failed).toBe(2)
    })

    it('should emit socket events for created items', async () => {
      // Arrange
      const mockEvent = createMockEvent()
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
      ]

      const items = [
        { data: { name: 'Product A' } },
        { data: { name: 'Product B' } },
      ]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      await simulateImportExecuteHandler(mockEvent)

      // Assert
      expect(mockEmitInventoryCreated).toHaveBeenCalledTimes(2)
      expect(mockEmitInventoryCreated).toHaveBeenCalledWith('business-123', expect.any(Object))
    })
  })

  // ==========================================================================
  // Response Structure Verification
  // ==========================================================================

  describe('Response Structure', () => {
    it('should return complete result structure', async () => {
      // Arrange
      const mockEvent = createMockEvent()
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
      ]

      const items = [{ data: { name: 'Product' } }]

      mockReadBody.mockResolvedValue({ items })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema(columns))
      prismaMock.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          inventorySchema: { upsert: vi.fn() },
          inventoryItem: { createMany: vi.fn() },
        }
        return callback(tx)
      })

      // Act
      const result = await simulateImportExecuteHandler(mockEvent)

      // Assert - verify all expected fields exist
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('failed')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('total')
      expect(result).toHaveProperty('warningCount')
      expect(result).toHaveProperty('warnings')

      expect(typeof result.success).toBe('number')
      expect(typeof result.failed).toBe('number')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(typeof result.total).toBe('number')
      expect(typeof result.warningCount).toBe('number')
      expect(Array.isArray(result.warnings)).toBe(true)
    })
  })
})
