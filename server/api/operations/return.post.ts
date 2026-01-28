import type { Prisma, RefundMethod as PrismaRefundMethod } from '@prisma/client'
import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import type { ReturnOperationItem, SaleOperationItem, ReturnItemCondition } from '~/types/operation'
import { validateDate, STRING_LIMITS } from '~/server/utils/validation'
import { normalizeStringInput } from '~/server/utils/sanitization'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'
import { requireRole } from '~/server/utils/permissions'
import { businessRoute } from '~/server/utils/apiMiddleware'
import { safeEmitInventoryUpdate } from '~/server/utils/socket'
import { getItemName } from '~/server/utils/inventoryLog'

/**
 * Zod schema for validating return item inputs.
 */
const returnItemSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  condition: z.enum(['resellable', 'damaged', 'defective']),
  reason: z.string().max(STRING_LIMITS.notes).optional(),
})

/**
 * POST /api/operations/return
 * Creates a return operation that processes customer returns.
 *
 * Request body:
 * {
 *   originalSaleId: string,
 *   date: string (ISO date),
 *   reason: string,
 *   refundMethod: 'CASH' | 'CARD' | 'ORIGINAL_METHOD',
 *   cardType?: 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER' (required when refundMethod is 'CARD'),
 *   notes?: string,
 *   items: [{ itemId: string, quantity: number, condition: 'resellable' | 'damaged' | 'defective', reason?: string }]
 * }
 *
 * This endpoint:
 * 1. Validates the original sale exists and belongs to the business
 * 2. Validates return quantities don't exceed original sale minus previous returns
 * 3. Calculates refund amounts from original prices/discounts
 * 4. Restores inventory for resellable items only (not damaged/defective)
 * 5. Creates a RETURN operation record linked to the original sale
 * 6. Emits socket events for real-time updates
 */
export default businessRoute(async (event, { auth, businessId }) => {
  const body = await readBody(event)

  // All staff roles can process returns (OWNER, BOSS, EMPLOYEE)
  requireRole(auth.businessRole, ['OWNER', 'BOSS', 'EMPLOYEE'], 'process returns')

  // Validate required fields
  if (!body.originalSaleId || typeof body.originalSaleId !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Original sale ID is required',
    })
  }

  if (!body.date) {
    throw createError({
      statusCode: 400,
      message: 'Date is required',
    })
  }

  // Parse and validate date
  const operationDate = validateDate(body.date)

  // Validate refund method
  const validRefundMethods = ['CASH', 'CARD', 'ORIGINAL_METHOD']
  if (!body.refundMethod || !validRefundMethods.includes(body.refundMethod)) {
    throw createError({
      statusCode: 400,
      message: 'Valid refund method is required (CASH, CARD, or ORIGINAL_METHOD)',
    })
  }

  // Validate cardType when refund method is CARD
  const validCardTypes = ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER']
  let cardType: string | null = null
  if (body.refundMethod === 'CARD') {
    if (!body.cardType || !validCardTypes.includes(body.cardType)) {
      throw createError({
        statusCode: 400,
        message: 'Card type is required when refund method is CARD (VISA, MASTERCARD, AMEX, or DISCOVER)',
      })
    }
    cardType = body.cardType as string
  }

  // Validate reason
  const returnReason = normalizeStringInput(body.reason)
  if (!returnReason) {
    throw createError({
      statusCode: 400,
      message: 'Return reason is required',
    })
  }
  if (returnReason.length > STRING_LIMITS.notes) {
    throw createError({
      statusCode: 400,
      message: `Return reason must be at most ${STRING_LIMITS.notes} characters`,
    })
  }

  // Validate items array
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one item is required',
    })
  }

  // Validate each return item
  interface ValidatedReturnItem {
    itemId: string
    quantity: number
    condition: ReturnItemCondition
    reason?: string
  }
  const returnItems: ValidatedReturnItem[] = []

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i]
    const result = returnItemSchema.safeParse(item)
    if (!result.success) {
      throw createError({
        statusCode: 400,
        message: `Item ${i + 1}: ${result.error.issues[0].message}`,
      })
    }
    returnItems.push(result.data)
  }

  // Validate optional string fields
  const notes = normalizeStringInput(body.notes)
  if (notes && notes.length > STRING_LIMITS.notes) {
    throw createError({
      statusCode: 400,
      message: `Notes must be at most ${STRING_LIMITS.notes} characters`,
    })
  }

  // Fetch the original sale with any existing returns
  const originalSale = await prisma.operation.findUnique({
    where: { id: body.originalSaleId },
    include: {
      returns: {
        where: {
          undoneAt: null, // Only count returns that haven't been undone
        },
      },
    },
  })

  if (!originalSale) {
    throw createError({
      statusCode: 404,
      message: 'Original sale not found',
    })
  }

  if (originalSale.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to process returns for this sale',
    })
  }

  if (originalSale.type !== 'SALE') {
    throw createError({
      statusCode: 400,
      message: 'Returns can only be processed for SALE operations',
    })
  }

  if (originalSale.undoneAt) {
    throw createError({
      statusCode: 400,
      message: 'Cannot process return for an undone sale',
    })
  }

  // Parse original sale items
  const originalItems = originalSale.items as unknown as SaleOperationItem[]
  if (!Array.isArray(originalItems)) {
    throw createError({
      statusCode: 500,
      message: 'Invalid original sale data',
    })
  }

  // Calculate already returned quantities for each item
  const alreadyReturnedQty = new Map<string, number>()
  for (const returnOp of originalSale.returns) {
    const returnedItems = returnOp.items as unknown as ReturnOperationItem[]
    if (Array.isArray(returnedItems)) {
      for (const item of returnedItems) {
        const current = alreadyReturnedQty.get(item.itemId) || 0
        alreadyReturnedQty.set(item.itemId, current + item.quantity)
      }
    }
  }

  // Create a map of original items for quick lookup
  const originalItemMap = new Map(originalItems.map((item) => [item.itemId, item]))

  // Validate return items against original sale
  for (const returnItem of returnItems) {
    const originalItem = originalItemMap.get(returnItem.itemId)
    if (!originalItem) {
      throw createError({
        statusCode: 400,
        message: `Item "${returnItem.itemId}" was not part of the original sale`,
      })
    }

    const alreadyReturned = alreadyReturnedQty.get(returnItem.itemId) || 0
    const availableToReturn = originalItem.quantity - alreadyReturned

    if (returnItem.quantity > availableToReturn) {
      throw createError({
        statusCode: 400,
        message: `Cannot return ${returnItem.quantity} of "${originalItem.itemName}". Only ${availableToReturn} available for return.`,
      })
    }
  }

  // Get business schema for quantity column
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId },
  })

  if (!schema || !schema.columns) {
    throw createError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  const columns = parseColumnDefinitions(schema.columns)
  const quantityColumn = columns.find((c) => c.role === 'quantity')

  if (!quantityColumn) {
    throw createError({
      statusCode: 400,
      message: 'No quantity column defined in schema. Please add a column with the "quantity" role.',
    })
  }

  // Fetch all inventory items that will be restocked (resellable items only)
  const resellableItemIds = returnItems
    .filter((item) => item.condition === 'resellable')
    .map((item) => item.itemId)

  const existingItems = resellableItemIds.length > 0
    ? await prisma.inventoryItem.findMany({
        where: {
          id: { in: resellableItemIds },
          businessId,
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
    : []

  // Create a map for quick lookup
  const inventoryItemMap = new Map(existingItems.map((item) => [item.id, item]))

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    const operationItems: ReturnOperationItem[] = []
    const updatedItems: Array<typeof existingItems[0]> = []
    let totalQty = 0
    let subtotal = 0
    let totalDiscount = 0

    // Process each return item
    for (const returnItem of returnItems) {
      const originalItem = originalItemMap.get(returnItem.itemId)!
      totalQty += returnItem.quantity

      // Calculate refund amount based on original price and discount
      const grossRefund = originalItem.pricePerItem * returnItem.quantity
      let discountAmount = 0

      if (originalItem.discount && originalItem.discount > 0) {
        if (originalItem.discountType === 'percent') {
          discountAmount = grossRefund * (originalItem.discount / 100)
        } else {
          // For fixed discount, prorate based on quantity
          const originalGrossTotal = originalItem.pricePerItem * originalItem.quantity
          const discountRatio = originalItem.discount / originalGrossTotal
          discountAmount = grossRefund * discountRatio
        }
      }

      const refundAmount = Math.max(0, grossRefund - discountAmount)
      subtotal += grossRefund
      totalDiscount += discountAmount

      // Only restock if item is resellable and inventory item still exists
      let previousQty = 0
      let newQty = 0

      if (returnItem.condition === 'resellable') {
        const inventoryItem = inventoryItemMap.get(returnItem.itemId)
        if (inventoryItem) {
          const data = inventoryItem.data as Record<string, unknown>
          previousQty = typeof data[quantityColumn.id] === 'number'
            ? data[quantityColumn.id] as number
            : 0
          newQty = previousQty + returnItem.quantity

          // Update the item's quantity
          const newData: Record<string, unknown> = {
            ...data,
            [quantityColumn.id]: newQty,
          }

          const updatedItem = await tx.inventoryItem.update({
            where: { id: returnItem.itemId },
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
        }
      }

      // Build the operation item record
      operationItems.push({
        itemId: returnItem.itemId,
        itemName: originalItem.itemName,
        quantity: returnItem.quantity,
        previousQty,
        newQty,
        pricePerItem: originalItem.pricePerItem,
        discount: originalItem.discount,
        discountType: originalItem.discountType,
        lineTotal: grossRefund - discountAmount,
        condition: returnItem.condition,
        reason: returnItem.reason,
        refundAmount,
      })
    }

    // Calculate financial totals
    // Use original sale's tax rate for consistency
    const taxRate = originalSale.taxRate ?? 0
    const taxName = originalSale.taxName ?? 'Tax'
    const taxableAmount = Math.max(0, subtotal - totalDiscount)
    const taxAmount = taxableAmount * (taxRate / 100)
    const grandTotal = taxableAmount + taxAmount

    // Create the return operation record
    const operation = await tx.operation.create({
      data: {
        type: 'RETURN',
        date: operationDate,
        notes,
        items: operationItems as unknown as Prisma.InputJsonValue,
        totalQty,

        // Financial totals (refund amounts)
        subtotal,
        totalDiscount,
        taxRate,
        taxName,
        taxAmount,
        grandTotal,

        // Return-specific fields
        originalSaleId: originalSale.id,
        returnReason,
        refundMethod: body.refundMethod as PrismaRefundMethod,

        // Payment details for CARD refunds
        cardType,

        // Copy branding from original sale for receipt consistency
        receiptLogoUrl: originalSale.receiptLogoUrl,
        receiptHeader: originalSale.receiptHeader,
        receiptFooter: originalSale.receiptFooter,

        businessId,
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
  safeEmitInventoryUpdate(businessId, result.operation, result.updatedItems)

  return result.operation
})
