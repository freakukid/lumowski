import prisma from '~/server/utils/prisma'

/**
 * DELETE /api/business/members/:id
 * Removes a member from the business.
 * Owners can remove anyone, Bosses can remove Employees.
 */
export default businessRoute(async (event, { auth, businessId }) => {
  const memberId = requireIdParam(event, 'id', 'Member ID is required')

  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
  })

  if (!member) {
    throw createError({
      statusCode: 404,
      message: 'Member not found',
    })
  }

  if (member.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to remove this member',
    })
  }

  // Cannot remove owner
  if (member.role === 'OWNER') {
    throw createError({
      statusCode: 400,
      message: 'Cannot remove the business owner',
    })
  }

  // Check if user has permission to remove this member
  if (!canRemoveMember(auth.businessRole, member.role)) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to remove this member',
    })
  }

  // Cannot remove yourself
  if (member.userId === auth.userId) {
    throw createError({
      statusCode: 400,
      message: 'You cannot remove yourself from the business',
    })
  }

  await prisma.businessMember.delete({
    where: { id: memberId },
  })

  return { success: true }
})
