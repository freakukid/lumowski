import { getQuery } from 'h3'
import type { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import { businessRoute } from '~/server/utils/apiMiddleware'
import { getPaginationParams, createPaginationResponse } from '~/server/utils/pagination'
import { OPERATION_INCLUDE } from '~/server/utils/prismaIncludes'

/**
 * GET /api/operations
 * Lists all operations for the business with pagination and filtering.
 * Operations are sorted by creation date in descending order (newest first).
 *
 * Query parameters:
 * - type: Filter by operation type ('SALE', 'RECEIVING', 'RETURN')
 * - excludeUndone: If 'true', exclude operations that have been undone
 * - search: Search by reference, ID prefix, or customer name (case-insensitive)
 * - dateFrom: Filter operations on or after this date (YYYY-MM-DD)
 * - dateTo: Filter operations on or before this date (YYYY-MM-DD)
 * - limit: Override the default pagination limit (max 100)
 * - page: Page number for pagination
 */
export default businessRoute(async (event, { businessId }) => {
  // Pagination parameters with sensible defaults
  const { page, limit, skip } = getPaginationParams(event)

  // Get additional query parameters for filtering
  const query = getQuery(event)
  const type = query.type as string | undefined
  const excludeUndone = query.excludeUndone === 'true'
  const search = (query.search as string | undefined)?.trim()
  const dateFrom = query.dateFrom as string | undefined
  const dateTo = query.dateTo as string | undefined

  // Build the where clause with filters
  const where: Prisma.OperationWhereInput = {
    businessId,
  }

  // Filter by operation type (SALE, RECEIVING, RETURN)
  if (type && ['SALE', 'RECEIVING', 'RETURN'].includes(type)) {
    where.type = type as 'SALE' | 'RECEIVING' | 'RETURN'
  }

  // Exclude undone operations (where undoneAt is not null)
  if (excludeUndone) {
    where.undoneAt = null
  }

  // Search by reference, ID, or customer name.
  // The displayed receipt number may be either the reference field (if set)
  // or the first 8 characters of the operation ID (fallback display).
  if (search) {
    where.OR = [
      { reference: { contains: search, mode: 'insensitive' } },
      { customer: { contains: search, mode: 'insensitive' } },
      { id: { startsWith: search.toLowerCase() } },
    ]
  }

  // Date range filtering
  if (dateFrom || dateTo) {
    where.date = {}
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      if (!isNaN(fromDate.getTime())) {
        where.date.gte = fromDate
      }
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      if (!isNaN(toDate.getTime())) {
        // Set to end of day to include the entire day
        toDate.setHours(23, 59, 59, 999)
        where.date.lte = toDate
      }
    }
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
