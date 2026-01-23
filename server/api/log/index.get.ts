import prisma from '~/server/utils/prisma'
import { LogAction } from '@prisma/client'
import type { JwtPayload } from '~/server/utils/auth'

// Valid log actions derived from the Prisma enum
const VALID_LOG_ACTIONS = Object.values(LogAction) as string[]

/**
 * Validates a date string and returns a Date object if valid, null otherwise
 */
function parseValidDate(dateString: string): Date | null {
  const date = new Date(dateString)
  // Check if the date is valid (not Invalid Date)
  if (isNaN(date.getTime())) {
    return null
  }
  return date
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  if (!auth) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  requireBusiness(auth.businessId)

  // Verify explicit business membership before querying logs
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

  const query = getQuery(event)

  // Parse pagination params
  const { page, limit, skip } = getPaginationParams(event)

  // Build where clause for filters
  const where: {
    businessId: string
    action?: LogAction
    userId?: string
    createdAt?: { gte?: Date; lte?: Date }
    OR?: { itemName?: { contains: string; mode: 'insensitive' }; user?: { name: { contains: string; mode: 'insensitive' } } }[]
  } = {
    businessId: auth.businessId,
  }

  // Action filter - validate against the actual enum values dynamically
  if (query.action && typeof query.action === 'string' && VALID_LOG_ACTIONS.includes(query.action)) {
    where.action = query.action as LogAction
  }

  // User filter
  if (query.userId && typeof query.userId === 'string') {
    where.userId = query.userId
  }

  // Date range filter with validation
  if (query.startDate || query.endDate) {
    where.createdAt = {}

    if (query.startDate && typeof query.startDate === 'string') {
      const startDate = parseValidDate(query.startDate)
      if (startDate) {
        where.createdAt.gte = startDate
      }
      // Invalid dates are silently ignored - the filter simply won't be applied
    }

    if (query.endDate && typeof query.endDate === 'string') {
      const endDate = parseValidDate(query.endDate)
      if (endDate) {
        // Add 1 day to include the end date
        endDate.setDate(endDate.getDate() + 1)
        where.createdAt.lte = endDate
      }
      // Invalid dates are silently ignored - the filter simply won't be applied
    }

    // Remove empty createdAt filter if no valid dates were provided
    if (!where.createdAt.gte && !where.createdAt.lte) {
      delete where.createdAt
    }
  }

  // Search filter (searches item name and user name)
  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    const searchTerm = query.search.trim()
    where.OR = [
      { itemName: { contains: searchTerm, mode: 'insensitive' } },
      { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
    ]
  }

  // Get total count and logs
  const [total, logs] = await Promise.all([
    prisma.inventoryLog.count({ where }),
    prisma.inventoryLog.findMany({
      where,
      include: LOG_ENTRY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ])

  return {
    logs,
    pagination: createPaginationResponse(page, limit, total),
  }
})
