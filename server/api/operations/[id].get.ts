import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

/**
 * GET /api/operations/:id
 * Fetches a single operation by ID with all related data.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const id = getRouterParam(event, 'id')

  requireBusiness(auth.businessId)

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Operation ID is required',
    })
  }

  const operation = await prisma.operation.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      undoneBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!operation) {
    throw createError({
      statusCode: 404,
      message: 'Operation not found',
    })
  }

  // Verify business membership
  if (operation.businessId !== auth.businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to view this operation',
    })
  }

  return operation
})
