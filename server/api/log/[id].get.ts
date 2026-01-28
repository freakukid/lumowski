import prisma from '~/server/utils/prisma'
import { businessRoute } from '~/server/utils/apiMiddleware'

export default businessRoute(async (event, { businessId }) => {
  const id = requireIdParam(event, 'id', 'Log ID is required')

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
  if (log.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view this log entry',
    })
  }

  return log
})
