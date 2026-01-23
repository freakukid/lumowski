import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const id = getRouterParam(event, 'id')

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER', 'BOSS'], 'delete inventory items')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Item ID is required',
    })
  }

  // Check if item exists and belongs to this business
  const existingItem = await requireItemOwnership(prisma, id, auth.businessId)

  // Get schema to find item name
  const columns = await getBusinessSchema(prisma, auth.businessId)
  const itemData = existingItem.data as Record<string, unknown>
  const itemName = getItemName(itemData, columns)

  // Log deletion before deleting (include full snapshot for undo)
  await createInventoryLog({
    action: 'ITEM_DELETED',
    businessId: auth.businessId!,
    userId: auth.userId,
    itemId: existingItem.id,
    itemName: itemName ?? undefined,
    snapshot: getItemSnapshot(existingItem),
    undoable: true,
  })

  // Delete item
  await prisma.inventoryItem.delete({
    where: { id },
  })

  // Emit socket event for real-time updates
  emitInventoryDeleted(auth.businessId!, id)

  return { success: true, message: 'Item deleted successfully' }
})
