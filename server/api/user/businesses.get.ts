import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

/**
 * GET /api/user/businesses
 *
 * Returns all businesses the authenticated user belongs to with pagination.
 * Requires authentication via JWT access token.
 *
 * @query {number} [page=1] - The page number for pagination
 * @query {number} [limit=20] - Number of items per page (max 100)
 *
 * @returns {Object} Response object containing:
 *   - businesses: Array of business objects with id, name, role, memberCount, and joinedAt
 *   - pagination: Pagination metadata with page, limit, total, and totalPages
 *
 * @throws {401} Unauthorized - If the user is not authenticated
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  // Parse and validate pagination parameters
  const { page, limit, skip } = getPaginationParams(event)

  // Get total count of memberships for pagination metadata
  const total = await prisma.businessMember.count({
    where: { userId: auth.userId },
  })

  // Get paginated business memberships for the user with business details and member count
  const memberships = await prisma.businessMember.findMany({
    where: { userId: auth.userId },
    include: {
      business: {
        include: {
          _count: {
            select: { members: true },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip,
    take: limit,
  })

  // Transform the data for the response
  const businesses = memberships.map((membership) => ({
    id: membership.business.id,
    name: membership.business.name,
    role: membership.role,
    memberCount: membership.business._count.members,
    joinedAt: membership.createdAt,
  }))

  return {
    businesses,
    pagination: createPaginationResponse(page, limit, total),
  }
})
