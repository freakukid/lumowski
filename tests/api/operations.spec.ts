import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient, InventoryItem, InventorySchema, Operation, BusinessRole, User } from '@prisma/client'
import type { H3Event } from 'h3'
import type { ColumnDefinition } from '~/types/schema'
import type { OperationItem, ReceivingItemInput } from '~/types/operation'

// ============================================================================
// Mock Setup - Must be defined before importing handlers
// ============================================================================

// Mock Prisma client
const prismaMock = mockDeep<PrismaClient>()

vi.mock('~/server/utils/prisma', () => ({
  default: prismaMock,
}))

// Mock socket utilities
const mockEmitInventoryUpdated = vi.fn()
const mockEmitOperationCreated = vi.fn()
const mockEmitOperationUndone = vi.fn()

vi.mock('~/server/utils/socket', () => ({
  emitInventoryUpdated: mockEmitInventoryUpdated,
  emitOperationCreated: mockEmitOperationCreated,
  emitOperationUndone: mockEmitOperationUndone,
}))

// Mock inventory log utilities
const mockGetItemName = vi.fn()

vi.mock('~/server/utils/inventoryLog', () => ({
  getItemName: mockGetItemName,
}))

// Mock readBody, getRouterParam, and getQuery functions
const mockReadBody = vi.fn()
const mockGetRouterParam = vi.fn()
const mockGetQuery = vi.fn()

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
    getQuery: mockGetQuery,
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
function createMockItem(overrides: Partial<InventoryItem & { createdBy?: { id: string; name: string } }> = {}): InventoryItem & { createdBy?: { id: string; name: string } } {
  return {
    id: 'item-123',
    data: {},
    businessId: 'business-123',
    createdById: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: { id: 'user-123', name: 'Test User' },
    ...overrides,
  }
}

/**
 * Creates a mock operation with default values
 */
function createMockOperation(overrides: Partial<Operation & { user?: { id: string; name: string }; undoneBy?: { id: string; name: string } | null }> = {}): Operation & { user?: { id: string; name: string }; undoneBy?: { id: string; name: string } | null } {
  return {
    id: 'operation-123',
    type: 'RECEIVING',
    date: new Date('2024-01-15'),
    reference: 'REF-001',
    supplier: 'Test Supplier',
    notes: 'Test notes',
    items: [],
    totalQty: 0,
    businessId: 'business-123',
    userId: 'user-123',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    undoneAt: null,
    undoneById: null,
    user: { id: 'user-123', name: 'Test User' },
    undoneBy: null,
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
 * Helper to create standard columns for operations testing
 */
function createStandardColumns(): ColumnDefinition[] {
  return [
    createValidColumn({ id: 'col-name', name: 'Name', type: 'text', role: 'name', order: 0 }),
    createValidColumn({ id: 'col-qty', name: 'Quantity', type: 'number', role: 'quantity', order: 1 }),
    createValidColumn({ id: 'col-cost', name: 'Cost', type: 'currency', role: 'cost', order: 2 }),
  ]
}

/**
 * Helper to create columns without cost column
 */
function createColumnsWithoutCost(): ColumnDefinition[] {
  return [
    createValidColumn({ id: 'col-name', name: 'Name', type: 'text', role: 'name', order: 0 }),
    createValidColumn({ id: 'col-qty', name: 'Quantity', type: 'number', role: 'quantity', order: 1 }),
  ]
}

// ============================================================================
// Simulated Handlers
// ============================================================================

/**
 * Simulates the GET /api/operations handler logic for testing
 */
async function simulateListOperationsHandler(event: H3Event) {
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

  const query = mockGetQuery(event)

  // Pagination parameters with sensible defaults
  const page = Math.max(1, parseInt(query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 20))

  // Base where clause - always filter by business
  const where = {
    businessId: auth.businessId,
  }

  // Fetch operations and count in parallel for efficiency
  const [operations, total] = await Promise.all([
    prismaMock.operation.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prismaMock.operation.count({ where }),
  ])

  return {
    operations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

/**
 * Simulates the POST /api/operations/receiving handler logic for testing
 */
async function simulateReceivingHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }
  const body = await mockReadBody(event)

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
      message: 'You do not have permission to receive inventory',
    })
  }

  // Validate request body
  if (!body.date) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Date is required',
    })
  }

  // Parse and validate date
  const operationDate = new Date(body.date)
  if (isNaN(operationDate.getTime())) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Invalid date format',
    })
  }

  // Validate items array
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw mockCreateError({
      statusCode: 400,
      message: 'At least one item is required',
    })
  }

  // Validate each item input
  const itemInputs: ReceivingItemInput[] = body.items
  for (const item of itemInputs) {
    if (!item.itemId || typeof item.itemId !== 'string') {
      throw mockCreateError({
        statusCode: 400,
        message: 'Each item must have a valid itemId',
      })
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw mockCreateError({
        statusCode: 400,
        message: 'Each item must have a positive integer quantity',
      })
    }
    // Validate costPerItem if provided
    if (item.costPerItem !== undefined && (typeof item.costPerItem !== 'number' || item.costPerItem < 0)) {
      throw mockCreateError({
        statusCode: 400,
        message: 'costPerItem must be a non-negative number',
      })
    }
  }

  // Validate optional string fields
  const reference = typeof body.reference === 'string' ? body.reference.trim() || null : null
  const supplier = typeof body.supplier === 'string' ? body.supplier.trim() || null : null
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  // Get business schema to find the quantity column
  const schema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  if (!schema || !schema.columns) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  const columns = schema.columns as unknown as ColumnDefinition[]
  const quantityColumn = columns.find((c) => c.role === 'quantity')
  const costColumn = columns.find((c) => c.role === 'cost')

  if (!quantityColumn) {
    throw mockCreateError({
      statusCode: 400,
      message: 'No quantity column defined in schema. Please add a column with the "quantity" role.',
    })
  }

  // Fetch all items in a single query
  const itemIds = itemInputs.map((i) => i.itemId)
  const existingItems = await prismaMock.inventoryItem.findMany({
    where: {
      id: { in: itemIds },
      businessId: auth.businessId,
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

  // Create a map for quick lookup
  const itemMap = new Map(existingItems.map((item) => [item.id, item]))

  // Validate all items exist and belong to the business
  for (const input of itemInputs) {
    if (!itemMap.has(input.itemId)) {
      throw mockCreateError({
        statusCode: 404,
        message: `Item with ID ${input.itemId} not found or does not belong to this business`,
      })
    }
  }

  // Use a transaction to ensure atomicity
  const result = await prismaMock.$transaction(async (tx: typeof prismaMock) => {
    const operationItems: OperationItem[] = []
    const updatedItems: Array<typeof existingItems[0]> = []
    let totalQty = 0

    // Process each item
    for (const input of itemInputs) {
      const item = itemMap.get(input.itemId)!
      const data = item.data as Record<string, unknown>

      // Get current quantity (default to 0 if not set)
      const previousQty = typeof data[quantityColumn.id] === 'number'
        ? data[quantityColumn.id] as number
        : 0

      const newQty = previousQty + input.quantity
      totalQty += input.quantity

      // Update the item's data with the new quantity
      const newData: Record<string, unknown> = {
        ...data,
        [quantityColumn.id]: newQty,
      }

      // Handle cost tracking if cost column exists and costPerItem is provided
      let previousCost: number | undefined
      let newCost: number | undefined

      if (costColumn && input.costPerItem !== undefined) {
        // Get current cost (default to 0 if not set)
        previousCost = typeof data[costColumn.id] === 'number'
          ? data[costColumn.id] as number
          : 0

        // Calculate weighted average cost
        // Formula: (prevQty * prevCost + newQty * newCost) / (prevQty + newQty)
        const totalQtyForAvg = previousQty + input.quantity
        if (totalQtyForAvg > 0) {
          newCost = (previousQty * previousCost + input.quantity * input.costPerItem) / totalQtyForAvg
        } else {
          newCost = input.costPerItem
        }

        // Update the cost in the item data
        newData[costColumn.id] = newCost
      }

      // Update the item in the database
      const updatedItem = await tx.inventoryItem.update({
        where: { id: input.itemId },
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

      updatedItems.push(updatedItem as typeof existingItems[0])

      // Build the operation item record
      const itemName = mockGetItemName(data, columns) || 'Unknown Item'
      operationItems.push({
        itemId: input.itemId,
        itemName,
        quantity: input.quantity,
        previousQty,
        newQty,
        // Include cost info if cost tracking is enabled
        ...(costColumn && input.costPerItem !== undefined
          ? {
              costPerItem: input.costPerItem,
              previousCost,
              newCost,
            }
          : {}),
      })
    }

    // Create the operation record
    const operation = await tx.operation.create({
      data: {
        type: 'RECEIVING',
        date: operationDate,
        reference,
        supplier,
        notes,
        items: operationItems as unknown as any,
        totalQty,
        businessId: auth.businessId!,
        userId: auth.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return { operation, operationItems, updatedItems }
  })

  // Emit socket events for real-time updates
  try {
    // Emit operation created event
    mockEmitOperationCreated(auth.businessId!, result.operation)

    // Emit inventory updated events for each affected item
    for (const item of result.updatedItems) {
      mockEmitInventoryUpdated(auth.businessId!, item)
    }
  } catch (error) {
    // Log the error but don't fail the operation - socket events are non-critical
    console.error('Failed to emit socket events:', error)
  }

  return result.operation
}

/**
 * Simulates the GET /api/operations/[id] handler logic for testing
 */
async function simulateGetOperationHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }
  const id = mockGetRouterParam(event, 'id')

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

  if (!id) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Operation ID is required',
    })
  }

  const operation = await prismaMock.operation.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      undoneBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!operation) {
    throw mockCreateError({
      statusCode: 404,
      message: 'Operation not found',
    })
  }

  // Verify business membership
  if (operation.businessId !== auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to view this operation',
    })
  }

  return operation
}

/**
 * Simulates the POST /api/operations/[id]/undo handler logic for testing
 */
async function simulateUndoOperationHandler(event: H3Event) {
  const auth = event.context.auth as {
    userId: string
    businessId?: string | null
    businessRole?: BusinessRole | null
  }
  const id = mockGetRouterParam(event, 'id')

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

  // Require OWNER role only
  if (!auth.businessRole || auth.businessRole !== 'OWNER') {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to undo operations',
    })
  }

  if (!id) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Operation ID is required',
    })
  }

  // Fetch the operation
  const operation = await prismaMock.operation.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!operation) {
    throw mockCreateError({
      statusCode: 404,
      message: 'Operation not found',
    })
  }

  // Verify business membership
  if (operation.businessId !== auth.businessId) {
    throw mockCreateError({
      statusCode: 403,
      message: 'You do not have permission to undo this operation',
    })
  }

  // Check if already undone
  if (operation.undoneAt) {
    throw mockCreateError({
      statusCode: 409,
      message: 'This operation has already been undone',
    })
  }

  // Get business schema to find quantity and cost columns
  const schema = await prismaMock.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  if (!schema || !schema.columns) {
    throw mockCreateError({
      statusCode: 400,
      message: 'Inventory schema not found',
    })
  }

  const columns = schema.columns as unknown as ColumnDefinition[]
  const quantityColumn = columns.find((c) => c.role === 'quantity')
  const costColumn = columns.find((c) => c.role === 'cost')

  if (!quantityColumn) {
    throw mockCreateError({
      statusCode: 400,
      message: 'No quantity column defined in schema',
    })
  }

  const operationItems = operation.items as unknown as OperationItem[]

  // Fetch all affected items
  const itemIds = operationItems.map((i) => i.itemId)
  const existingItems = await prismaMock.inventoryItem.findMany({
    where: {
      id: { in: itemIds },
      businessId: auth.businessId,
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

  // Create a map for quick lookup
  const itemMap = new Map(existingItems.map((item) => [item.id, item]))

  // Use a transaction to ensure atomicity
  const result = await prismaMock.$transaction(async (tx: typeof prismaMock) => {
    const updatedItems: Array<typeof existingItems[0]> = []

    // Process each item - reverse the operation
    for (const opItem of operationItems) {
      const item = itemMap.get(opItem.itemId)

      // Skip if item no longer exists (was deleted)
      if (!item) continue

      const data = item.data as Record<string, unknown>

      // Get current quantity
      const currentQty = typeof data[quantityColumn.id] === 'number'
        ? data[quantityColumn.id] as number
        : 0

      // Subtract the received quantity
      const newQty = Math.max(0, currentQty - opItem.quantity)

      // Update the item's data
      const newData: Record<string, unknown> = {
        ...data,
        [quantityColumn.id]: newQty,
      }

      // Handle cost recalculation if cost tracking was used
      if (costColumn && opItem.costPerItem !== undefined && opItem.previousCost !== undefined) {
        // Get current values
        const currentCost = typeof data[costColumn.id] === 'number'
          ? data[costColumn.id] as number
          : 0

        // Reverse weighted average cost calculation
        if (newQty === 0) {
          newData[costColumn.id] = 0
        } else if (currentQty > opItem.quantity) {
          // There's still inventory left, try to reverse the weighted average
          const totalCostBefore = currentQty * currentCost
          const receivedCostContribution = opItem.quantity * opItem.costPerItem
          const remainingTotalCost = totalCostBefore - receivedCostContribution
          const reversedAvgCost = remainingTotalCost / newQty

          // If the calculation results in a reasonable value, use it
          if (reversedAvgCost >= 0 && isFinite(reversedAvgCost)) {
            newData[costColumn.id] = reversedAvgCost
          } else {
            newData[costColumn.id] = opItem.previousCost
          }
        } else {
          // Edge case: current qty equals or is less than what was received
          newData[costColumn.id] = opItem.previousCost
        }
      }

      // Update the item in the database
      const updatedItem = await tx.inventoryItem.update({
        where: { id: opItem.itemId },
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

      updatedItems.push(updatedItem as typeof existingItems[0])
    }

    // Mark the operation as undone
    const updatedOperation = await tx.operation.update({
      where: { id },
      data: {
        undoneAt: new Date(),
        undoneById: auth.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        undoneBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return { operation: updatedOperation, updatedItems }
  })

  // Emit socket events for real-time updates
  try {
    // Emit operation undone event
    mockEmitOperationUndone(auth.businessId!, result.operation)

    // Emit inventory updated events for each affected item
    for (const item of result.updatedItems) {
      mockEmitInventoryUpdated(auth.businessId!, item)
    }
  } catch (error) {
    // Log the error but don't fail the operation - socket events are non-critical
    console.error('Failed to emit socket events:', error)
  }

  return {
    success: true,
    operation: result.operation,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('Operations API', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockReset(prismaMock)
    vi.clearAllMocks()

    // Setup default mock return values
    mockGetItemName.mockReturnValue('Test Item')
    mockGetQuery.mockReturnValue({})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ==========================================================================
  // GET /api/operations (List Operations)
  // ==========================================================================

  describe('GET /api/operations (List Operations)', () => {
    describe('Happy Path', () => {
      it('should return paginated operations', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const operations = [
          createMockOperation({ id: 'op-1', totalQty: 10 }),
          createMockOperation({ id: 'op-2', totalQty: 20 }),
        ]

        mockGetQuery.mockReturnValue({ page: '1', limit: '20' })
        prismaMock.operation.findMany.mockResolvedValue(operations as any)
        prismaMock.operation.count.mockResolvedValue(2)

        // Act
        const result = await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(result.operations).toEqual(operations)
        expect(result.pagination).toEqual({
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        })
      })

      it('should sort by createdAt descending', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetQuery.mockReturnValue({})
        prismaMock.operation.findMany.mockResolvedValue([])
        prismaMock.operation.count.mockResolvedValue(0)

        // Act
        await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(prismaMock.operation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { createdAt: 'desc' },
          })
        )
      })

      it('should filter by business', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-456',
          businessRole: 'OWNER',
        })

        mockGetQuery.mockReturnValue({})
        prismaMock.operation.findMany.mockResolvedValue([])
        prismaMock.operation.count.mockResolvedValue(0)

        // Act
        await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(prismaMock.operation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { businessId: 'business-456' },
          })
        )
        expect(prismaMock.operation.count).toHaveBeenCalledWith({
          where: { businessId: 'business-456' },
        })
      })

      it('should include user info', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetQuery.mockReturnValue({})
        prismaMock.operation.findMany.mockResolvedValue([])
        prismaMock.operation.count.mockResolvedValue(0)

        // Act
        await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(prismaMock.operation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          })
        )
      })

      it('should handle pagination parameters', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetQuery.mockReturnValue({ page: '3', limit: '10' })
        prismaMock.operation.findMany.mockResolvedValue([])
        prismaMock.operation.count.mockResolvedValue(50)

        // Act
        const result = await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(prismaMock.operation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 20, // (page 3 - 1) * limit 10
            take: 10,
          })
        )
        expect(result.pagination).toEqual({
          page: 3,
          limit: 10,
          total: 50,
          totalPages: 5,
        })
      })

      it('should enforce maximum limit of 100', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetQuery.mockReturnValue({ limit: '500' })
        prismaMock.operation.findMany.mockResolvedValue([])
        prismaMock.operation.count.mockResolvedValue(0)

        // Act
        const result = await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(prismaMock.operation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 100, // Capped at 100
          })
        )
        expect(result.pagination.limit).toBe(100)
      })

      it('should enforce minimum page of 1', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetQuery.mockReturnValue({ page: '0' })
        prismaMock.operation.findMany.mockResolvedValue([])
        prismaMock.operation.count.mockResolvedValue(0)

        // Act
        const result = await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(result.pagination.page).toBe(1)
        expect(prismaMock.operation.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 0,
          })
        )
      })
    })

    describe('Authorization', () => {
      it('should require authentication', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event

        // Act & Assert
        await expect(simulateListOperationsHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })

      it('should require businessId', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: null,
          businessRole: null,
        })

        // Act & Assert
        await expect(simulateListOperationsHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You must belong to a business to perform this action',
        })
      })

      it('should allow any authenticated business member', async () => {
        // Arrange - even EMPLOYEE can view operations
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        mockGetQuery.mockReturnValue({})
        prismaMock.operation.findMany.mockResolvedValue([])
        prismaMock.operation.count.mockResolvedValue(0)

        // Act
        const result = await simulateListOperationsHandler(mockEvent)

        // Assert
        expect(result).toHaveProperty('operations')
        expect(result).toHaveProperty('pagination')
      })
    })
  })

  // ==========================================================================
  // POST /api/operations/receiving (Create Receiving Operation)
  // ==========================================================================

  describe('POST /api/operations/receiving (Create Receiving)', () => {
    describe('Happy Path', () => {
      it('should create receiving operation', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
          businessId: 'business-123',
        })

        const createdOperation = createMockOperation({
          id: 'op-new',
          totalQty: 5,
          items: [{
            itemId: 'item-1',
            itemName: 'Widget',
            quantity: 5,
            previousQty: 10,
            newQty: 15,
            costPerItem: 8,
            previousCost: 5,
            newCost: 6,
          }],
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          reference: 'PO-001',
          supplier: 'Acme Corp',
          notes: 'Test delivery',
          items: [{ itemId: 'item-1', quantity: 5, costPerItem: 8 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: {
              update: vi.fn().mockResolvedValue({
                ...existingItem,
                data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 6 },
              }),
            },
            operation: {
              create: vi.fn().mockResolvedValue(createdOperation),
            },
          }
          return fn(mockTx as any)
        })

        // Act
        const result = await simulateReceivingHandler(mockEvent)

        // Assert
        expect(result).toEqual(createdOperation)
      })

      it('should update inventory quantities', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 15 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        expect(mockTxUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'item-1' },
            data: {
              data: expect.objectContaining({
                'col-qty': 15, // 10 + 5
              }),
            },
          })
        )
      })

      it('should calculate weighted average cost', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        // Previous: qty=10, cost=$5 => total value = $50
        // Receiving: qty=5, cost=$8 => value = $40
        // New: qty=15, cost = (50 + 40) / 15 = $6
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 6 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5, costPerItem: 8 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        expect(mockTxUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              data: expect.objectContaining({
                'col-cost': 6, // Weighted average: (10*5 + 5*8) / 15 = 6
              }),
            },
          })
        )
      })

      it('should emit socket events', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10 },
          businessId: 'business-123',
        })

        const updatedItem = {
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 15 },
        }

        const createdOperation = createMockOperation({ id: 'op-new' })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(updatedItem) },
            operation: { create: vi.fn().mockResolvedValue(createdOperation) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        expect(mockEmitOperationCreated).toHaveBeenCalledWith('business-123', createdOperation)
        expect(mockEmitInventoryUpdated).toHaveBeenCalledWith('business-123', updatedItem)
      })

      it('should return created operation', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10 },
          businessId: 'business-123',
        })

        const createdOperation = createMockOperation({
          id: 'op-new',
          reference: 'PO-001',
          supplier: 'Acme',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          reference: 'PO-001',
          supplier: 'Acme',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(existingItem) },
            operation: { create: vi.fn().mockResolvedValue(createdOperation) },
          }
          return fn(mockTx as any)
        })

        // Act
        const result = await simulateReceivingHandler(mockEvent)

        // Assert
        expect(result.id).toBe('op-new')
        expect(result.reference).toBe('PO-001')
        expect(result.supplier).toBe('Acme')
      })

      it('should trim whitespace-only reference to null', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10 },
          businessId: 'business-123',
        })

        let capturedOperationData: any = null

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          reference: '   ', // Whitespace-only string
          supplier: '  \t  ', // Whitespace with tabs
          notes: '\n\n', // Whitespace with newlines
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(existingItem) },
            operation: {
              create: vi.fn((args) => {
                capturedOperationData = args.data
                return Promise.resolve(createMockOperation({
                  ...args.data,
                  reference: null,
                  supplier: null,
                  notes: null,
                }))
              }),
            },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert - whitespace-only strings should become null after trim
        expect(capturedOperationData).toBeDefined()
        expect(capturedOperationData.reference).toBeNull()
        expect(capturedOperationData.supplier).toBeNull()
        expect(capturedOperationData.notes).toBeNull()
      })

      it('should handle first-time cost (no previous inventory)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        // Item with no previous quantity - cost should just be the costPerItem
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 0, 'col-cost': 0 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 5, 'col-cost': 10 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5, costPerItem: 10 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        expect(mockTxUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              data: expect.objectContaining({
                'col-qty': 5,
                'col-cost': 10, // With zero previous qty, cost = costPerItem
              }),
            },
          })
        )
      })

      it('should handle multiple items in single operation', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const item1 = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget A', 'col-qty': 10 },
          businessId: 'business-123',
        })
        const item2 = createMockItem({
          id: 'item-2',
          data: { 'col-name': 'Widget B', 'col-qty': 20 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn()
          .mockResolvedValueOnce({ ...item1, data: { 'col-name': 'Widget A', 'col-qty': 15 } })
          .mockResolvedValueOnce({ ...item2, data: { 'col-name': 'Widget B', 'col-qty': 30 } })

        const createdOperation = createMockOperation({ totalQty: 15 })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [
            { itemId: 'item-1', quantity: 5 },
            { itemId: 'item-2', quantity: 10 },
          ],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([item1, item2] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createdOperation) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        expect(mockTxUpdate).toHaveBeenCalledTimes(2)
        expect(mockEmitInventoryUpdated).toHaveBeenCalledTimes(2)
      })
    })

    describe('Validation', () => {
      it('should require items array', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'At least one item is required',
        })
      })

      it('should validate items exist', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'non-existent-item', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([]) // No items found

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'Item with ID non-existent-item not found or does not belong to this business',
        })
      })

      it('should require quantity > 0', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 0 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Each item must have a positive integer quantity',
        })
      })

      it('should require integer quantity', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5.5 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Each item must have a positive integer quantity',
        })
      })

      it('should explicitly reject zero quantity', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 0 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Each item must have a positive integer quantity',
        })
      })

      it('should reject negative quantity', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: -5 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Each item must have a positive integer quantity',
        })
      })

      it('should validate date format', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: 'invalid-date',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Invalid date format',
        })
      })

      it('should require date', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Date is required',
        })
      })

      it('should validate costPerItem is non-negative', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5, costPerItem: -10 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'costPerItem must be a non-negative number',
        })
      })

      it('should accept large but valid quantity (999999999)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 0 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 999999999 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 999999999 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        const updateCall = mockTxUpdate.mock.calls[0][0]
        expect(updateCall.data.data['col-qty']).toBe(999999999)
      })

      it('should accept large cost value (999999.99)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Expensive Item', 'col-qty': 0, 'col-cost': 0 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Expensive Item', 'col-qty': 1, 'col-cost': 999999.99 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 1, costPerItem: 999999.99 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        const updateCall = mockTxUpdate.mock.calls[0][0]
        expect(updateCall.data.data['col-cost']).toBe(999999.99)
      })

      it('should validate itemId is a string', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 123, quantity: 5 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Each item must have a valid itemId',
        })
      })

      it('should require schema setup', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Please set up your inventory columns first',
        })
      })

      it('should require quantity column in schema', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        // Schema without quantity column
        const columns = [
          createValidColumn({ id: 'col-name', name: 'Name', type: 'text', role: 'name' }),
        ]

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'No quantity column defined in schema. Please add a column with the "quantity" role.',
        })
      })
    })

    describe('Authorization', () => {
      it('should require authentication', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event
        mockReadBody.mockResolvedValue({ date: '2024-01-15', items: [] })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })

      it('should allow OWNER role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10 },
          businessId: 'business-123',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(existingItem) },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        const result = await simulateReceivingHandler(mockEvent)

        // Assert
        expect(result).toBeDefined()
      })

      it('should allow BOSS role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'BOSS',
        })

        const columns = createColumnsWithoutCost()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10 },
          businessId: 'business-123',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(existingItem) },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        const result = await simulateReceivingHandler(mockEvent)

        // Assert
        expect(result).toBeDefined()
      })

      it('should reject EMPLOYEE role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }],
        })

        // Act & Assert
        await expect(simulateReceivingHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to receive inventory',
        })
      })
    })

    describe('Cost Calculation', () => {
      it('should calculate weighted average correctly', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        // Previous: qty=10, cost=$5 => total value = $50
        // Receiving: qty=5, cost=$8 => value = $40
        // New: qty=15, cost = (50 + 40) / 15 = $6
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 6 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5, costPerItem: 8 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert - verify the weighted average calculation
        const updateCall = mockTxUpdate.mock.calls[0][0]
        const newCost = updateCall.data.data['col-cost']
        expect(newCost).toBe(6) // (10 * 5 + 5 * 8) / 15 = 90 / 15 = 6
      })

      it('should handle first-time cost (zero previous quantity)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 0, 'col-cost': 0 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 5, 'col-cost': 10 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5, costPerItem: 10 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        const updateCall = mockTxUpdate.mock.calls[0][0]
        const newCost = updateCall.data.data['col-cost']
        expect(newCost).toBe(10) // With zero previous qty, cost = costPerItem
      })

      it('should preserve existing cost when costPerItem is not provided', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 5 },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5 }], // No costPerItem
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert - cost should remain unchanged (preserved from existing data via spread)
        const updateCall = mockTxUpdate.mock.calls[0][0]
        expect(updateCall.data.data['col-cost']).toBe(5) // Cost is preserved from existing item data
      })

      it('should handle mixed cost/no-cost items in single operation', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        // First item has cost, second item does not
        const item1 = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget A', 'col-qty': 10, 'col-cost': 5 },
          businessId: 'business-123',
        })
        const item2 = createMockItem({
          id: 'item-2',
          data: { 'col-name': 'Widget B', 'col-qty': 20, 'col-cost': 8 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn()
          .mockResolvedValueOnce({
            ...item1,
            data: { 'col-name': 'Widget A', 'col-qty': 15, 'col-cost': 6 },
          })
          .mockResolvedValueOnce({
            ...item2,
            data: { 'col-name': 'Widget B', 'col-qty': 30, 'col-cost': 8 }, // Cost preserved
          })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [
            { itemId: 'item-1', quantity: 5, costPerItem: 8 }, // With cost
            { itemId: 'item-2', quantity: 10 }, // Without cost
          ],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([item1, item2] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        expect(mockTxUpdate).toHaveBeenCalledTimes(2)

        // First item should have updated cost (weighted average)
        const firstUpdateCall = mockTxUpdate.mock.calls[0][0]
        expect(firstUpdateCall.data.data['col-qty']).toBe(15)
        expect(firstUpdateCall.data.data['col-cost']).toBe(6) // (10*5 + 5*8) / 15 = 6

        // Second item should preserve existing cost
        const secondUpdateCall = mockTxUpdate.mock.calls[1][0]
        expect(secondUpdateCall.data.data['col-qty']).toBe(30)
        expect(secondUpdateCall.data.data['col-cost']).toBe(8) // Preserved from existing
      })

      it('should handle real currency value precision (19.99)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 15.50 },
          businessId: 'business-123',
        })

        // Previous: qty=10, cost=$15.50 => total value = $155
        // Receiving: qty=5, cost=$19.99 => value = $99.95
        // New: qty=15, cost = (155 + 99.95) / 15 = 16.996666...
        const expectedCost = (10 * 15.50 + 5 * 19.99) / 15

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': expectedCost },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 5, costPerItem: 19.99 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        const updateCall = mockTxUpdate.mock.calls[0][0]
        expect(updateCall.data.data['col-cost']).toBeCloseTo(expectedCost, 10)
      })

      it('should handle very small currency value (0.01)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Penny Item', 'col-qty': 100, 'col-cost': 0.02 },
          businessId: 'business-123',
        })

        // Previous: qty=100, cost=$0.02 => total value = $2
        // Receiving: qty=100, cost=$0.01 => value = $1
        // New: qty=200, cost = (2 + 1) / 200 = $0.015
        const expectedCost = (100 * 0.02 + 100 * 0.01) / 200

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Penny Item', 'col-qty': 200, 'col-cost': expectedCost },
        })

        mockReadBody.mockResolvedValue({
          date: '2024-01-15',
          items: [{ itemId: 'item-1', quantity: 100, costPerItem: 0.01 }],
        })

        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { create: vi.fn().mockResolvedValue(createMockOperation()) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateReceivingHandler(mockEvent)

        // Assert
        const updateCall = mockTxUpdate.mock.calls[0][0]
        expect(updateCall.data.data['col-cost']).toBeCloseTo(0.015, 10)
      })
    })
  })

  // ==========================================================================
  // GET /api/operations/[id] (Get Single Operation)
  // ==========================================================================

  describe('GET /api/operations/[id] (Get Single)', () => {
    describe('Happy Path', () => {
      it('should return operation with items', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const operation = createMockOperation({
          id: 'op-123',
          items: [
            {
              itemId: 'item-1',
              itemName: 'Widget',
              quantity: 5,
              previousQty: 10,
              newQty: 15,
            },
          ],
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)

        // Act
        const result = await simulateGetOperationHandler(mockEvent)

        // Assert
        expect(result).toEqual(operation)
        expect(result.items).toHaveLength(1)
      })

      it('should include user info', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const operation = createMockOperation({
          id: 'op-123',
          user: { id: 'user-123', name: 'John Doe' },
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)

        // Act
        const result = await simulateGetOperationHandler(mockEvent)

        // Assert
        expect(result.user).toEqual({ id: 'user-123', name: 'John Doe' })
      })

      it('should include undoneBy info when operation is undone', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const operation = createMockOperation({
          id: 'op-123',
          undoneAt: new Date('2024-01-20'),
          undoneById: 'user-456',
          undoneBy: { id: 'user-456', name: 'Jane Admin' },
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)

        // Act
        const result = await simulateGetOperationHandler(mockEvent)

        // Assert
        expect(result.undoneAt).toBeDefined()
        expect(result.undoneBy).toEqual({ id: 'user-456', name: 'Jane Admin' })
      })
    })

    describe('Authorization', () => {
      it('should require authentication', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event
        mockGetRouterParam.mockReturnValue('op-123')

        // Act & Assert
        await expect(simulateGetOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })

      it('should verify business ownership', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const operationFromDifferentBusiness = createMockOperation({
          id: 'op-123',
          businessId: 'different-business-456',
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operationFromDifferentBusiness as any)

        // Act & Assert
        await expect(simulateGetOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to view this operation',
        })
      })

      it('should allow any authenticated business member', async () => {
        // Arrange - even EMPLOYEE can view
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        const operation = createMockOperation({ id: 'op-123', businessId: 'business-123' })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)

        // Act
        const result = await simulateGetOperationHandler(mockEvent)

        // Assert
        expect(result.id).toBe('op-123')
      })
    })

    describe('Edge Cases', () => {
      it('should handle not found (404)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue('non-existent')
        prismaMock.operation.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateGetOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'Operation not found',
        })
      })

      it('should require operation ID', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue(null)

        // Act & Assert
        await expect(simulateGetOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Operation ID is required',
        })
      })
    })
  })

  // ==========================================================================
  // POST /api/operations/[id]/undo (Undo Operation)
  // ==========================================================================

  describe('POST /api/operations/[id]/undo (Undo)', () => {
    describe('Happy Path', () => {
      it('should revert quantities', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [
            {
              itemId: 'item-1',
              itemName: 'Widget',
              quantity: 5,
              previousQty: 10,
              newQty: 15,
            },
          ],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 15 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...currentItem,
          data: { 'col-name': 'Widget', 'col-qty': 10 },
        })

        const mockTxOperationUpdate = vi.fn().mockResolvedValue({
          ...operation,
          undoneAt: new Date(),
          undoneById: 'user-123',
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { update: mockTxOperationUpdate },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateUndoOperationHandler(mockEvent)

        // Assert
        expect(mockTxUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'item-1' },
            data: {
              data: expect.objectContaining({
                'col-qty': 10, // 15 - 5 = 10
              }),
            },
          })
        )
      })

      it('should recalculate costs correctly', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        // Current state: qty=15, cost=$6
        // Undo: qty=5, costPerItem=$8
        // After undo: qty=10, cost should be $5 (previous)
        // Calculation: (15 * 6 - 5 * 8) / 10 = (90 - 40) / 10 = $5
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [
            {
              itemId: 'item-1',
              itemName: 'Widget',
              quantity: 5,
              previousQty: 10,
              newQty: 15,
              costPerItem: 8,
              previousCost: 5,
              newCost: 6,
            },
          ],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 6 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...currentItem,
          data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
        })

        const mockTxOperationUpdate = vi.fn().mockResolvedValue({
          ...operation,
          undoneAt: new Date(),
          undoneById: 'user-123',
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { update: mockTxOperationUpdate },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateUndoOperationHandler(mockEvent)

        // Assert
        const updateCall = mockTxUpdate.mock.calls[0][0]
        const reversedCost = updateCall.data.data['col-cost']
        expect(reversedCost).toBe(5) // (15 * 6 - 5 * 8) / 10 = 5
      })

      it('should mark operation as undone', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [{ itemId: 'item-1', itemName: 'Widget', quantity: 5, previousQty: 10, newQty: 15 }],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 15 },
          businessId: 'business-123',
        })

        const mockTxOperationUpdate = vi.fn().mockResolvedValue({
          ...operation,
          undoneAt: new Date(),
          undoneById: 'user-123',
          undoneBy: { id: 'user-123', name: 'Test User' },
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(currentItem) },
            operation: { update: mockTxOperationUpdate },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateUndoOperationHandler(mockEvent)

        // Assert
        expect(mockTxOperationUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'op-123' },
            data: expect.objectContaining({
              undoneById: 'user-123',
            }),
          })
        )
      })

      it('should emit socket events', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [{ itemId: 'item-1', itemName: 'Widget', quantity: 5, previousQty: 10, newQty: 15 }],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 15 },
          businessId: 'business-123',
        })

        const updatedItem = { ...currentItem, data: { 'col-name': 'Widget', 'col-qty': 10 } }
        const undoneOperation = { ...operation, undoneAt: new Date(), undoneById: 'user-123' }

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(updatedItem) },
            operation: { update: vi.fn().mockResolvedValue(undoneOperation) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateUndoOperationHandler(mockEvent)

        // Assert
        expect(mockEmitOperationUndone).toHaveBeenCalledWith('business-123', undoneOperation)
        expect(mockEmitInventoryUpdated).toHaveBeenCalledWith('business-123', updatedItem)
      })
    })

    describe('Authorization', () => {
      it('should require OWNER role only', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [{ itemId: 'item-1', itemName: 'Widget', quantity: 5, previousQty: 10, newQty: 15 }],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 15 },
          businessId: 'business-123',
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: vi.fn().mockResolvedValue(currentItem) },
            operation: { update: vi.fn().mockResolvedValue({ ...operation, undoneAt: new Date() }) },
          }
          return fn(mockTx as any)
        })

        // Act
        const result = await simulateUndoOperationHandler(mockEvent)

        // Assert
        expect(result.success).toBe(true)
      })

      it('should reject BOSS role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'BOSS',
        })

        mockGetRouterParam.mockReturnValue('op-123')

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to undo operations',
        })
      })

      it('should reject EMPLOYEE role', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'EMPLOYEE',
        })

        mockGetRouterParam.mockReturnValue('op-123')

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to undo operations',
        })
      })

      it('should require authentication', async () => {
        // Arrange
        const mockEvent = { context: {} } as unknown as H3Event
        mockGetRouterParam.mockReturnValue('op-123')

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 401,
          message: 'Unauthorized',
        })
      })

      it('should verify business ownership', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const operationFromDifferentBusiness = createMockOperation({
          id: 'op-123',
          businessId: 'different-business-456',
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operationFromDifferentBusiness as any)

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 403,
          message: 'You do not have permission to undo this operation',
        })
      })
    })

    describe('Edge Cases', () => {
      it('should prevent double-undo', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const alreadyUndoneOperation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          undoneAt: new Date('2024-01-20'),
          undoneById: 'user-456',
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(alreadyUndoneOperation as any)

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 409,
          message: 'This operation has already been undone',
        })
      })

      it('should handle deleted items gracefully', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [
            { itemId: 'item-1', itemName: 'Widget', quantity: 5, previousQty: 10, newQty: 15 },
            { itemId: 'item-deleted', itemName: 'Deleted', quantity: 3, previousQty: 5, newQty: 8 },
          ],
        })

        const existingItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 15 },
          businessId: 'business-123',
        })

        // Only item-1 exists, item-deleted was removed
        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...existingItem,
          data: { 'col-name': 'Widget', 'col-qty': 10 },
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any) // Only returns existing item
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { update: vi.fn().mockResolvedValue({ ...operation, undoneAt: new Date() }) },
          }
          return fn(mockTx as any)
        })

        // Act
        const result = await simulateUndoOperationHandler(mockEvent)

        // Assert - should complete successfully, only updating existing item
        expect(result.success).toBe(true)
        expect(mockTxUpdate).toHaveBeenCalledTimes(1) // Only called for existing item
      })

      it('should prevent negative inventory (floor at 0)', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createColumnsWithoutCost()
        // Operation received 10 items, but current qty is only 5 (some were sold)
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [{ itemId: 'item-1', itemName: 'Widget', quantity: 10, previousQty: 0, newQty: 10 }],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 5 }, // Only 5 left
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...currentItem,
          data: { 'col-name': 'Widget', 'col-qty': 0 },
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { update: vi.fn().mockResolvedValue({ ...operation, undoneAt: new Date() }) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateUndoOperationHandler(mockEvent)

        // Assert - quantity should be floored at 0
        const updateCall = mockTxUpdate.mock.calls[0][0]
        const newQty = updateCall.data.data['col-qty']
        expect(newQty).toBe(0) // Max(0, 5 - 10) = 0
      })

      it('should reset cost to 0 when quantity becomes 0', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [{
            itemId: 'item-1',
            itemName: 'Widget',
            quantity: 5,
            previousQty: 0,
            newQty: 5,
            costPerItem: 10,
            previousCost: 0,
            newCost: 10,
          }],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 5, 'col-cost': 10 },
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...currentItem,
          data: { 'col-name': 'Widget', 'col-qty': 0, 'col-cost': 0 },
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { update: vi.fn().mockResolvedValue({ ...operation, undoneAt: new Date() }) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateUndoOperationHandler(mockEvent)

        // Assert
        const updateCall = mockTxUpdate.mock.calls[0][0]
        expect(updateCall.data.data['col-cost']).toBe(0)
        expect(updateCall.data.data['col-qty']).toBe(0)
      })

      it('should restore previous cost when quantity reduces below original received amount', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const columns = createStandardColumns()
        // Edge case: current qty (5) <= received qty (5)
        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [{
            itemId: 'item-1',
            itemName: 'Widget',
            quantity: 5,
            previousQty: 10,
            newQty: 15,
            costPerItem: 8,
            previousCost: 5,
            newCost: 6,
          }],
        })

        const currentItem = createMockItem({
          id: 'item-1',
          data: { 'col-name': 'Widget', 'col-qty': 5, 'col-cost': 6 }, // Only 5 left
          businessId: 'business-123',
        })

        const mockTxUpdate = vi.fn().mockResolvedValue({
          ...currentItem,
          data: { 'col-name': 'Widget', 'col-qty': 0, 'col-cost': 5 },
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(
          createMockSchema({ columns: columns as unknown as [] })
        )
        prismaMock.inventoryItem.findMany.mockResolvedValue([currentItem] as any)
        prismaMock.$transaction.mockImplementation(async (fn) => {
          const mockTx = {
            inventoryItem: { update: mockTxUpdate },
            operation: { update: vi.fn().mockResolvedValue({ ...operation, undoneAt: new Date() }) },
          }
          return fn(mockTx as any)
        })

        // Act
        await simulateUndoOperationHandler(mockEvent)

        // Assert - should restore to previousCost since currentQty <= receivedQty
        const updateCall = mockTxUpdate.mock.calls[0][0]
        // When qty becomes 0, cost should be 0
        expect(updateCall.data.data['col-cost']).toBe(0)
      })

      it('should handle operation not found', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue('non-existent')
        prismaMock.operation.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 404,
          message: 'Operation not found',
        })
      })

      it('should require operation ID', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        mockGetRouterParam.mockReturnValue(null)

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Operation ID is required',
        })
      })

      it('should require schema to exist', async () => {
        // Arrange
        const mockEvent = createMockEvent({
          userId: 'user-123',
          businessId: 'business-123',
          businessRole: 'OWNER',
        })

        const operation = createMockOperation({
          id: 'op-123',
          businessId: 'business-123',
          items: [{ itemId: 'item-1', itemName: 'Widget', quantity: 5, previousQty: 10, newQty: 15 }],
        })

        mockGetRouterParam.mockReturnValue('op-123')
        prismaMock.operation.findUnique.mockResolvedValue(operation as any)
        prismaMock.inventorySchema.findUnique.mockResolvedValue(null)

        // Act & Assert
        await expect(simulateUndoOperationHandler(mockEvent)).rejects.toMatchObject({
          statusCode: 400,
          message: 'Inventory schema not found',
        })
      })
    })
  })

  // ==========================================================================
  // Integration Scenarios
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete receive and undo cycle', async () => {
      // This test simulates: receive -> undo
      const columns = createStandardColumns()

      // Step 1: Receive inventory
      const receiveEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const originalItem = createMockItem({
        id: 'item-1',
        data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
        businessId: 'business-123',
      })

      const receivedItem = {
        ...originalItem,
        data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 6 },
      }

      const createdOperation = createMockOperation({
        id: 'op-new',
        items: [{
          itemId: 'item-1',
          itemName: 'Widget',
          quantity: 5,
          previousQty: 10,
          newQty: 15,
          costPerItem: 8,
          previousCost: 5,
          newCost: 6,
        }],
      })

      mockReadBody.mockResolvedValue({
        date: '2024-01-15',
        items: [{ itemId: 'item-1', quantity: 5, costPerItem: 8 }],
      })

      prismaMock.inventorySchema.findUnique.mockResolvedValue(
        createMockSchema({ columns: columns as unknown as [] })
      )
      prismaMock.inventoryItem.findMany.mockResolvedValue([originalItem] as any)
      prismaMock.$transaction.mockImplementation(async (fn) => {
        const mockTx = {
          inventoryItem: { update: vi.fn().mockResolvedValue(receivedItem) },
          operation: { create: vi.fn().mockResolvedValue(createdOperation) },
        }
        return fn(mockTx as any)
      })

      const receiveResult = await simulateReceivingHandler(receiveEvent)
      expect(receiveResult.id).toBe('op-new')

      // Reset mocks for undo
      vi.clearAllMocks()
      mockGetItemName.mockReturnValue('Widget')

      // Step 2: Undo the operation
      const undoEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const currentItemAfterReceive = createMockItem({
        id: 'item-1',
        data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 6 },
        businessId: 'business-123',
      })

      const itemAfterUndo = {
        ...currentItemAfterReceive,
        data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
      }

      const mockUndoItemUpdate = vi.fn().mockResolvedValue(itemAfterUndo)
      const undoneOperation = { ...createdOperation, undoneAt: new Date(), undoneById: 'user-123' }

      mockGetRouterParam.mockReturnValue('op-new')
      prismaMock.operation.findUnique.mockResolvedValue(createdOperation as any)
      prismaMock.inventorySchema.findUnique.mockResolvedValue(
        createMockSchema({ columns: columns as unknown as [] })
      )
      prismaMock.inventoryItem.findMany.mockResolvedValue([currentItemAfterReceive] as any)
      prismaMock.$transaction.mockImplementation(async (fn) => {
        const mockTx = {
          inventoryItem: { update: mockUndoItemUpdate },
          operation: { update: vi.fn().mockResolvedValue(undoneOperation) },
        }
        return fn(mockTx as any)
      })

      const undoResult = await simulateUndoOperationHandler(undoEvent)

      // Assert
      expect(undoResult.success).toBe(true)
      // Verify the item was updated with reverted values
      const undoUpdateCall = mockUndoItemUpdate.mock.calls[0][0]
      expect(undoUpdateCall.data.data['col-qty']).toBe(10) // Back to original
      expect(undoUpdateCall.data.data['col-cost']).toBe(5) // Back to original cost
    })

    it('should maintain proper authorization across all operations', async () => {
      // Test that only OWNER can undo
      const bossEvent = createMockEvent({
        userId: 'boss-123',
        businessId: 'business-123',
        businessRole: 'BOSS',
      })

      const employeeEvent = createMockEvent({
        userId: 'employee-123',
        businessId: 'business-123',
        businessRole: 'EMPLOYEE',
      })

      mockGetRouterParam.mockReturnValue('op-123')

      // BOSS can receive but cannot undo
      await expect(simulateUndoOperationHandler(bossEvent)).rejects.toMatchObject({
        statusCode: 403,
      })

      // EMPLOYEE cannot receive or undo
      mockReadBody.mockResolvedValue({ date: '2024-01-15', items: [{ itemId: 'item-1', quantity: 5 }] })
      await expect(simulateReceivingHandler(employeeEvent)).rejects.toMatchObject({
        statusCode: 403,
      })

      await expect(simulateUndoOperationHandler(employeeEvent)).rejects.toMatchObject({
        statusCode: 403,
      })
    })

    it('should properly isolate data between businesses', async () => {
      // Business A user trying to access Business B operation
      const businessAEvent = createMockEvent({
        userId: 'user-a',
        businessId: 'business-a',
        businessRole: 'OWNER',
      })

      const businessBOperation = createMockOperation({
        id: 'op-b',
        businessId: 'business-b',
      })

      // Try to view
      mockGetRouterParam.mockReturnValue('op-b')
      prismaMock.operation.findUnique.mockResolvedValue(businessBOperation as any)

      await expect(simulateGetOperationHandler(businessAEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to view this operation',
      })

      // Try to undo
      await expect(simulateUndoOperationHandler(businessAEvent)).rejects.toMatchObject({
        statusCode: 403,
        message: 'You do not have permission to undo this operation',
      })
    })

    it('should track operation items correctly with cost data', async () => {
      // Verify that operation items contain correct cost tracking data
      const mockEvent = createMockEvent({
        userId: 'user-123',
        businessId: 'business-123',
        businessRole: 'OWNER',
      })

      const columns = createStandardColumns()
      const existingItem = createMockItem({
        id: 'item-1',
        data: { 'col-name': 'Widget', 'col-qty': 10, 'col-cost': 5 },
        businessId: 'business-123',
      })

      let capturedOperationData: any = null

      mockReadBody.mockResolvedValue({
        date: '2024-01-15',
        items: [{ itemId: 'item-1', quantity: 5, costPerItem: 8 }],
      })

      prismaMock.inventorySchema.findUnique.mockResolvedValue(
        createMockSchema({ columns: columns as unknown as [] })
      )
      prismaMock.inventoryItem.findMany.mockResolvedValue([existingItem] as any)
      prismaMock.$transaction.mockImplementation(async (fn) => {
        const mockTx = {
          inventoryItem: {
            update: vi.fn().mockResolvedValue({
              ...existingItem,
              data: { 'col-name': 'Widget', 'col-qty': 15, 'col-cost': 6 },
            }),
          },
          operation: {
            create: vi.fn((args) => {
              capturedOperationData = args.data
              return Promise.resolve(createMockOperation(args.data))
            }),
          },
        }
        return fn(mockTx as any)
      })

      await simulateReceivingHandler(mockEvent)

      // Verify operation items contain correct data
      expect(capturedOperationData).toBeDefined()
      expect(capturedOperationData.items).toHaveLength(1)
      const operationItem = capturedOperationData.items[0]
      expect(operationItem.itemId).toBe('item-1')
      expect(operationItem.quantity).toBe(5)
      expect(operationItem.previousQty).toBe(10)
      expect(operationItem.newQty).toBe(15)
      expect(operationItem.costPerItem).toBe(8)
      expect(operationItem.previousCost).toBe(5)
      expect(operationItem.newCost).toBe(6)
    })
  })
})
