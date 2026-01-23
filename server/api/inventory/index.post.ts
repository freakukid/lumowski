import { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'

export default managerRoute(async (event, { auth, businessId }) => {
  const body = await readBody(event)

  // Get business schema
  const columns = await getBusinessSchema(prisma, businessId)

  // Validate data against schema
  const data = body.data as Record<string, unknown>
  if (!data || typeof data !== 'object') {
    throw createError({
      statusCode: 400,
      message: 'Invalid data format',
    })
  }

  const validation = validateInventoryData(data, columns)
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: validation.errors?.join(', ') || 'Validation failed',
    })
  }

  // Create item with JSON data
  const item = await prisma.inventoryItem.create({
    data: {
      data: data as unknown as Prisma.InputJsonValue,
      businessId,
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
  await createInventoryLog({
    action: 'ITEM_CREATED',
    businessId,
    userId: auth.userId,
    itemId: item.id,
    itemName: getItemName(data, columns) ?? undefined,
    snapshot: getItemSnapshot(item),
    undoable: false, // Created items are not undoable (use delete instead)
  })

  // Emit socket event for real-time updates
  emitInventoryCreated(businessId, item)

  return item
})
