import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient, User, InventorySchema, BusinessRole } from '@prisma/client'
import type { H3Event } from 'h3'

// ============================================================================
// Mock Setup - Must be defined before importing handlers
// ============================================================================

// Mock Prisma client
const prismaMock = mockDeep<PrismaClient>()

vi.mock('~/server/utils/prisma', () => ({
  default: prismaMock,
}))

// Mock socket utilities
const mockEmitInventoryReset = vi.fn()

vi.mock('~/server/utils/socket', () => ({
  emitInventoryReset: mockEmitInventoryReset,
}))

// Mock inventory log utilities
const mockCreateInventoryLog = vi.fn()
const mockDiffSchemaChanges = vi.fn()

vi.mock('~/server/utils/inventoryLog', () => ({
  createInventoryLog: mockCreateInventoryLog,
  diffSchemaChanges: mockDiffSchemaChanges,
}))

// Mock readBody function
const mockReadBody = vi.fn()

// Mock createError to throw proper errors
const mockCreateError = vi.fn((options: { statusCode: number; message: string }) => {
  const error = new Error(options.message) as Error & { statusCode: number }
  error.statusCode = options.statusCode
  return error
})

// Mock h3 utilities used by the handlers
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    readBody: mockReadBody,
    createError: mockCreateError,
    defineEventHandler: (handler: Function) => handler,
  }
})

// Import validation schemas for direct testing
import { inventorySchemaUpdateSchema, columnDefinitionSchema } from '~/server/utils/validation'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock H3 event for testing handlers
 */
function createMockEvent(authContext?: {
  userId: string
  businessId?: string | null
  businessRole?: BusinessRole | null
}): H3Event {
  return {
    context: {
      auth: authContext ?? { userId: 'user-123', businessId: 'business-123', businessRole: 'OWNER' },
    },
  } as unknown as H3Event
}

/**
 * Creates a mock user with default values
 */
function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    password: 'hashed-password-xyz',
    name: 'Test User',
    role: 'USER',
    googleId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Creates a mock inventory schema with default values
 */
function createMockSchema(overrides: Partial<InventorySchema> = {}): InventorySchema {
  return {
    id: 'schema-123',
    businessId: 'business-123',
    columns: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Creates a valid column definition for testing
 */
function createValidColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Product Name',
    type: 'text',
    order: 0,
    ...overrides,
  }
}

/**
 * Generates a valid UUID for testing
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ============================================================================
// Simulated Handlers
// ============================================================================

/**
 * Simulates the GET /api/schema handler logic for testing
 */
async function simulateGetSchemaHandler(event: H3Event) {
  const auth = event.context.auth as { userId: string; businessId?: string | null }

  if (!auth) {
    throw mockCreateError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  // Require business context
  if (!auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You must belong to a business to perform this action',
    })
  }

  const schema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  // Return empty columns array if no schema exists yet
  return schema || { columns: [] }
}

/**
 * Simulates the PUT /api/schema handler logic for testing
 */
async function simulateUpdateSchemaHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }

  if (!auth) {
    throw mockCreateError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  // Require business context
  if (!auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You must belong to a business to perform this action',
    })
  }

  // Require OWNER role
  if (!auth.businessRole || auth.businessRole !== 'OWNER') {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to edit schema',
    })
  }

  const body = await mockReadBody(event)

  // Validate columns structure
  const result = inventorySchemaUpdateSchema.safeParse(body)
  if (!result.success) {
    throw mockCreateError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  // Validate role uniqueness - each role can only be assigned once
  const roles = result.data.columns.filter((c) => c.role).map((c) => c.role)
  if (new Set(roles).size !== roles.length) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Each role can only be assigned to one column',
    })
  }

  // Validate select columns have options
  for (const column of result.data.columns) {
    if (column.type === 'select' && (!column.options || column.options.length === 0)) {
      throw mockCreateError({
        statusCode: 400,
        message: `Column "${column.name}" is a select type but has no options`,
      })
    }
  }

  // Get existing schema for comparison
  const existingSchema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })
  const oldColumns = (existingSchema?.columns as unknown[]) || []

  // Upsert schema
  const schema = await prismaMock.inventorySchema.upsert({
    where: { businessId: auth.businessId },
    update: { columns: result.data.columns },
    create: {
      businessId: auth.businessId,
      columns: result.data.columns,
    },
  })

  // Log schema changes
  const schemaChanges = mockDiffSchemaChanges(oldColumns, result.data.columns)
  if (schemaChanges && schemaChanges.length > 0) {
    await mockCreateInventoryLog({
      action: 'SCHEMA_UPDATED',
      businessId: auth.businessId,
      userId: auth.userId,
      schemaChanges,
      undoable: false,
    })
  }

  return schema
}

/**
 * Simulates the POST /api/schema/reset handler logic for testing
 */
async function simulateResetInventoryHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }

  if (!auth) {
    throw mockCreateError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  // Require business context
  if (!auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You must belong to a business to perform this action',
    })
  }

  // Require OWNER role
  if (!auth.businessRole || auth.businessRole !== 'OWNER') {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to reset inventory',
    })
  }

  // Use a transaction to ensure all operations succeed or fail together
  const result = await prismaMock.$transaction(async (tx: typeof prismaMock) => {
    // Delete all inventory items for this business
    const deletedItems = await tx.inventoryItem.deleteMany({
      where: { businessId: auth.businessId! },
    })

    // Delete the inventory schema (columns) for this business
    const deletedSchema = await tx.inventorySchema.deleteMany({
      where: { businessId: auth.businessId! },
    })

    // Delete all inventory logs for this business
    const deletedLogs = await tx.inventoryLog.deleteMany({
      where: { businessId: auth.businessId! },
    })

    // Delete all operations for this business
    const deletedOperations = await tx.operation.deleteMany({
      where: { businessId: auth.businessId! },
    })

    return {
      deletedItemsCount: deletedItems.count,
      schemaDeleted: deletedSchema.count > 0,
      deletedLogsCount: deletedLogs.count,
      deletedOperationsCount: deletedOperations.count,
    }
  }) as { deletedItemsCount: number; schemaDeleted: boolean; deletedLogsCount: number; deletedOperationsCount: number }

  // Emit socket event to notify other clients
  mockEmitInventoryReset(auth.businessId!)

  return {
    success: true,
    message: 'Inventory has been reset successfully',
    deletedItemsCount: result.deletedItemsCount,
    schemaDeleted: result.schemaDeleted,
    deletedLogsCount: result.deletedLogsCount,
    deletedOperationsCount: result.deletedOperationsCount,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Schema API', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockReset(prismaMock)
    vi.clearAllMocks()

    // Setup default mock return values
    mockDiffSchemaChanges.mockReturnValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // GET /api/schema
  // ==========================================================================

  describe('GET /api/schema', () => {
    describe('Happy Path', () => {
      it('should return schema with columns when schema exists', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const existingSchema = createMockSchema({
          columns: [
            createValidColumn({ id: generateUUID(), name: 'Name', type: 'text', order: 0 }),
            createValidColumn({ id: generateUUID(), name: 'Quantity', type: 'number', order: 1 }),
          ] as unknown as [],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(existingSchema)

        // Act
        const result = await simulateGetSchemaHandler(mockEvent)

        // Assert
        expect(result).toEqual(existingSchema)
        expect(prismaMock.inventorySchema.findUnique).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
      })

      it('should return empty columns array when no schema exists', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)

        // Act
        const result = await simulateGetSchemaHandler(mockEvent)

        // Assert
        expect(result).toEqual({ columns: [] })
      })

      it('should allow any role to read schema (OWNER, BOSS, EMPLOYEE)', async () => {
        // Arrange - test with each role
        const roles: BusinessRole[] = ['OWNER', 'BOSS', 'EMPLOYEE']

        for (const role of roles) {
          vi.clearAllMocks()

          const mockEvent = createMockEvent({
            userId: 'user-123',
            businessId: 'business-123',
            businessRole: role,
          })

          const existingSchema = createMockSchema()
          prismaMock.inventorySchema.findUnique.mockResolvedValue(existingSchema)

          // Act
          const result = await simulateGetSchemaHandler(mockEvent)

          // Assert - should succeed for all roles
          expect(result).toEqual(existingSchema)
        }
      })

      it('should query with correct businessId from auth context', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-456',
          businessId: 'specific-business-id',
          businessRole: 'OWNER',
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)

        // Act
        await simulateGetSchemaHandler(mockEvent)

        // Assert
        expect(prismaMock.inventorySchema.findUnique).toHaveBeenCalledWith({
          where: { businessId: 'specific-business-id' },
        })
      })
    })

    describe('Authentication Errors', () => {
      it('should return 401 when no auth context exists', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event

        // Act & Assert
        await expect(simulateGetSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })

        expect(prismaMock.inventorySchema.findUnique).not.toHaveBeenCalled()
      })

      it('should return 401 when auth is null', async () => {
        // Arrange
        const mockEvent = { context: { auth: null } } as unknown as H3Event

        // Act & Assert
        await expect(simulateGetSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })
    })

    describe('Business Context Errors', () => {
      it('should return 403 when no business selected (businessId is null)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: null,
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateGetSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You must belong to a business to perform this action',
        })

        expect(prismaMock.inventorySchema.findUnique).not.toHaveBeenCalled()
      })

      it('should return 403 when businessId is undefined', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: undefined,
          businessRole: undefined,
        })

        // Act & Assert
        await expect(simulateGetSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
        })
      })
    })

    describe('Response Structure', () => {
      it('should return full schema object with all fields when exists', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const existingSchema = createMockSchema({
          id: 'schema-456',
          businessId: 'business-123',
          columns: [
            {
              id: generateUUID(),
              name: 'Product',
              type: 'text',
              role: 'name',
              order: 0,
              required: true,
            },
          ] as unknown as [],
          createdAt: new Date('2024-06-15'),
          updatedAt: new Date('2024-06-20'),
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(existingSchema)

        // Act
        const result = await simulateGetSchemaHandler(mockEvent)

        // Assert
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('businessId')
        expect(result).toHaveProperty('columns')
        expect(result).toHaveProperty('createdAt')
        expect(result).toHaveProperty('updatedAt')
      })
    })
  })

  // ==========================================================================
  // PUT /api/schema
  // ==========================================================================

  describe('PUT /api/schema', () => {
    describe('Happy Path', () => {
      it('should successfully create new schema when none exists', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: generateUUID(), name: 'Name', type: 'text', order: 0 }),
          createValidColumn({ id: generateUUID(), name: 'Quantity', type: 'number', order: 1 }),
        ]

        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null) // No existing schema
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert
        expect(result).toEqual(createdSchema)
        expect(prismaMock.inventorySchema.upsert).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
          update: { columns },
          create: {
            businessId: 'business-123',
            columns,
          },
        })
      })

      it('should successfully update existing schema (upsert)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const oldColumns = [createValidColumn({ id: generateUUID(), name: 'Old Name', order: 0 })]
        const newColumns = [
          createValidColumn({ id: generateUUID(), name: 'New Name', type: 'text', order: 0 }),
          createValidColumn({ id: generateUUID(), name: 'New Column', type: 'number', order: 1 }),
        ]

        const existingSchema = createMockSchema({ columns: oldColumns as unknown as [] })
        const updatedSchema = createMockSchema({ columns: newColumns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns: newColumns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(existingSchema)
        prismaMock.inventorySchema.upsert.mockResolvedValue(updatedSchema)
        mockDiffSchemaChanges.mockReturnValue([{ type: 'added', column: newColumns[1] }])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert
        expect(result).toEqual(updatedSchema)
        expect(prismaMock.inventorySchema.upsert).toHaveBeenCalled()
      })

      it('should accept schema with valid column types', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const validTypes = ['text', 'number', 'currency', 'date', 'select']

        for (const type of validTypes) {
          vi.clearAllMocks()
          mockDiffSchemaChanges.mockReturnValue([])

          const columns = [
            createValidColumn({
              id: generateUUID(),
              name: `${type} Column`,
              type,
              order: 0,
              ...(type === 'select' ? { options: ['Option 1', 'Option 2'] } : {}),
            }),
          ]

          const createdSchema = createMockSchema({ columns: columns as unknown as [] })

          mockReadBody.mockResolvedValue({ columns })
          prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
          prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)

          // Act
          const result = await simulateUpdateSchemaHandler(mockEvent)

          // Assert - should succeed for all valid types
          expect(result).toEqual(createdSchema)
        }
      })

      it('should accept schema with valid roles assigned to columns', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Product Name',
            type: 'text',
            role: 'name',
            order: 0,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Stock',
            type: 'number',
            role: 'quantity',
            order: 1,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Min Stock',
            type: 'number',
            role: 'minQuantity',
            order: 2,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Price',
            type: 'currency',
            role: 'price',
            order: 3,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Cost',
            type: 'currency',
            role: 'cost',
            order: 4,
          }),
        ]

        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert
        expect(result).toEqual(createdSchema)
      })

      it('should accept schema with select column that has options', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Category',
            type: 'select',
            options: ['Electronics', 'Clothing', 'Food'],
            order: 0,
          }),
        ]

        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert
        expect(result).toEqual(createdSchema)
      })

      it('should return updated schema after successful update', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Test', order: 0 })]
        const updatedSchema = createMockSchema({
          id: 'new-schema-id',
          columns: columns as unknown as [],
          updatedAt: new Date(),
        })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(updatedSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert
        expect(result.id).toBe('new-schema-id')
        expect(result.columns).toEqual(columns)
      })
    })

    describe('Activity Log', () => {
      it('should create activity log when schema changes are detected', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const newColumns = [createValidColumn({ id: generateUUID(), name: 'New', order: 0 })]
        const schemaChanges = [{ type: 'added', columnName: 'New' }]

        mockReadBody.mockResolvedValue({ columns: newColumns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(
          createMockSchema({ columns: newColumns as unknown as [] })
        )
        mockDiffSchemaChanges.mockReturnValue(schemaChanges)

        // Act
        await simulateUpdateSchemaHandler(mockEvent)

        // Assert
        expect(mockCreateInventoryLog).toHaveBeenCalledWith({
          action: 'SCHEMA_UPDATED',
          businessId: 'business-123',
          userId: 'user-123',
          schemaChanges,
          undoable: false,
        })
      })

      it('should not create activity log when no schema changes detected', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Same', order: 0 })]

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventorySchema.upsert.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockDiffSchemaChanges.mockReturnValue([]) // No changes

        // Act
        await simulateUpdateSchemaHandler(mockEvent)

        // Assert
        expect(mockCreateInventoryLog).not.toHaveBeenCalled()
      })
    })

    describe('Authorization Errors', () => {
      it('should return 401 when no auth context exists', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })

      it('should return 403 when no business selected', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: null,
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You must belong to a business to perform this action',
        })
      })

      it('should return 403 for BOSS role (not OWNER)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'BOSS',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Test', order: 0 })]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to edit schema',
        })

        expect(prismaMock.inventorySchema.upsert).not.toHaveBeenCalled()
      })

      it('should return 403 for EMPLOYEE role (not OWNER)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Test', order: 0 })]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to edit schema',
        })

        expect(prismaMock.inventorySchema.upsert).not.toHaveBeenCalled()
      })

      it('should return 403 when role is null', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
        })
      })
    })

    describe('Validation Errors - Column Name', () => {
      it('should return 400 for empty column name', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: '', order: 0 })]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Column name is required',
        })

        expect(prismaMock.inventorySchema.upsert).not.toHaveBeenCalled()
      })

      it('should return 400 for missing column name field', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          {
            id: generateUUID(),
            type: 'text',
            order: 0,
            // name is missing
          },
        ]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should accept column name with exactly 1 character', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'A', order: 0 })]
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect(result).toEqual(createdSchema)
      })
    })

    describe('Validation Errors - Column ID', () => {
      it('should return 400 for invalid UUID format in column id', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const invalidUUIDs = ['not-a-uuid', '123', 'xyz', '550e8400-e29b-41d4-a716', '']

        for (const invalidId of invalidUUIDs) {
          const columns = [createValidColumn({ id: invalidId, name: 'Test', order: 0 })]
          mockReadBody.mockResolvedValue({ columns })

          // Act & Assert
          await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
            statusCode: 400,
          })
        }
      })

      it('should accept valid UUID for column id', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const validUUIDs = [
          '550e8400-e29b-41d4-a716-446655440000',
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          '00000000-0000-0000-0000-000000000000',
        ]

        for (const validId of validUUIDs) {
          vi.clearAllMocks()
          mockDiffSchemaChanges.mockReturnValue([])

          const columns = [createValidColumn({ id: validId, name: 'Test', order: 0 })]
          const createdSchema = createMockSchema({ columns: columns as unknown as [] })

          mockReadBody.mockResolvedValue({ columns })
          prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
          prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)

          // Act
          const result = await simulateUpdateSchemaHandler(mockEvent)

          // Assert - should succeed
          expect(result).toEqual(createdSchema)
        }
      })
    })

    describe('Validation Errors - Column Type', () => {
      it('should return 400 for invalid column type', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const invalidTypes = ['invalid', 'string', 'int', 'float', 'boolean', 'array']

        for (const invalidType of invalidTypes) {
          const columns = [
            createValidColumn({ id: generateUUID(), name: 'Test', type: invalidType, order: 0 }),
          ]
          mockReadBody.mockResolvedValue({ columns })

          // Act & Assert
          await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
            statusCode: 400,
          })
        }
      })

      it('should return 400 for missing column type field', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          {
            id: generateUUID(),
            name: 'Test',
            order: 0,
            // type is missing
          },
        ]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })
    })

    describe('Validation Errors - Column Order', () => {
      it('should return 400 for negative order value', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Test', order: -1 })]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })

        expect(prismaMock.inventorySchema.upsert).not.toHaveBeenCalled()
      })

      it('should return 400 for non-integer order value', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Test', order: 1.5 })]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should accept order value of 0', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Test', order: 0 })]
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect(result).toEqual(createdSchema)
      })

      it('should accept large positive order values', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: generateUUID(), name: 'Test', order: 9999 })]
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect(result).toEqual(createdSchema)
      })
    })

    describe('Business Logic Errors - Duplicate Roles', () => {
      it('should return 400 when same role is assigned to multiple columns', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Name 1',
            type: 'text',
            role: 'name',
            order: 0,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Name 2',
            type: 'text',
            role: 'name', // Duplicate role
            order: 1,
          }),
        ]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Each role can only be assigned to one column',
        })

        expect(prismaMock.inventorySchema.upsert).not.toHaveBeenCalled()
      })

      it('should return 400 for duplicate quantity role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Stock',
            type: 'number',
            role: 'quantity',
            order: 0,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Count',
            type: 'number',
            role: 'quantity', // Duplicate
            order: 1,
          }),
        ]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Each role can only be assigned to one column',
        })
      })

      it('should allow multiple columns without roles', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: generateUUID(), name: 'Col 1', order: 0 }), // No role
          createValidColumn({ id: generateUUID(), name: 'Col 2', order: 1 }), // No role
          createValidColumn({ id: generateUUID(), name: 'Col 3', order: 2 }), // No role
        ]
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect(result).toEqual(createdSchema)
      })

      it('should allow different roles on different columns', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Name',
            type: 'text',
            role: 'name',
            order: 0,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Qty',
            type: 'number',
            role: 'quantity',
            order: 1,
          }),
          createValidColumn({
            id: generateUUID(),
            name: 'Price',
            type: 'currency',
            role: 'price',
            order: 2,
          }),
        ]
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect(result).toEqual(createdSchema)
      })
    })

    describe('Business Logic Errors - Select Column Options', () => {
      it('should return 400 for select column without options', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Category',
            type: 'select',
            order: 0,
            // options is missing
          }),
        ]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Column "Category" is a select type but has no options',
        })

        expect(prismaMock.inventorySchema.upsert).not.toHaveBeenCalled()
      })

      it('should return 400 for select column with empty options array', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Status',
            type: 'select',
            options: [], // Empty array
            order: 0,
          }),
        ]
        mockReadBody.mockResolvedValue({ columns })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Column "Status" is a select type but has no options',
        })
      })

      it('should accept select column with single option', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: generateUUID(),
            name: 'Bool-ish',
            type: 'select',
            options: ['Yes'],
            order: 0,
          }),
        ]
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect(result).toEqual(createdSchema)
      })

      it('should not require options for non-select column types', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const nonSelectTypes = ['text', 'number', 'currency', 'date']

        for (const type of nonSelectTypes) {
          vi.clearAllMocks()
          mockDiffSchemaChanges.mockReturnValue([])

          const columns = [
            createValidColumn({
              id: generateUUID(),
              name: `${type} Column`,
              type,
              order: 0,
              // No options - should be fine for non-select types
            }),
          ]
          const createdSchema = createMockSchema({ columns: columns as unknown as [] })

          mockReadBody.mockResolvedValue({ columns })
          prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
          prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)

          // Act
          const result = await simulateUpdateSchemaHandler(mockEvent)

          // Assert - should succeed
          expect(result).toEqual(createdSchema)
        }
      })
    })

    describe('Edge Cases', () => {
      it('should accept empty columns array', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns: unknown[] = []
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect(result.columns).toEqual([])
      })

      it('should return 400 for missing columns field entirely', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({}) // Missing columns

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should return 400 for null columns', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({ columns: null })

        // Act & Assert
        await expect(simulateUpdateSchemaHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should handle many columns', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = Array.from({ length: 50 }, (_, i) =>
          createValidColumn({
            id: generateUUID(),
            name: `Column ${i}`,
            type: 'text',
            order: i,
          })
        )
        const createdSchema = createMockSchema({ columns: columns as unknown as [] })

        mockReadBody.mockResolvedValue({ columns })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)
        prismaMock.inventorySchema.upsert.mockResolvedValue(createdSchema)
        mockDiffSchemaChanges.mockReturnValue([])

        // Act
        const result = await simulateUpdateSchemaHandler(mockEvent)

        // Assert - should succeed
        expect((result.columns as unknown[]).length).toBe(50)
      })
    })
  })

  // ==========================================================================
  // POST /api/schema/reset
  // ==========================================================================

  describe('POST /api/schema/reset', () => {
    describe('Happy Path', () => {
      it('should successfully delete all items and schema', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        // Mock the transaction
        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 50 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 20 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result).toEqual({
          success: true,
          message: 'Inventory has been reset successfully',
          deletedItemsCount: 50,
          schemaDeleted: true,
          deletedLogsCount: 20,
          deletedOperationsCount: 10,
        })
      })

      it('should emit socket event after successful reset', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
            },
          }
          return callback(tx)
        })

        // Act
        await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(mockEmitInventoryReset).toHaveBeenCalledWith('business-123')
        expect(mockEmitInventoryReset).toHaveBeenCalledTimes(1)
      })

      it('should work when no items exist', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }), // No items
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(result.deletedItemsCount).toBe(0)
        expect(result.schemaDeleted).toBe(true)
      })

      it('should work when no schema exists', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }), // No schema
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 8 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(result.deletedItemsCount).toBe(5)
        expect(result.schemaDeleted).toBe(false)
      })

      it('should work when neither items nor schema exist', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(result.deletedItemsCount).toBe(0)
        expect(result.schemaDeleted).toBe(false)
      })
    })

    describe('Transaction Behavior', () => {
      it('should use Prisma transaction for atomic operation', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
          }
          return callback(tx)
        })

        // Act
        await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
        expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function))
      })

      it('should delete items and schema in the same transaction', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const mockDeleteItems = vi.fn().mockResolvedValue({ count: 10 })
        const mockDeleteSchema = vi.fn().mockResolvedValue({ count: 1 })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: mockDeleteItems,
            },
            inventorySchema: {
              deleteMany: mockDeleteSchema,
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
            },
          }
          return callback(tx)
        })

        // Act
        await simulateResetInventoryHandler(mockEvent)

        // Assert - both should be called within the transaction
        expect(mockDeleteItems).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
        expect(mockDeleteSchema).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
      })
    })

    describe('Authorization Errors', () => {
      it('should return 401 when no auth context exists', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event

        // Act & Assert
        await expect(simulateResetInventoryHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })

        expect(prismaMock.$transaction).not.toHaveBeenCalled()
      })

      it('should return 403 when no business selected', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: null,
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateResetInventoryHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You must belong to a business to perform this action',
        })

        expect(prismaMock.$transaction).not.toHaveBeenCalled()
      })

      it('should return 403 for BOSS role (not OWNER)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'BOSS',
        })

        // Act & Assert
        await expect(simulateResetInventoryHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to reset inventory',
        })

        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(mockEmitInventoryReset).not.toHaveBeenCalled()
      })

      it('should return 403 for EMPLOYEE role (not OWNER)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        // Act & Assert
        await expect(simulateResetInventoryHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to reset inventory',
        })

        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(mockEmitInventoryReset).not.toHaveBeenCalled()
      })

      it('should return 403 when role is null', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateResetInventoryHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
        })
      })
    })

    describe('Response Structure', () => {
      it('should return correct response structure', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 25 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert - verify all expected fields
        expect(result).toHaveProperty('success')
        expect(result).toHaveProperty('message')
        expect(result).toHaveProperty('deletedItemsCount')
        expect(result).toHaveProperty('schemaDeleted')
        expect(result).toHaveProperty('deletedLogsCount')
        expect(result).toHaveProperty('deletedOperationsCount')

        expect(typeof result.success).toBe('boolean')
        expect(typeof result.message).toBe('string')
        expect(typeof result.deletedItemsCount).toBe('number')
        expect(typeof result.schemaDeleted).toBe('boolean')
        expect(typeof result.deletedLogsCount).toBe('number')
        expect(typeof result.deletedOperationsCount).toBe('number')
      })

      it('should return accurate deleted items count', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const expectedCount = 42

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: expectedCount }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 15 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 8 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result.deletedItemsCount).toBe(expectedCount)
      })
    })

    describe('Edge Cases', () => {
      it('should handle large number of items', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const largeCount = 100000

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: largeCount }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 50000 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 25000 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(result.deletedItemsCount).toBe(largeCount)
      })

      it('should use correct businessId in delete operations', async () => {
        // Arrange
        const specificBusinessId = 'specific-business-abc'
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: specificBusinessId,
          businessRole: 'OWNER',
        })

        const mockDeleteItems = vi.fn().mockResolvedValue({ count: 5 })
        const mockDeleteSchema = vi.fn().mockResolvedValue({ count: 1 })
        const mockDeleteLogs = vi.fn().mockResolvedValue({ count: 10 })
        const mockDeleteOperations = vi.fn().mockResolvedValue({ count: 8 })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: mockDeleteItems,
            },
            inventorySchema: {
              deleteMany: mockDeleteSchema,
            },
            inventoryLog: {
              deleteMany: mockDeleteLogs,
            },
            operation: {
              deleteMany: mockDeleteOperations,
            },
          }
          return callback(tx)
        })

        // Act
        await simulateResetInventoryHandler(mockEvent)

        // Assert - verify the specific businessId was used
        expect(mockDeleteItems).toHaveBeenCalledWith({
          where: { businessId: specificBusinessId },
        })
        expect(mockDeleteSchema).toHaveBeenCalledWith({
          where: { businessId: specificBusinessId },
        })
        expect(mockDeleteLogs).toHaveBeenCalledWith({
          where: { businessId: specificBusinessId },
        })
        expect(mockDeleteOperations).toHaveBeenCalledWith({
          where: { businessId: specificBusinessId },
        })
        expect(mockEmitInventoryReset).toHaveBeenCalledWith(specificBusinessId)
      })
    })

    describe('Logs and Operations Deletion', () => {
      it('should delete InventoryLog records for the business', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const mockDeleteLogs = vi.fn().mockResolvedValue({ count: 15 })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: mockDeleteLogs,
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(mockDeleteLogs).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
        expect(result.deletedLogsCount).toBe(15)
      })

      it('should delete Operation records for the business', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const mockDeleteOperations = vi.fn().mockResolvedValue({ count: 25 })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 15 }),
            },
            operation: {
              deleteMany: mockDeleteOperations,
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(mockDeleteOperations).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
        expect(result.deletedOperationsCount).toBe(25)
      })

      it('should include deletedLogsCount in response', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const expectedLogsCount = 42

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: expectedLogsCount }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result).toHaveProperty('deletedLogsCount')
        expect(typeof result.deletedLogsCount).toBe('number')
        expect(result.deletedLogsCount).toBe(expectedLogsCount)
      })

      it('should include deletedOperationsCount in response', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const expectedOperationsCount = 37

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 15 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: expectedOperationsCount }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result).toHaveProperty('deletedOperationsCount')
        expect(typeof result.deletedOperationsCount).toBe('number')
        expect(result.deletedOperationsCount).toBe(expectedOperationsCount)
      })

      it('should delete all resources in a single transaction', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const mockDeleteItems = vi.fn().mockResolvedValue({ count: 10 })
        const mockDeleteSchema = vi.fn().mockResolvedValue({ count: 1 })
        const mockDeleteLogs = vi.fn().mockResolvedValue({ count: 15 })
        const mockDeleteOperations = vi.fn().mockResolvedValue({ count: 5 })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: mockDeleteItems,
            },
            inventorySchema: {
              deleteMany: mockDeleteSchema,
            },
            inventoryLog: {
              deleteMany: mockDeleteLogs,
            },
            operation: {
              deleteMany: mockDeleteOperations,
            },
          }
          return callback(tx)
        })

        // Act
        await simulateResetInventoryHandler(mockEvent)

        // Assert - verify all 4 deleteMany calls happen within the same transaction
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
        expect(mockDeleteItems).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
        expect(mockDeleteSchema).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
        expect(mockDeleteLogs).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
        expect(mockDeleteOperations).toHaveBeenCalledWith({
          where: { businessId: 'business-123' },
        })
      })

      it('should handle zero logs scenario', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }), // No logs
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(result.deletedLogsCount).toBe(0)
      })

      it('should handle zero operations scenario', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        prismaMock.$transaction.mockImplementation(async (callback: Function) => {
          const tx = {
            inventoryItem: {
              deleteMany: vi.fn().mockResolvedValue({ count: 10 }),
            },
            inventorySchema: {
              deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            inventoryLog: {
              deleteMany: vi.fn().mockResolvedValue({ count: 15 }),
            },
            operation: {
              deleteMany: vi.fn().mockResolvedValue({ count: 0 }), // No operations
            },
          }
          return callback(tx)
        })

        // Act
        const result = await simulateResetInventoryHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(result.deletedOperationsCount).toBe(0)
      })
    })
  })

  // ==========================================================================
  // Validation Schema Unit Tests
  // ==========================================================================

  describe('Validation Schema Unit Tests', () => {
    describe('columnDefinitionSchema', () => {
      it('should accept valid column definition', () => {
        const validColumn = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Product Name',
          type: 'text',
          order: 0,
        }

        const result = columnDefinitionSchema.safeParse(validColumn)
        expect(result.success).toBe(true)
      })

      it('should accept column with all optional fields', () => {
        const fullColumn = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Category',
          type: 'select',
          role: 'name',
          options: ['A', 'B', 'C'],
          required: true,
          order: 5,
        }

        const result = columnDefinitionSchema.safeParse(fullColumn)
        expect(result.success).toBe(true)
      })

      it('should reject invalid UUID', () => {
        const invalidColumn = {
          id: 'not-a-uuid',
          name: 'Test',
          type: 'text',
          order: 0,
        }

        const result = columnDefinitionSchema.safeParse(invalidColumn)
        expect(result.success).toBe(false)
      })

      it('should reject empty name', () => {
        const invalidColumn = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: '',
          type: 'text',
          order: 0,
        }

        const result = columnDefinitionSchema.safeParse(invalidColumn)
        expect(result.success).toBe(false)
      })

      it('should reject invalid type', () => {
        const invalidColumn = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test',
          type: 'invalid',
          order: 0,
        }

        const result = columnDefinitionSchema.safeParse(invalidColumn)
        expect(result.success).toBe(false)
      })

      it('should reject negative order', () => {
        const invalidColumn = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test',
          type: 'text',
          order: -1,
        }

        const result = columnDefinitionSchema.safeParse(invalidColumn)
        expect(result.success).toBe(false)
      })

      it('should reject non-integer order', () => {
        const invalidColumn = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test',
          type: 'text',
          order: 1.5,
        }

        const result = columnDefinitionSchema.safeParse(invalidColumn)
        expect(result.success).toBe(false)
      })

      it('should reject invalid role', () => {
        const invalidColumn = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Test',
          type: 'text',
          role: 'invalid-role',
          order: 0,
        }

        const result = columnDefinitionSchema.safeParse(invalidColumn)
        expect(result.success).toBe(false)
      })
    })

    describe('inventorySchemaUpdateSchema', () => {
      it('should accept valid schema with columns array', () => {
        const validSchema = {
          columns: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              name: 'Test',
              type: 'text',
              order: 0,
            },
          ],
        }

        const result = inventorySchemaUpdateSchema.safeParse(validSchema)
        expect(result.success).toBe(true)
      })

      it('should accept empty columns array', () => {
        const emptySchema = {
          columns: [],
        }

        const result = inventorySchemaUpdateSchema.safeParse(emptySchema)
        expect(result.success).toBe(true)
      })

      it('should reject missing columns field', () => {
        const invalidSchema = {}

        const result = inventorySchemaUpdateSchema.safeParse(invalidSchema)
        expect(result.success).toBe(false)
      })

      it('should reject null columns', () => {
        const invalidSchema = {
          columns: null,
        }

        const result = inventorySchemaUpdateSchema.safeParse(invalidSchema)
        expect(result.success).toBe(false)
      })

      it('should reject columns with invalid items', () => {
        const invalidSchema = {
          columns: [
            {
              // Missing required fields
              name: 'Test',
            },
          ],
        }

        const result = inventorySchemaUpdateSchema.safeParse(invalidSchema)
        expect(result.success).toBe(false)
      })
    })
  })
})
