import prisma from '~/server/utils/prisma'
import { businessRoute } from '~/server/utils/apiMiddleware'

/**
 * GET /api/operations/:id
 * Fetches a single operation by ID with all related data.
 */
export default businessRoute(async (event, { businessId }) => {
  const id = requireIdParam(event, 'id', 'Operation ID is required')

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
  requireOperationOwnership(operation, businessId, 'view')

  return operation
})
