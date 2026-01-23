import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const id = getRouterParam(event, 'id')

  requireBusiness(auth.businessId)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

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
  if (item.businessId !== auth.businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view this item',
    })
  }

  return item
})
