import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

/**
 * Reset Inventory API Endpoint
 *
 * Deletes ALL inventory items, schema (columns), inventory logs, and operations for the business.
 * This is a destructive operation that cannot be undone.
 *
 * Only accessible by OWNER role.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  if (!auth) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER'], 'reset inventory')

  // Use a transaction to ensure all operations succeed or fail together
  const result = await prisma.$transaction(async (tx) => {
    // Delete all inventory items for this business
    const deletedItems = await tx.inventoryItem.deleteMany({
      where: { businessId: auth.businessId! },
    })

    // Delete the inventory schema (columns) for this business
    const deletedSchema = await tx.inventorySchema.deleteMany({
      where: { businessId: auth.businessId! },
    })

    // Delete all inventory logs for this business
    const deletedLogs = await tx.inventoryLog.deleteMany({
      where: { businessId: auth.businessId! },
    })

    // Delete all operations for this business
    const deletedOperations = await tx.operation.deleteMany({
      where: { businessId: auth.businessId! },
    })

    return {
      deletedItemsCount: deletedItems.count,
      schemaDeleted: deletedSchema.count > 0,
      deletedLogsCount: deletedLogs.count,
      deletedOperationsCount: deletedOperations.count,
    }
  })

  // Emit socket event to notify other clients
  emitInventoryReset(auth.businessId!)

  return {
    success: true,
    message: 'Inventory has been reset successfully',
    deletedItemsCount: result.deletedItemsCount,
    schemaDeleted: result.schemaDeleted,
    deletedLogsCount: result.deletedLogsCount,
    deletedOperationsCount: result.deletedOperationsCount,
  }
})
