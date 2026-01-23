import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  if (!auth) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const id = getRouterParam(event, 'id')

  requireBusiness(auth.businessId)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Log ID is required',
    })
  }

  // Verify explicit business membership before querying
  const membership = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: auth.businessId,
        userId: auth.userId,
      },
    },
  })

  if (!membership) {
    throw createError({
      statusCode: 403,
      message: 'You do not have access to this business',
    })
  }

  const log = await prisma.inventoryLog.findUnique({
    where: { id },
    include: LOG_ENTRY_INCLUDE,
  })

  if (!log) {
    throw createError({
      statusCode: 404,
      message: 'Log entry not found',
    })
  }

  // Verify the log belongs to the user's business
  if (log.businessId !== auth.businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view this log entry',
    })
  }

  return log
})
