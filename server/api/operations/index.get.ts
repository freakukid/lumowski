import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

/**
 * GET /api/operations
 * Lists all operations for the business with pagination.
 * Operations are sorted by creation date in descending order (newest first).
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  requireBusiness(auth.businessId)

  // Pagination parameters with sensible defaults
  const { page, limit, skip } = getPaginationParams(event)

  // Base where clause - always filter by business
  const where = {
    businessId: auth.businessId,
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
