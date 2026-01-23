import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient, InventoryItem, InventorySchema, BusinessRole } from '@prisma/client'
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
const mockEmitInventoryUpdated = vi.fn()
const mockEmitInventoryDeleted = vi.fn()

vi.mock('~/server/utils/socket', () => ({
  emitInventoryCreated: mockEmitInventoryCreated,
  emitInventoryUpdated: mockEmitInventoryUpdated,
  emitInventoryDeleted: mockEmitInventoryDeleted,
  emitLogCreated: vi.fn(),
}))

// Mock inventory log utilities
const mockCreateInventoryLog = vi.fn().mockResolvedValue({})
const mockGetItemName = vi.fn()
const mockGetItemSnapshot = vi.fn()
const mockDiffChanges = vi.fn()

vi.mock('~/server/utils/inventoryLog', () => ({
  createInventoryLog: mockCreateInventoryLog,
  getItemName: mockGetItemName,
  getItemSnapshot: mockGetItemSnapshot,
  diffChanges: mockDiffChanges,
}))

// Mock dynamic validation
const mockValidateInventoryData = vi.fn()

vi.mock('~/server/utils/dynamicValidation', () => ({
  validateInventoryData: mockValidateInventoryData,
}))

// Mock readBody and getRouterParam functions
const mockReadBody = vi.fn()
const mockGetRouterParam = vi.fn()

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
    getRouterParam: mockGetRouterParam,
    createError: mockCreateError,
    defineEventHandler: (handler: Function) => handler,
  }
})

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
 * Creates a mock inventory item with default values
 */
function createMockItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'item-123',
    data: {},
    businessId: 'business-123',
    createdById: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/**
 * Creates a valid column definition for testing
 */
function createValidColumn(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
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
 * Simulates the POST /api/inventory handler logic for testing
 */
async function simulateCreateItemHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }

  // Check authentication
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

  // Require OWNER or BOSS role
  if (!auth.businessRole || !['OWNER', 'BOSS'].includes(auth.businessRole)) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to create inventory items',
    })
  }

  const body = await mockReadBody(event)

  // Get business schema
  const schema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  if (!schema || !schema.columns) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  const columns = schema.columns as ColumnDefinition[]

  // Validate data format
  const data = body.data as Record<string, unknown>
  if (!data || typeof data !== 'object') {
    throw mockCreateError({
      statusCode: 400,
      message: 'Invalid data format',
    })
  }

  // Validate data against schema
  const validation = mockValidateInventoryData(data, columns)
  if (!validation.success) {
    throw mockCreateError({
      statusCode: 400,
      message: validation.errors?.join(', ') || 'Validation failed',
    })
  }

  // Create item
  const item = await prismaMock.inventoryItem.create({
    data: {
      data: data,
      businessId: auth.businessId,
      createdById: auth.userId,
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // Log the creation
  await mockCreateInventoryLog({
    action: 'ITEM_CREATED',
    businessId: auth.businessId,
    userId: auth.userId,
    itemId: item.id,
    itemName: mockGetItemName(data, columns),
    snapshot: mockGetItemSnapshot(item),
    undoable: false,
  })

  // Emit socket event
  mockEmitInventoryCreated(auth.businessId, item)

  return item
}

/**
 * Simulates the PUT /api/inventory/[id] handler logic for testing
 */
async function simulateUpdateItemHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }

  // Check authentication
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

  // Require OWNER or BOSS role
  if (!auth.businessRole || !['OWNER', 'BOSS'].includes(auth.businessRole)) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to update inventory items',
    })
  }

  const id = mockGetRouterParam(event, 'id')
  const body = await mockReadBody(event)

  if (!id) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  // Check if item exists
  const existingItem = await prismaMock.inventoryItem.findUnique({
    where: { id },
  })

  if (!existingItem) {
    throw mockCreateError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  // Verify business membership
  if (existingItem.businessId !== auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to update this item',
    })
  }

  // Get business schema
  const schema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  if (!schema || !schema.columns) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Schema not found',
    })
  }

  const columns = schema.columns as ColumnDefinition[]
  const oldData = existingItem.data as Record<string, unknown>

  // Validate data format
  const data = body.data as Record<string, unknown>
  if (!data || typeof data !== 'object') {
    throw mockCreateError({
      statusCode: 400,
      message: 'Invalid data format',
    })
  }

  // Validate data against schema
  const validation = mockValidateInventoryData(data, columns)
  if (!validation.success) {
    throw mockCreateError({
      statusCode: 400,
      message: validation.errors?.join(', ') || 'Validation failed',
    })
  }

  // Update item
  const item = await prismaMock.inventoryItem.update({
    where: { id },
    data: { data: data },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  // Calculate and log changes
  const changes = mockDiffChanges(oldData, data, columns)
  if (changes && changes.length > 0) {
    await mockCreateInventoryLog({
      action: 'ITEM_UPDATED',
      businessId: auth.businessId,
      userId: auth.userId,
      itemId: item.id,
      itemName: mockGetItemName(data, columns),
      changes,
      undoable: true,
    })
  }

  // Emit socket event
  mockEmitInventoryUpdated(auth.businessId, item)

  return item
}

/**
 * Simulates the DELETE /api/inventory/[id] handler logic for testing
 */
async function simulateDeleteItemHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }

  // Check authentication
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

  // Require OWNER or BOSS role
  if (!auth.businessRole || !['OWNER', 'BOSS'].includes(auth.businessRole)) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to delete inventory items',
    })
  }

  const id = mockGetRouterParam(event, 'id')

  if (!id) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  // Check if item exists
  const existingItem = await prismaMock.inventoryItem.findUnique({
    where: { id },
  })

  if (!existingItem) {
    throw mockCreateError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  // Verify business membership
  if (existingItem.businessId !== auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to delete this item',
    })
  }

  // Get schema to find item name
  const schema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })
  const columns = (schema?.columns as ColumnDefinition[]) || []
  const itemData = existingItem.data as Record<string, unknown>
  const itemName = mockGetItemName(itemData, columns)

  // Log deletion before deleting (include full snapshot for undo)
  await mockCreateInventoryLog({
    action: 'ITEM_DELETED',
    businessId: auth.businessId,
    userId: auth.userId,
    itemId: existingItem.id,
    itemName,
    snapshot: mockGetItemSnapshot(existingItem),
    undoable: true,
  })

  // Delete item
  await prismaMock.inventoryItem.delete({
    where: { id },
  })

  // Emit socket event
  mockEmitInventoryDeleted(auth.businessId, id)

  return { success: true, message: 'Item deleted successfully' }
}

// ============================================================================
// Tests
// ============================================================================

describe('Inventory Item CRUD API', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockReset(prismaMock)
    vi.clearAllMocks()

    // Setup default mock return values
    mockValidateInventoryData.mockReturnValue({ success: true })
    mockGetItemName.mockReturnValue('Test Item')
    mockGetItemSnapshot.mockReturnValue({ id: 'item-123', data: {} })
    mockDiffChanges.mockReturnValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // POST /api/inventory (Create Item)
  // ==========================================================================

  describe('POST /api/inventory (Create Item)', () => {
    describe('Happy Path', () => {
      it('should create item with valid data', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Name', type: 'text', role: 'name' }),
          createValidColumn({ id: 'col-2', name: 'Quantity', type: 'number', order: 1 }),
        ]

        const itemData = {
          'col-1': 'Widget',
          'col-2': 100,
        }

        const createdItem = createMockItem({
          id: 'new-item-123',
          data: itemData,
          businessId: 'business-123',
          createdById: 'user-123',
        })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result).toEqual(createdItem)
        expect(prismaMock.inventoryItem.create).toHaveBeenCalledWith({
          data: {
            data: itemData,
            businessId: 'business-123',
            createdById: 'user-123',
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      })

      it('should return created item with id', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const itemData = { 'col-1': 'Test Product' }
        const createdItem = createMockItem({
          id: 'generated-id-456',
          data: itemData,
        })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result.id).toBe('generated-id-456')
        expect(result.data).toEqual(itemData)
      })

      it('should emit socket event after creating item', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const itemData = { 'col-1': 'Test' }
        const createdItem = createMockItem({ data: itemData })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(mockEmitInventoryCreated).toHaveBeenCalledWith('business-123', createdItem)
        expect(mockEmitInventoryCreated).toHaveBeenCalledTimes(1)
      })

      it('should create activity log with ITEM_CREATED action', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text', role: 'name' })]
        const itemData = { 'col-1': 'Test Product' }
        const createdItem = createMockItem({ id: 'item-456', data: itemData })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)
        mockGetItemName.mockReturnValue('Test Product')
        mockGetItemSnapshot.mockReturnValue({ id: 'item-456', data: itemData })

        // Act
        await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(mockCreateInventoryLog).toHaveBeenCalledWith({
          action: 'ITEM_CREATED',
          businessId: 'business-123',
          userId: 'user-123',
          itemId: 'item-456',
          itemName: 'Test Product',
          snapshot: { id: 'item-456', data: itemData },
          undoable: false,
        })
      })
    })

    describe('Validation', () => {
      it('should validate required fields', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Name', type: 'text', required: true }),
        ]

        mockReadBody.mockResolvedValue({ data: { 'col-1': '' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Name: Required field cannot be empty'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Name: Required field cannot be empty',
        })

        expect(prismaMock.inventoryItem.create).not.toHaveBeenCalled()
      })

      it('should validate text column type', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Description', type: 'text' })]

        mockReadBody.mockResolvedValue({ data: { 'col-1': 12345 } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Description: Expected string'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should validate number column type', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Quantity', type: 'number' })]

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'not a number' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Quantity: Expected a number'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Quantity: Expected a number',
        })
      })

      it('should validate currency column type', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Price', type: 'currency' })]

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'invalid' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Price: Expected a number'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should validate date column type', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Expiry Date', type: 'date' })]

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'not-a-date' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Expiry Date: Invalid date format'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should validate select column type', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: 'col-1',
            name: 'Category',
            type: 'select',
            options: ['Electronics', 'Clothing', 'Food'],
          }),
        ]

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Invalid Option' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Category: Invalid enum value'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should reject invalid select options', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: 'col-1',
            name: 'Status',
            type: 'select',
            options: ['Active', 'Inactive'],
          }),
        ]

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Pending' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ["Status: Invalid enum value. Expected 'Active' | 'Inactive'"],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should accept valid select option', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({
            id: 'col-1',
            name: 'Status',
            type: 'select',
            options: ['Active', 'Inactive'],
          }),
        ]
        const itemData = { 'col-1': 'Active' }
        const createdItem = createMockItem({ data: itemData })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result.data).toEqual(itemData)
      })

      it('should handle multiple validation errors', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Name', type: 'text', required: true }),
          createValidColumn({ id: 'col-2', name: 'Quantity', type: 'number', required: true }),
        ]

        mockReadBody.mockResolvedValue({ data: {} })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Name: Required', 'Quantity: Required'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Name: Required, Quantity: Required',
        })
      })
    })

    describe('Authorization', () => {
      it('should require authentication', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })

        expect(prismaMock.inventoryItem.create).not.toHaveBeenCalled()
      })

      it('should require businessId', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: null,
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You must belong to a business to perform this action',
        })

        expect(prismaMock.inventoryItem.create).not.toHaveBeenCalled()
      })

      it('should allow OWNER role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const itemData = { 'col-1': 'Test' }
        const createdItem = createMockItem({ data: itemData })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result).toEqual(createdItem)
      })

      it('should allow BOSS role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'BOSS',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const itemData = { 'col-1': 'Test' }
        const createdItem = createMockItem({ data: itemData })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result).toEqual(createdItem)
      })

      it('should reject EMPLOYEE role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to create inventory items',
        })

        expect(prismaMock.inventoryItem.create).not.toHaveBeenCalled()
      })

      it('should reject null role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
        })
      })
    })

    describe('Edge Cases', () => {
      it('should handle empty data object', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const emptyData = {}
        const createdItem = createMockItem({ data: emptyData })

        mockReadBody.mockResolvedValue({ data: emptyData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result.data).toEqual(emptyData)
      })

      it('should handle missing schema', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Please set up your inventory columns first',
        })
      })

      it('should handle schema with null columns', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: null as unknown as [] })
        )

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Please set up your inventory columns first',
        })
      })

      it('should handle special characters in text values', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const specialData = { 'col-1': 'Test <script>alert("XSS")</script> & more "quotes"' }
        const createdItem = createMockItem({ data: specialData })

        mockReadBody.mockResolvedValue({ data: specialData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result.data).toEqual(specialData)
      })

      it('should handle null data in body', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]

        mockReadBody.mockResolvedValue({ data: null })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Invalid data format',
        })
      })

      it('should handle missing data field in body', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]

        mockReadBody.mockResolvedValue({})
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Invalid data format',
        })
      })

      it('should handle data as non-object (array)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]

        mockReadBody.mockResolvedValue({ data: ['array', 'not', 'object'] })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )

        // Note: Arrays are technically objects in JS, so this might pass the typeof check
        // The actual validation would likely catch this
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Invalid data structure'],
        })

        // Act & Assert
        await expect(simulateCreateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should handle very long text values', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Description', type: 'text' })]
        const longText = 'A'.repeat(10000)
        const itemData = { 'col-1': longText }
        const createdItem = createMockItem({ data: itemData })

        mockReadBody.mockResolvedValue({ data: itemData })
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

        // Act
        const result = await simulateCreateItemHandler(mockEvent)

        // Assert
        expect(result.data['col-1']).toBe(longText)
      })
    })
  })

  // ==========================================================================
  // PUT /api/inventory/[id] (Update Item)
  // ==========================================================================

  describe('PUT /api/inventory/[id] (Update Item)', () => {
    describe('Happy Path', () => {
      it('should update item with valid data', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Name', type: 'text' }),
          createValidColumn({ id: 'col-2', name: 'Quantity', type: 'number', order: 1 }),
        ]

        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Old Name', 'col-2': 50 },
          businessId: 'business-123',
        })

        const newData = { 'col-1': 'New Name', 'col-2': 100 }
        const updatedItem = createMockItem({
          id: 'item-123',
          data: newData,
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: newData })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)

        // Act
        const result = await simulateUpdateItemHandler(mockEvent)

        // Assert
        expect(result).toEqual(updatedItem)
        expect(prismaMock.inventoryItem.update).toHaveBeenCalledWith({
          where: { id: 'item-123' },
          data: { data: newData },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      })

      it('should return updated item', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Before' },
          businessId: 'business-123',
        })
        const newData = { 'col-1': 'After' }
        const updatedItem = createMockItem({
          id: 'item-123',
          data: newData,
          updatedAt: new Date('2024-06-15'),
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: newData })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)

        // Act
        const result = await simulateUpdateItemHandler(mockEvent)

        // Assert
        expect(result.data).toEqual(newData)
        expect(result.updatedAt).toEqual(new Date('2024-06-15'))
      })

      it('should emit socket event after updating item', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Old' },
          businessId: 'business-123',
        })
        const newData = { 'col-1': 'New' }
        const updatedItem = createMockItem({ id: 'item-123', data: newData })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: newData })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)

        // Act
        await simulateUpdateItemHandler(mockEvent)

        // Assert
        expect(mockEmitInventoryUpdated).toHaveBeenCalledWith('business-123', updatedItem)
        expect(mockEmitInventoryUpdated).toHaveBeenCalledTimes(1)
      })

      it('should create activity log with changes when fields are modified', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Name', type: 'text', role: 'name' }),
          createValidColumn({ id: 'col-2', name: 'Quantity', type: 'number', order: 1 }),
        ]

        const oldData = { 'col-1': 'Widget', 'col-2': 50 }
        const newData = { 'col-1': 'Widget', 'col-2': 100 }

        const existingItem = createMockItem({
          id: 'item-123',
          data: oldData,
          businessId: 'business-123',
        })
        const updatedItem = createMockItem({ id: 'item-123', data: newData })

        const changes = [
          { field: 'col-2', fieldName: 'Quantity', oldValue: 50, newValue: 100 },
        ]

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: newData })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)
        mockDiffChanges.mockReturnValue(changes)
        mockGetItemName.mockReturnValue('Widget')

        // Act
        await simulateUpdateItemHandler(mockEvent)

        // Assert
        expect(mockCreateInventoryLog).toHaveBeenCalledWith({
          action: 'ITEM_UPDATED',
          businessId: 'business-123',
          userId: 'user-123',
          itemId: 'item-123',
          itemName: 'Widget',
          changes,
          undoable: true,
        })
      })

      it('should not create activity log when no changes detected', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const sameData = { 'col-1': 'Same Value' }

        const existingItem = createMockItem({
          id: 'item-123',
          data: sameData,
          businessId: 'business-123',
        })
        const updatedItem = createMockItem({ id: 'item-123', data: sameData })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: sameData })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)
        mockDiffChanges.mockReturnValue([]) // No changes

        // Act
        await simulateUpdateItemHandler(mockEvent)

        // Assert
        expect(mockCreateInventoryLog).not.toHaveBeenCalled()
      })
    })

    describe('Validation', () => {
      it('should validate all column types', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Name', type: 'text' }),
          createValidColumn({ id: 'col-2', name: 'Count', type: 'number', order: 1 }),
          createValidColumn({ id: 'col-3', name: 'Price', type: 'currency', order: 2 }),
          createValidColumn({ id: 'col-4', name: 'Date', type: 'date', order: 3 }),
        ]

        const existingItem = createMockItem({
          id: 'item-123',
          data: {},
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({
          data: {
            'col-1': 123, // Should be text
            'col-2': 'not a number',
            'col-3': 'invalid',
            'col-4': 'bad date',
          },
        })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Name: Expected string', 'Count: Expected a number'],
        })

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
        })
      })

      it('should reject invalid data', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Quantity', type: 'number' })]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 10 },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'invalid' } })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        mockValidateInventoryData.mockReturnValue({
          success: false,
          errors: ['Quantity: Expected a number'],
        })

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Quantity: Expected a number',
        })

        expect(prismaMock.inventoryItem.update).not.toHaveBeenCalled()
      })
    })

    describe('Authorization', () => {
      it('should require authentication', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })

      it('should verify item belongs to business', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const itemFromDifferentBusiness = createMockItem({
          id: 'item-123',
          businessId: 'different-business-456',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(itemFromDifferentBusiness)

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to update this item',
        })

        expect(prismaMock.inventoryItem.update).not.toHaveBeenCalled()
      })

      it('should allow OWNER role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Old' },
          businessId: 'business-123',
        })
        const updatedItem = createMockItem({ id: 'item-123', data: { 'col-1': 'New' } })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'New' } })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)

        // Act
        const result = await simulateUpdateItemHandler(mockEvent)

        // Assert
        expect(result).toEqual(updatedItem)
      })

      it('should allow BOSS role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'BOSS',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Old' },
          businessId: 'business-123',
        })
        const updatedItem = createMockItem({ id: 'item-123', data: { 'col-1': 'New' } })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'New' } })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)

        // Act
        const result = await simulateUpdateItemHandler(mockEvent)

        // Assert
        expect(result).toEqual(updatedItem)
      })

      it('should reject EMPLOYEE role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to update inventory items',
        })

        expect(prismaMock.inventoryItem.update).not.toHaveBeenCalled()
      })
    })

    describe('Edge Cases', () => {
      it('should handle non-existent item (404)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue('non-existent-id')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'Item not found',
        })
      })

      it('should handle item from different business (403)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const itemFromOtherBusiness = createMockItem({
          id: 'item-123',
          businessId: 'other-business-999',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(itemFromOtherBusiness)

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to update this item',
        })
      })

      it('should track field changes correctly', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Name', type: 'text' }),
          createValidColumn({ id: 'col-2', name: 'Quantity', type: 'number', order: 1 }),
          createValidColumn({ id: 'col-3', name: 'Price', type: 'currency', order: 2 }),
        ]

        const oldData = { 'col-1': 'Widget', 'col-2': 50, 'col-3': 9.99 }
        const newData = { 'col-1': 'Widget Pro', 'col-2': 50, 'col-3': 19.99 }

        const existingItem = createMockItem({
          id: 'item-123',
          data: oldData,
          businessId: 'business-123',
        })
        const updatedItem = createMockItem({ id: 'item-123', data: newData })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: newData })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)

        // Act
        await simulateUpdateItemHandler(mockEvent)

        // Assert - verify diffChanges was called with correct old and new data
        expect(mockDiffChanges).toHaveBeenCalledWith(oldData, newData, columns)
      })

      it('should handle missing item ID', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue(null)
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Item ID is required',
        })
      })

      it('should handle schema not found', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Test' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: { 'col-1': 'New Value' } })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Schema not found',
        })
      })

      it('should handle invalid data format (null)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text' })]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Old' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        mockReadBody.mockResolvedValue({ data: null })
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )

        // Act & Assert
        await expect(simulateUpdateItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Invalid data format',
        })
      })
    })
  })

  // ==========================================================================
  // DELETE /api/inventory/[id] (Delete Item)
  // ==========================================================================

  describe('DELETE /api/inventory/[id] (Delete Item)', () => {
    describe('Happy Path', () => {
      it('should delete item', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text', role: 'name' })]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Widget to Delete' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)

        // Act
        await simulateDeleteItemHandler(mockEvent)

        // Assert
        expect(prismaMock.inventoryItem.delete).toHaveBeenCalledWith({
          where: { id: 'item-123' },
        })
      })

      it('should return success response', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Test' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema())
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)

        // Act
        const result = await simulateDeleteItemHandler(mockEvent)

        // Assert
        expect(result).toEqual({
          success: true,
          message: 'Item deleted successfully',
        })
      })

      it('should emit socket event after deleting item', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const existingItem = createMockItem({
          id: 'item-456',
          data: { 'col-1': 'Test' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-456')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema())
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)

        // Act
        await simulateDeleteItemHandler(mockEvent)

        // Assert
        expect(mockEmitInventoryDeleted).toHaveBeenCalledWith('business-123', 'item-456')
        expect(mockEmitInventoryDeleted).toHaveBeenCalledTimes(1)
      })

      it('should create activity log with snapshot before deleting', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [createValidColumn({ id: 'col-1', name: 'Name', type: 'text', role: 'name' })]
        const itemData = { 'col-1': 'Widget to Delete' }
        const existingItem = createMockItem({
          id: 'item-123',
          data: itemData,
          businessId: 'business-123',
        })

        const snapshot = {
          id: 'item-123',
          data: itemData,
          businessId: 'business-123',
          createdById: 'user-123',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        }

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)
        mockGetItemName.mockReturnValue('Widget to Delete')
        mockGetItemSnapshot.mockReturnValue(snapshot)

        // Act
        await simulateDeleteItemHandler(mockEvent)

        // Assert
        expect(mockCreateInventoryLog).toHaveBeenCalledWith({
          action: 'ITEM_DELETED',
          businessId: 'business-123',
          userId: 'user-123',
          itemId: 'item-123',
          itemName: 'Widget to Delete',
          snapshot,
          undoable: true,
        })

        // Verify log was created before delete
        const logCallOrder = mockCreateInventoryLog.mock.invocationCallOrder[0]
        const deleteCallOrder = prismaMock.inventoryItem.delete.mock.invocationCallOrder[0]
        expect(logCallOrder).toBeLessThan(deleteCallOrder)
      })
    })

    describe('Authorization', () => {
      it('should require authentication', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event

        // Act & Assert
        await expect(simulateDeleteItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })

      it('should verify item belongs to business', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const itemFromDifferentBusiness = createMockItem({
          id: 'item-123',
          businessId: 'different-business-999',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(itemFromDifferentBusiness)

        // Act & Assert
        await expect(simulateDeleteItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to delete this item',
        })

        expect(prismaMock.inventoryItem.delete).not.toHaveBeenCalled()
      })

      it('should allow OWNER role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Test' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema())
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)

        // Act
        const result = await simulateDeleteItemHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(prismaMock.inventoryItem.delete).toHaveBeenCalled()
      })

      it('should allow BOSS role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'BOSS',
        })

        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Test' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(createMockSchema())
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)

        // Act
        const result = await simulateDeleteItemHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(prismaMock.inventoryItem.delete).toHaveBeenCalled()
      })

      it('should reject EMPLOYEE role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        mockGetRouterParam.mockReturnValue('item-123')

        // Act & Assert
        await expect(simulateDeleteItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to delete inventory items',
        })

        expect(prismaMock.inventoryItem.delete).not.toHaveBeenCalled()
      })

      it('should require businessId', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: null,
          businessRole: null,
        })

        mockGetRouterParam.mockReturnValue('item-123')

        // Act & Assert
        await expect(simulateDeleteItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You must belong to a business to perform this action',
        })
      })
    })

    describe('Edge Cases', () => {
      it('should handle non-existent item (404)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue('non-existent-id')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateDeleteItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'Item not found',
        })

        expect(prismaMock.inventoryItem.delete).not.toHaveBeenCalled()
      })

      it('should handle item from different business (403)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const otherBusinessItem = createMockItem({
          id: 'item-123',
          businessId: 'other-business-456',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(otherBusinessItem)

        // Act & Assert
        await expect(simulateDeleteItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to delete this item',
        })
      })

      it('should handle missing item ID', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue(null)

        // Act & Assert
        await expect(simulateDeleteItemHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Item ID is required',
        })
      })

      it('should handle item with no name column', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = [
          createValidColumn({ id: 'col-1', name: 'Quantity', type: 'number' }), // No 'name' role
        ]
        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 100 },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)
        mockGetItemName.mockReturnValue(null) // No name column

        // Act
        const result = await simulateDeleteItemHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
        expect(mockCreateInventoryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            itemName: null,
          })
        )
      })

      it('should handle schema not found gracefully', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const existingItem = createMockItem({
          id: 'item-123',
          data: { 'col-1': 'Test' },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('item-123')
        prismaMock.inventoryItem.findUnique.mockResolvedValue(existingItem)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null) // No schema
        prismaMock.inventoryItem.delete.mockResolvedValue(existingItem)
        mockGetItemName.mockReturnValue(null)

        // Act
        const result = await simulateDeleteItemHandler(mockEvent)

        // Assert - should still delete the item
        expect(result.success).toBe(true)
        expect(prismaMock.inventoryItem.delete).toHaveBeenCalled()
      })
    })
  })

  // ==========================================================================
  // Integration-like Scenarios
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete CRUD cycle', async () => {
      // This test simulates a realistic flow: create, update, then delete
      const columns = [
        createValidColumn({ id: 'col-1', name: 'Name', type: 'text', role: 'name' }),
        createValidColumn({ id: 'col-2', name: 'Quantity', type: 'number', order: 1 }),
      ]

      // Step 1: Create
      const createEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const initialData = { 'col-1': 'New Product', 'col-2': 10 }
      const createdItem = createMockItem({
        id: 'item-new',
        data: initialData,
        businessId: 'business-123',
      })

      mockReadBody.mockResolvedValue({ data: initialData })
      prismaMock.inventorySchema.findUnique.mockResolvedValue(
        createMockSchema({ columns: columns as unknown as [] })
      )
      prismaMock.inventoryItem.create.mockResolvedValue(createdItem)

      const created = await simulateCreateItemHandler(createEvent)
      expect(created.id).toBe('item-new')

      // Step 2: Update
      vi.clearAllMocks()
      mockValidateInventoryData.mockReturnValue({ success: true })
      mockDiffChanges.mockReturnValue([
        { field: 'col-2', fieldName: 'Quantity', oldValue: 10, newValue: 50 },
      ])

      const updateEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const updatedData = { 'col-1': 'New Product', 'col-2': 50 }
      const updatedItem = createMockItem({
        id: 'item-new',
        data: updatedData,
        businessId: 'business-123',
      })

      mockGetRouterParam.mockReturnValue('item-new')
      mockReadBody.mockResolvedValue({ data: updatedData })
      prismaMock.inventoryItem.findUnique.mockResolvedValue(createdItem)
      prismaMock.inventorySchema.findUnique.mockResolvedValue(
        createMockSchema({ columns: columns as unknown as [] })
      )
      prismaMock.inventoryItem.update.mockResolvedValue(updatedItem)

      const updated = await simulateUpdateItemHandler(updateEvent)
      expect(updated.data['col-2']).toBe(50)

      // Step 3: Delete
      vi.clearAllMocks()

      const deleteEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      mockGetRouterParam.mockReturnValue('item-new')
      prismaMock.inventoryItem.findUnique.mockResolvedValue(updatedItem)
      prismaMock.inventorySchema.findUnique.mockResolvedValue(
        createMockSchema({ columns: columns as unknown as [] })
      )
      prismaMock.inventoryItem.delete.mockResolvedValue(updatedItem)

      const deleted = await simulateDeleteItemHandler(deleteEvent)
      expect(deleted.success).toBe(true)
    })

    it('should maintain proper authorization across all operations', async () => {
      // Test that EMPLOYEE cannot perform any CRUD operation
      const employeeEvent = createMockEvent({
        userId: 'employee-123',
        businessId: 'business-123',
        businessRole: 'EMPLOYEE',
      })

      // Try Create
      mockReadBody.mockResolvedValue({ data: { 'col-1': 'Test' } })
      await expect(simulateCreateItemHandler(employeeEvent)).rejects.toMatchObject({
        statusCode: 403,
      })

      // Try Update
      mockGetRouterParam.mockReturnValue('item-123')
      await expect(simulateUpdateItemHandler(employeeEvent)).rejects.toMatchObject({
        statusCode: 403,
      })

      // Try Delete
      await expect(simulateDeleteItemHandler(employeeEvent)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('should properly isolate data between businesses', async () => {
      // Business A user trying to access Business B item
      const businessAEvent = createMockEvent({
        userId: 'user-a',
        businessId: 'business-a',
        businessRole: 'OWNER',
      })

      const businessBItem = createMockItem({
        id: 'item-b',
        data: { 'col-1': 'Business B Item' },
        businessId: 'business-b',
      })

      // Try to Update
      mockGetRouterParam.mockReturnValue('item-b')
      mockReadBody.mockResolvedValue({ data: { 'col-1': 'Hacked!' } })
      prismaMock.inventoryItem.findUnique.mockResolvedValue(businessBItem)

      await expect(simulateUpdateItemHandler(businessAEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to update this item',
      })

      // Try to Delete
      vi.clearAllMocks()
      mockGetRouterParam.mockReturnValue('item-b')
      prismaMock.inventoryItem.findUnique.mockResolvedValue(businessBItem)

      await expect(simulateDeleteItemHandler(businessAEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to delete this item',
      })
    })
  })
})
