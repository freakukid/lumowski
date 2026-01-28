import prisma from '~/server/utils/prisma'
import type { ColumnDefinition } from '~/types/schema'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'

/**
 * Maximum number of items to process in memory for search filtering and sorting.
 * This limit applies to both client-side search filtering and in-memory sorting.
 * Prevents memory and performance issues with very large inventories.
 */
const MAX_ITEMS_FOR_IN_MEMORY_PROCESSING = 10000

/**
 * Normalizes a string for search comparison by removing all non-alphanumeric
 * characters and converting to lowercase.
 * Example: "10-65" -> "1065", "Part #A-123" -> "parta123"
 */
function normalizeForSearch(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

/**
 * Sorts an array of inventory items by a specified column.
 * Handles different column types (number, currency, date, text) appropriately.
 * Items with null/undefined values are sorted to the end.
 */
function sortItemsByColumn<T extends { data: unknown }>(
  items: T[],
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  columns: ColumnDefinition[]
): T[] {
  const column = columns.find((c) => c.id === sortColumn)
  if (!column) return items

  return [...items].sort((a, b) => {
    const dataA = a.data as Record<string, unknown>
    const dataB = b.data as Record<string, unknown>
    const valA = dataA[sortColumn]
    const valB = dataB[sortColumn]

    // Handle null/undefined values - always sort to end
    if (valA == null && valB == null) return 0
    if (valA == null) return 1
    if (valB == null) return -1

    let comparison = 0
    if (column.type === 'number' || column.type === 'currency') {
      const numA = Number(valA)
      const numB = Number(valB)
      if (isNaN(numA) && isNaN(numB)) return 0
      if (isNaN(numA)) return 1
      if (isNaN(numB)) return -1
      comparison = numA - numB
    } else if (column.type === 'date') {
      const timeA = new Date(valA as string).getTime()
      const timeB = new Date(valB as string).getTime()
      if (isNaN(timeA) && isNaN(timeB)) return 0
      if (isNaN(timeA)) return 1
      if (isNaN(timeB)) return -1
      comparison = timeA - timeB
    } else {
      // Text and select types use string comparison
      comparison = String(valA).localeCompare(String(valB))
    }

    return sortDirection === 'asc' ? comparison : -comparison
  })
}


/**
 * GET /api/inventory
 * Lists inventory items with pagination, search, and sorting support.
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search term for text columns
 * - searchColumns: Comma-separated column IDs to search
 * - sortColumn: Column ID to sort by
 * - sortDirection: 'asc' or 'desc' (default: 'asc')
 */
export default businessRoute(async (event, { businessId }) => {
  const query = getQuery(event)

  // Pagination
  const { page, limit, skip } = getPaginationParams(event)

  // Search term with length validation to prevent DoS
  const search = ((query.search as string) || '').trim()
  if (search.length > 255) {
    throw createError({
      statusCode: 400,
      message: 'Search term too long (max 255 characters)',
    })
  }

  // Search columns filter (comma-separated column IDs)
  const searchColumnsParam = (query.searchColumns as string) || ''
  const searchColumnIds = searchColumnsParam
    ? searchColumnsParam.split(',').filter(Boolean)
    : null

  // Sort parameters
  const sortColumn = (query.sortColumn as string) || null
  const sortDirection = ((query.sortDirection as string) || 'asc') as 'asc' | 'desc'

  // Get business schema to know which columns exist
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId: businessId },
  })

  const columns = parseColumnDefinitions(schema?.columns)

  // Create a Set of valid column IDs for O(1) lookup
  const validColumnIds = new Set(columns.map((c) => c.id))

  // Validate that requested searchColumnIds exist in user's schema
  // This prevents information disclosure by probing for column IDs
  if (searchColumnIds) {
    for (const id of searchColumnIds) {
      if (!validColumnIds.has(id)) {
        throw createError({
          statusCode: 400,
          message: 'Invalid column ID',
        })
      }
    }
  }

  // Validate sort column exists in schema to prevent probing attacks
  if (sortColumn && !validColumnIds.has(sortColumn)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid sort column ID',
    })
  }

  // Base where clause - always filter by business
  const baseWhere = {
    businessId: businessId,
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
    if (allItems.length > MAX_ITEMS_FOR_IN_MEMORY_PROCESSING) {
      throw createError({
        statusCode: 400,
        message: `Inventory too large for search (${allItems.length} items). Maximum supported: ${MAX_ITEMS_FOR_IN_MEMORY_PROCESSING}.`,
      })
    }

    // Normalize search term ONCE before the loop for better performance
    const normalizedSearchTerm = normalizeForSearch(search)

    // Filter items using normalized string comparison
    // This allows "1065" to match "10-65" by stripping special characters
    let filteredItems = allItems.filter((item) => {
      const data = item.data as Record<string, unknown>
      return textColumnsToSearch.some((col) => {
        const value = data[col.id]
        if (typeof value === 'string') {
          return normalizeForSearch(value).includes(normalizedSearchTerm)
        }
        return false
      })
    })

    // Sort filtered items if sort column specified
    if (sortColumn) {
      filteredItems = sortItemsByColumn(filteredItems, sortColumn, sortDirection, columns)
    }

    // Apply pagination to filtered results
    const total = filteredItems.length
    const paginatedItems = filteredItems.slice(skip, skip + limit)

    return {
      items: paginatedItems,
      pagination: createPaginationResponse(page, limit, total),
    }
  }

  // No search term - check if we need to sort by a JSON column
  if (sortColumn) {
    // Sorting by JSON field requires fetching all items and sorting in JavaScript
    const allItems = await prisma.inventoryItem.findMany({
      where: baseWhere,
      orderBy: { updatedAt: 'desc' },
      include: INVENTORY_ITEM_INCLUDE,
    })

    // Safeguard: prevent memory issues with very large inventories
    if (allItems.length > MAX_ITEMS_FOR_IN_MEMORY_PROCESSING) {
      throw createError({
        statusCode: 400,
        message: `Inventory too large for sorting (${allItems.length} items). Maximum supported: ${MAX_ITEMS_FOR_IN_MEMORY_PROCESSING}.`,
      })
    }

    // Sort items by the specified column
    const sortedItems = sortItemsByColumn(allItems, sortColumn, sortDirection, columns)

    // Apply pagination to sorted results
    const total = sortedItems.length
    const paginatedItems = sortedItems.slice(skip, skip + limit)

    return {
      items: paginatedItems,
      pagination: createPaginationResponse(page, limit, total),
    }
  }

  // No search and no custom sort - use standard database pagination with default sort
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

  const pagination = createPaginationResponse(page, limit, total)

  return {
    items,
    pagination,
  }
})
