import prisma from '~/server/utils/prisma'

/**
 * DELETE /api/business/invite/:id
 * Deletes an invite code. Only OWNER and BOSS roles can delete invite codes.
 */
export default managerRoute(async (event, { businessId }) => {
  const id = requireIdParam(event, 'id', 'Invite code ID is required')

  const inviteCode = await prisma.inviteCode.findUnique({
    where: { id },
  })

  if (!inviteCode) {
    throw createError({
      statusCode: 404,
      message: 'Invite code not found',
    })
  }

  if (inviteCode.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to delete this invite code',
    })
  }

  await prisma.inviteCode.delete({
    where: { id },
  })

  return { success: true }
}, 'delete invite codes')
