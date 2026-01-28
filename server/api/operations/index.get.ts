import prisma from '~/server/utils/prisma'
import { businessRoute } from '~/server/utils/apiMiddleware'
import { getPaginationParams, createPaginationResponse } from '~/server/utils/pagination'
import { OPERATION_INCLUDE } from '~/server/utils/prismaIncludes'

/**
 * GET /api/operations
 * Lists all operations for the business with pagination.
 * Operations are sorted by creation date in descending order (newest first).
 */
export default businessRoute(async (event, { businessId }) => {
  // Pagination parameters with sensible defaults
  const { page, limit, skip } = getPaginationParams(event)

  // Base where clause - always filter by business
  const where = {
    businessId,
  }

  // Fetch operations and count in parallel for efficiency
  const [operations, total] = await Promise.all([
    prisma.operation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: OPERATION_INCLUDE,
    }),
    prisma.operation.count({ where }),
  ])

  return {
    operations,
    pagination: createPaginationResponse(page, limit, total),
  }
})
