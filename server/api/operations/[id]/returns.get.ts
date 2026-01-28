import prisma from '~/server/utils/prisma'
import { businessRoute } from '~/server/utils/apiMiddleware'
import { requireIdParam, requireOperationOwnership } from '~/server/utils/apiHelpers'

/**
 * GET /api/operations/:id/returns
 * Returns all RETURN operations linked to a SALE operation.
 *
 * Used by the operation detail page to show return history for a sale.
 * Returns both active and undone returns for complete history.
 */
export default businessRoute(async (event, { businessId }) => {
  const id = requireIdParam(event, 'id', 'Operation ID is required')

  // Fetch the operation with its returns
  const operation = await prisma.operation.findUnique({
    where: { id },
    include: {
      returns: {
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
        orderBy: {
          createdAt: 'desc',
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

  // Only SALE operations can have returns
  if (operation.type !== 'SALE') {
    throw createError({
      statusCode: 400,
      message: 'Only SALE operations can have returns',
    })
  }

  // Calculate summary statistics
  const activeReturns = operation.returns.filter((r) => !r.undoneAt)
  const totalReturnedQty = activeReturns.reduce((sum, r) => sum + r.totalQty, 0)
  const totalRefunded = activeReturns.reduce((sum, r) => sum + (r.grandTotal ?? 0), 0)

  return {
    saleId: operation.id,
    returns: operation.returns,
    summary: {
      totalReturns: operation.returns.length,
      activeReturns: activeReturns.length,
      undoneReturns: operation.returns.length - activeReturns.length,
      totalReturnedQty,
      totalRefunded,
    },
  }
})
