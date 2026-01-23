import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const id = getRouterParam(event, 'id')

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER', 'BOSS'], 'delete invite codes')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Invite code ID is required',
    })
  }

  const inviteCode = await prisma.inviteCode.findUnique({
    where: { id },
  })

  if (!inviteCode) {
    throw createError({
      statusCode: 404,
      message: 'Invite code not found',
    })
  }

  if (inviteCode.businessId !== auth.businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to delete this invite code',
    })
  }

  await prisma.inviteCode.delete({
    where: { id },
  })

  return { success: true }
})
