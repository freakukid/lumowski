import { H3Event, getQuery, createError } from 'h3'
import { paginationSchema } from '~/server/utils/validation'

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 20,
  maxLimit: 100,
} as const

export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

/**
 * Extracts and validates pagination parameters from the request query string.
 * Uses Zod schema for validation with sensible defaults.
 *
 * @param event - The H3 event object from the request handler
 * @returns Validated pagination parameters including computed skip value
 *
 * @example
 * ```typescript
 * export default defineEventHandler(async (event) => {
 *   const { page, limit, skip } = getPaginationParams(event)
 *   const items = await prisma.item.findMany({ skip, take: limit })
 * })
 * ```
 */
export function getPaginationParams(event: H3Event): PaginationParams {
  const query = getQuery(event)
  const result = paginationSchema.safeParse(query)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0]?.message || 'Invalid pagination parameters',
    })
  }

  const { page, limit } = result.data
  const skip = (page - 1) * limit
  return { page, limit, skip }
}

/**
 * Creates a standardized pagination response object.
 * Calculates total pages based on the total count and limit.
 *
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items across all pages
 * @returns Pagination metadata object for API responses
 *
 * @example
 * ```typescript
 * return {
 *   items,
 *   pagination: createPaginationResponse(page, limit, total),
 * }
 * ```
 */
export function createPaginationResponse(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}
