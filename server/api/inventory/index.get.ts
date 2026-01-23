import prisma from '~/server/utils/prisma'
import type { ColumnDefinition } from '~/types/schema'
import type { JwtPayload } from '~/server/utils/auth'

/**
 * Maximum number of items to fetch for client-side filtering during search.
 * Prevents memory issues with large inventories.
 */
const MAX_ITEMS_FOR_CLIENT_FILTERING = 500

/**
 * Normalizes a string for search comparison by removing all non-alphanumeric
 * characters and converting to lowercase.
 * Example: "10-65" -> "1065", "Part #A-123" -> "parta123"
 */
function normalizeForSearch(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}


export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const query = getQuery(event)

  requireBusiness(auth.businessId)

  // Pagination
  const { page, limit, skip } = getPaginationParams(event)

  // Search term with length validation to prevent DoS
  const search = ((query.search as string) || '').trim()
  if (search.length > 255) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Search term too long (max 255 characters)',
    })
  }

  // Search columns filter (comma-separated column IDs)
  const searchColumnsParam = (query.searchColumns as string) || ''
  const searchColumnIds = searchColumnsParam
    ? searchColumnsParam.split(',').filter(Boolean)
    : null

  // Get business schema to know which columns exist
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  const columns = (schema?.columns as unknown as ColumnDefinition[]) || []

  // Create a Set of valid column IDs for O(1) lookup
  const validColumnIds = new Set(columns.map((c) => c.id))

  // Validate that requested searchColumnIds exist in user's schema
  // This prevents information disclosure by probing for column IDs
  if (searchColumnIds) {
    for (const id of searchColumnIds) {
      if (!validColumnIds.has(id)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid column ID',
        })
      }
    }
  }

  // Base where clause - always filter by business
  const baseWhere = {
    businessId: auth.businessId,
  }

  // Determine which text columns to search
  let textColumnsToSearch: ColumnDefinition[] = []
  if (search && columns.length > 0) {
    textColumnsToSearch = columns.filter((c) => c.type === 'text')
    if (searchColumnIds && searchColumnIds.length > 0) {
      textColumnsToSearch = textColumnsToSearch.filter((c) =>
        searchColumnIds.includes(c.id)
      )
    }
  }

  // If there's a search term, we need to fetch all matching business items
  // and filter in JavaScript for normalized search (ignoring special characters).
  // This is necessary because PostgreSQL's JSON string_contains cannot normalize strings.
  if (search && textColumnsToSearch.length > 0) {
    // Fetch all items for this business (we filter in JS for normalized matching)
    const allItems = await prisma.inventoryItem.findMany({
      where: baseWhere,
      orderBy: { updatedAt: 'desc' },
      include: INVENTORY_ITEM_INCLUDE,
    })

    // Safeguard: prevent memory issues with very large inventories
    if (allItems.length > MAX_ITEMS_FOR_CLIENT_FILTERING) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'Too many items for search. Please use more specific search terms.',
      })
    }

    // Normalize search term ONCE before the loop for better performance
    const normalizedSearchTerm = normalizeForSearch(search)

    // Filter items using normalized string comparison
    // This allows "1065" to match "10-65" by stripping special characters
    const filteredItems = allItems.filter((item) => {
      const data = item.data as Record<string, unknown>
      return textColumnsToSearch.some((col) => {
        const value = data[col.id]
        if (typeof value === 'string') {
          return normalizeForSearch(value).includes(normalizedSearchTerm)
        }
        return false
      })
    })

    // Apply pagination to filtered results
    const total = filteredItems.length
    const paginatedItems = filteredItems.slice(skip, skip + limit)

    return {
      items: paginatedItems,
      pagination: createPaginationResponse(page, limit, total),
    }
  }

  // No search term - use standard database pagination
  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: baseWhere,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: INVENTORY_ITEM_INCLUDE,
    }),
    prisma.inventoryItem.count({ where: baseWhere }),
  ])

  return {
    items,
    pagination: createPaginationResponse(page, limit, total),
  }
})
