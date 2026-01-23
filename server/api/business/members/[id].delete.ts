import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const memberId = getRouterParam(event, 'id')

  requireBusiness(auth.businessId)

  if (!memberId) {
    throw createError({
      statusCode: 400,
      message: 'Member ID is required',
    })
  }

  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
  })

  if (!member) {
    throw createError({
      statusCode: 404,
      message: 'Member not found',
    })
  }

  if (member.businessId !== auth.businessId) {
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
