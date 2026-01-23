import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

/**
 * DELETE /api/business
 *
 * Deletes the current business and ALL related data.
 * Only OWNER role can delete a business.
 *
 * Cascade delete order (respecting foreign key constraints):
 * 1. InventoryItems (references businessId)
 * 2. InviteCodes (references businessId)
 * 3. BusinessMembers (references businessId)
 * 4. InventorySchema (references businessId)
 * 5. Business
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  // Ensure user has a business selected
  requireBusiness(auth.businessId)

  // Only OWNER can delete a business
  requireRole(auth.businessRole, ['OWNER'], 'delete this business')

  const businessId = auth.businessId

  // Verify the business exists before attempting deletion
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  })

  if (!business) {
    throw createError({
      statusCode: 404,
      message: 'Business not found',
    })
  }

  // Use a transaction to ensure atomic deletion of all related data
  await prisma.$transaction(async (tx) => {
    // 1. Delete all inventory items belonging to the business
    await tx.inventoryItem.deleteMany({
      where: { businessId },
    })

    // 2. Delete all invite codes for the business
    await tx.inviteCode.deleteMany({
      where: { businessId },
    })

    // 3. Delete all business members (removes all users from business)
    await tx.businessMember.deleteMany({
      where: { businessId },
    })

    // 4. Delete the inventory schema for the business
    await tx.inventorySchema.deleteMany({
      where: { businessId },
    })

    // 5. Finally, delete the business itself
    await tx.business.delete({
      where: { id: businessId },
    })
  })

  return {
    success: true,
    message: `Business "${business.name}" has been permanently deleted`,
  }
})
