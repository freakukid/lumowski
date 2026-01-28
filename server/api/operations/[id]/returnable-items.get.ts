import prisma from '~/server/utils/prisma'
import { businessRoute } from '~/server/utils/apiMiddleware'
import { requireIdParam, requireOperationOwnership } from '~/server/utils/apiHelpers'
import type { SaleOperationItem, ReturnOperationItem, ReturnableItem } from '~/types/operation'

/**
 * GET /api/operations/:id/returnable-items
 * Returns items from a sale that are available for return.
 *
 * For each item in the original sale, calculates:
 * - Original quantity sold
 * - Quantity already returned (from non-undone RETURN operations)
 * - Quantity available to return
 *
 * Only returns items with availableQty > 0.
 */
export default businessRoute(async (event, { businessId }) => {
  const id = requireIdParam(event, 'id', 'Operation ID is required')

  // Fetch the operation with its returns
  const operation = await prisma.operation.findUnique({
    where: { id },
    include: {
      returns: {
        where: {
          undoneAt: null, // Only count returns that haven't been undone
        },
      },
    },
  })

  if (!operation) {
    throw createError({
      statusCode: 404,
      message: 'Operation not found',
    })
  }

  // Verify business membership
  requireOperationOwnership(operation, businessId, 'view')

  // Only SALE operations can have returns
  if (operation.type !== 'SALE') {
    throw createError({
      statusCode: 400,
      message: 'Only SALE operations can have returnable items',
    })
  }

  // Cannot return items from an undone sale
  if (operation.undoneAt) {
    throw createError({
      statusCode: 400,
      message: 'Cannot return items from an undone sale',
    })
  }

  // Parse sale items
  const saleItems = operation.items as unknown as SaleOperationItem[]
  if (!Array.isArray(saleItems)) {
    throw createError({
      statusCode: 500,
      message: 'Invalid sale data',
    })
  }

  // Calculate already returned quantities for each item
  const alreadyReturnedQty = new Map<string, number>()
  for (const returnOp of operation.returns) {
    const returnedItems = returnOp.items as unknown as ReturnOperationItem[]
    if (Array.isArray(returnedItems)) {
      for (const item of returnedItems) {
        const current = alreadyReturnedQty.get(item.itemId) || 0
        alreadyReturnedQty.set(item.itemId, current + item.quantity)
      }
    }
  }

  // Build returnable items list
  const returnableItems: ReturnableItem[] = []

  for (const saleItem of saleItems) {
    const returnedQty = alreadyReturnedQty.get(saleItem.itemId) || 0
    const availableQty = saleItem.quantity - returnedQty

    // Only include items that have quantities available to return
    if (availableQty > 0) {
      returnableItems.push({
        itemId: saleItem.itemId,
        itemName: saleItem.itemName,
        originalQty: saleItem.quantity,
        returnedQty,
        availableQty,
        pricePerItem: saleItem.pricePerItem,
        discount: saleItem.discount,
        discountType: saleItem.discountType,
        lineTotal: saleItem.lineTotal,
      })
    }
  }

  return {
    saleId: operation.id,
    saleDate: operation.date,
    saleReference: operation.reference,
    items: returnableItems,
    // Include flag to indicate if sale is fully returned
    isFullyReturned: returnableItems.length === 0,
  }
})
