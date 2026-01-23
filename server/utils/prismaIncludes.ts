/**
 * Shared Prisma include/select clauses for consistent data fetching across API routes.
 * Centralizes include definitions to ensure consistency and simplify maintenance.
 */

/**
 * Basic user select fields for display purposes.
 * Use when you only need the user's ID and name (e.g., for attribution).
 */
export const USER_BASIC_SELECT = {
  id: true,
  name: true,
} as const

/**
 * Include clause for inventory item queries.
 * Includes the creator's basic info for display purposes.
 *
 * @example
 * ```typescript
 * const item = await prisma.inventoryItem.findUnique({
 *   where: { id },
 *   include: INVENTORY_ITEM_INCLUDE,
 * })
 * ```
 */
export const INVENTORY_ITEM_INCLUDE = {
  createdBy: {
    select: USER_BASIC_SELECT,
  },
} as const

/**
 * Include clause for inventory log queries.
 * Includes both the user who made the change and who undid it (if applicable).
 *
 * @example
 * ```typescript
 * const logs = await prisma.inventoryLog.findMany({
 *   where: { businessId },
 *   include: LOG_ENTRY_INCLUDE,
 * })
 * ```
 */
export const LOG_ENTRY_INCLUDE = {
  user: {
    select: USER_BASIC_SELECT,
  },
  undoneBy: {
    select: USER_BASIC_SELECT,
  },
} as const

/**
 * Include clause for operation queries.
 * Includes the user who created the operation.
 *
 * @example
 * ```typescript
 * const operations = await prisma.operation.findMany({
 *   where: { businessId },
 *   include: OPERATION_INCLUDE,
 * })
 * ```
 */
export const OPERATION_INCLUDE = {
  user: {
    select: USER_BASIC_SELECT,
  },
} as const
