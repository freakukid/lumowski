import prisma from '~/server/utils/prisma'

/**
 * DELETE /api/inventory/:id
 * Deletes an inventory item. Only OWNER and BOSS roles can delete items.
 * Logs the deletion with a snapshot for potential undo.
 */
export default managerRoute(async (event, { auth, businessId }) => {
  const id = requireIdParam(event, 'id', 'Item ID is required')

  // Check if item exists and belongs to this business
  const existingItem = await requireItemOwnership(prisma, id, businessId)

  // Get schema to find item name
  const columns = await getBusinessSchema(prisma, businessId)
  const itemData = existingItem.data as Record<string, unknown>
  const itemName = getItemName(itemData, columns)

  // Log deletion before deleting (include full snapshot for undo)
  await createInventoryLog({
    action: 'ITEM_DELETED',
    businessId,
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
  emitInventoryDeleted(businessId, id)

  return { success: true, message: 'Item deleted successfully' }
}, 'delete inventory items')
