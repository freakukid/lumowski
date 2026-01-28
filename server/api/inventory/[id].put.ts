import { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'

export default managerRoute(async (event, { auth, businessId }) => {
  const id = requireIdParam(event, 'id', 'Item ID is required')
  const body = await readBody(event)

  // Check if item exists and belongs to this business
  const existingItem = await requireItemOwnership(prisma, id, businessId)

  // Get business schema
  const columns = await getBusinessSchema(prisma, businessId)

  // Store old data for diff comparison
  const oldData = existingItem.data as Record<string, unknown>

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

  // Update item
  const item = await prisma.inventoryItem.update({
    where: { id },
    data: { data: data as unknown as Prisma.InputJsonValue },
    include: INVENTORY_ITEM_INCLUDE,
  })

  // Calculate and log changes
  const changes = diffChanges(oldData, data, columns)
  if (changes.length > 0) {
    await createInventoryLog({
      action: 'ITEM_UPDATED',
      businessId: businessId,
      userId: auth.userId,
      itemId: item.id,
      itemName: getItemName(data, columns) ?? undefined,
      changes,
      undoable: true,
    })
  }

  // Emit socket event for real-time updates
  emitInventoryUpdated(businessId, item)

  return item
})
