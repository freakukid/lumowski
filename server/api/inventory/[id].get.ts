import prisma from '~/server/utils/prisma'

/**
 * GET /api/inventory/:id
 * Retrieves a single inventory item by ID.
 * Verifies the item belongs to the authenticated user's business.
 */
export default businessRoute(async (event, { businessId }) => {
  const id = requireIdParam(event, 'id', 'Item ID is required')

  const item = await prisma.inventoryItem.findUnique({
    where: { id },
    include: INVENTORY_ITEM_INCLUDE,
  })

  if (!item) {
    throw createError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  // Verify business membership
  if (item.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view this item',
    })
  }

  return item
})
