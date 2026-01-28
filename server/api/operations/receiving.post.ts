import type { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import type { OperationItem, ReceivingItemInput } from '~/types/operation'
import type { JwtPayload } from '~/server/utils/auth'
import { validateDate, STRING_LIMITS } from '~/server/utils/validation'
import { normalizeStringInput } from '~/server/utils/sanitization'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'
import { requireBusiness, requireRole } from '~/server/utils/permissions'
import { safeEmitInventoryUpdate } from '~/server/utils/socket'
import { getItemName } from '~/server/utils/inventoryLog'

/**
 * POST /api/operations/receiving
 * Creates a receiving operation that adds inventory quantities.
 *
 * Request body:
 * {
 *   date: string (ISO date),
 *   reference?: string,
 *   supplier?: string,
 *   notes?: string,
 *   items: [{ itemId: string, quantity: number }]
 * }
 *
 * This endpoint:
 * 1. Validates all items exist and belong to the business
 * 2. Updates each item's quantity (previousQty + quantity)
 * 3. Creates an Operation record with the full item details
 * 4. Emits socket events for real-time updates
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const body = await readBody(event)

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER', 'BOSS'], 'receive inventory')

  // Validate request body
  if (!body.date) {
    throw createError({
      statusCode: 400,
      message: 'Date is required',
    })
  }

  // Parse and validate date
  const operationDate = validateDate(body.date)

  // Validate items array
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one item is required',
    })
  }

  // Validate each item input
  const itemInputs: ReceivingItemInput[] = body.items
  for (const item of itemInputs) {
    if (!item.itemId || typeof item.itemId !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Each item must have a valid itemId',
      })
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw createError({
        statusCode: 400,
        message: 'Each item must have a positive integer quantity',
      })
    }
    // Validate costPerItem if provided
    if (item.costPerItem !== undefined && (typeof item.costPerItem !== 'number' || item.costPerItem < 0)) {
      throw createError({
        statusCode: 400,
        message: 'costPerItem must be a non-negative number',
      })
    }
  }

  // Validate optional string fields with length limits
  const reference = normalizeStringInput(body.reference)
  const supplier = normalizeStringInput(body.supplier)
  const notes = normalizeStringInput(body.notes)

  // Validate string lengths
  if (reference && reference.length > STRING_LIMITS.reference) {
    throw createError({
      statusCode: 400,
      message: `Reference must be at most ${STRING_LIMITS.reference} characters`,
    })
  }
  if (supplier && supplier.length > STRING_LIMITS.supplier) {
    throw createError({
      statusCode: 400,
      message: `Supplier must be at most ${STRING_LIMITS.supplier} characters`,
    })
  }
  if (notes && notes.length > STRING_LIMITS.notes) {
    throw createError({
      statusCode: 400,
      message: `Notes must be at most ${STRING_LIMITS.notes} characters`,
    })
  }

  // Get business schema to find the quantity column
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  if (!schema || !schema.columns) {
    throw createError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  const columns = parseColumnDefinitions(schema.columns)
  const quantityColumn = columns.find((c) => c.role === 'quantity')
  const costColumn = columns.find((c) => c.role === 'cost')

  if (!quantityColumn) {
    throw createError({
      statusCode: 400,
      message: 'No quantity column defined in schema. Please add a column with the "quantity" role.',
    })
  }

  // Fetch all items in a single query
  const itemIds = itemInputs.map((i) => i.itemId)
  const existingItems = await prisma.inventoryItem.findMany({
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
      throw createError({
        statusCode: 404,
        message: `Item with ID ${input.itemId} not found or does not belong to this business`,
      })
    }
  }

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
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
        data: { data: newData as Prisma.InputJsonValue },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      updatedItems.push(updatedItem)

      // Build the operation item record
      const itemName = getItemName(data, columns) || 'Unknown Item'
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
        items: operationItems as unknown as Prisma.InputJsonValue,
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
  safeEmitInventoryUpdate(auth.businessId!, result.operation, result.updatedItems)

  return result.operation
})
