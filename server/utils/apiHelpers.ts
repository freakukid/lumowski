import type { H3Event } from 'h3'
import type { ZodSchema, ZodError } from 'zod'
import type { PrismaClient, Operation } from '@prisma/client'
import type { ColumnDefinition, ColumnType, ColumnRole } from '~/types/schema'
import type { OperationItem } from '~/types/operation'

/**
 * Extracts and validates a required route parameter.
 * Throws a 400 Bad Request error if the parameter is missing.
 *
 * @param event - The H3 event object
 * @param paramName - The name of the route parameter (default: 'id')
 * @param errorMessage - Custom error message (default: '{ParamName} is required')
 * @returns The parameter value as a string
 * @throws H3Error with 400 status code if parameter is missing
 *
 * @example
 * // Extract 'id' parameter with default message
 * const id = requireIdParam(event)
 *
 * @example
 * // Extract 'id' parameter with custom message
 * const id = requireIdParam(event, 'id', 'Operation ID is required')
 */
export function requireIdParam(
  event: H3Event,
  paramName: string = 'id',
  errorMessage?: string
): string {
  const id = getRouterParam(event, paramName)

  if (!id) {
    // Generate default message: capitalize first letter and use 'ID' suffix
    const defaultMessage = errorMessage ??
      `${paramName.charAt(0).toUpperCase() + paramName.slice(1)} ID is required`

    throw createError({
      statusCode: 400,
      message: defaultMessage,
    })
  }

  return id
}

/**
 * Verifies that an operation belongs to the specified business.
 * Throws a 403 Forbidden error if ownership check fails.
 *
 * @param operation - The operation object to check (must have businessId property)
 * @param businessId - The business ID to verify against
 * @param actionDescription - Optional description for the error message (e.g., 'view', 'undo')
 * @throws H3Error with 403 status code if operation doesn't belong to the business
 *
 * @example
 * requireOperationOwnership(operation, auth.businessId)
 *
 * @example
 * requireOperationOwnership(operation, auth.businessId, 'undo')
 * // Throws: "You do not have permission to undo this operation"
 */
export function requireOperationOwnership(
  operation: { businessId: string },
  businessId: string,
  actionDescription: string = 'access'
): void {
  if (operation.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: `You do not have permission to ${actionDescription} this operation`,
    })
  }
}

/**
 * Validates data against a Zod schema and throws a createError on failure.
 * Returns the typed, validated data on success.
 *
 * @param schema - The Zod schema to validate against
 * @param data - The data to validate
 * @returns The validated and typed data
 * @throws H3Error with 400 status code if validation fails
 */
export function validateAndThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const zodError = result.error as ZodError
    throw createError({
      statusCode: 400,
      message: zodError.errors[0].message,
    })
  }
  return result.data
}

/**
 * Verifies that an inventory item exists and belongs to the specified business.
 * Throws appropriate errors if the item is not found or access is forbidden.
 *
 * @param prisma - The Prisma client instance
 * @param itemId - The ID of the inventory item to check
 * @param businessId - The business ID that should own the item
 * @returns The existing inventory item if validation passes
 * @throws H3Error with 404 if item not found, 403 if wrong business
 */
export async function requireItemOwnership(
  prisma: PrismaClient,
  itemId: string,
  businessId: string
) {
  const existingItem = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
  })

  if (!existingItem) {
    throw createError({
      statusCode: 404,
      message: 'Item not found',
    })
  }

  if (existingItem.businessId !== businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to access this item',
    })
  }

  return existingItem
}

/**
 * Fetches the inventory schema columns for a business.
 * Throws an error if the schema is not found or has no columns defined.
 *
 * @param prisma - The Prisma client instance
 * @param businessId - The business ID to fetch the schema for
 * @returns The array of column definitions
 * @throws H3Error with 400 if schema not found or columns not defined
 */
export async function getBusinessSchema(
  prisma: PrismaClient,
  businessId: string
): Promise<ColumnDefinition[]> {
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId },
  })

  if (!schema || !schema.columns) {
    throw createError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  return parseColumnDefinitions(schema.columns)
}

// Valid column types and roles for validation
const VALID_COLUMN_TYPES: ColumnType[] = ['text', 'number', 'currency', 'date', 'select']
const VALID_COLUMN_ROLES: ColumnRole[] = ['name', 'quantity', 'minQuantity', 'price', 'cost']

/**
 * Type guard to check if a value is a valid ColumnDefinition.
 * Validates all required and optional fields with proper types.
 */
function isValidColumnDefinition(value: unknown): value is ColumnDefinition {
  if (!value || typeof value !== 'object') return false

  const obj = value as Record<string, unknown>

  // Required fields
  if (typeof obj.id !== 'string' || obj.id.length === 0) return false
  if (typeof obj.name !== 'string' || obj.name.length === 0) return false
  if (typeof obj.type !== 'string' || !VALID_COLUMN_TYPES.includes(obj.type as ColumnType)) return false
  if (typeof obj.order !== 'number' || !Number.isInteger(obj.order)) return false

  // Optional fields
  if (obj.role !== undefined && (typeof obj.role !== 'string' || !VALID_COLUMN_ROLES.includes(obj.role as ColumnRole))) {
    return false
  }
  if (obj.required !== undefined && typeof obj.required !== 'boolean') return false
  if (obj.options !== undefined) {
    if (!Array.isArray(obj.options)) return false
    if (!obj.options.every((opt: unknown) => typeof opt === 'string')) return false
  }

  return true
}

/**
 * Parses and validates JSON data as an array of ColumnDefinition objects.
 * This replaces unsafe `as unknown as ColumnDefinition[]` type casts.
 *
 * @param data - The raw JSON value from schema.columns
 * @returns Validated array of ColumnDefinition objects
 * @throws H3Error with 500 status code if data is invalid
 *
 * @example
 * ```typescript
 * const columns = parseColumnDefinitions(schema.columns)
 * ```
 */
export function parseColumnDefinitions(data: unknown): ColumnDefinition[] {
  // Handle null/undefined - return empty array
  if (data === null || data === undefined) {
    return []
  }

  // Must be an array
  if (!Array.isArray(data)) {
    throw createError({
      statusCode: 500,
      message: 'Invalid schema: columns must be an array',
    })
  }

  // Validate each item in the array
  for (let i = 0; i < data.length; i++) {
    if (!isValidColumnDefinition(data[i])) {
      throw createError({
        statusCode: 500,
        message: `Invalid schema: column at index ${i} has invalid structure`,
      })
    }
  }

  return data as ColumnDefinition[]
}

/**
 * Parses and validates JSON data as an array of OperationItem objects.
 * This replaces unsafe `as unknown as OperationItem[]` type casts.
 *
 * @param data - The raw JSON value from operation.items
 * @returns Validated array of OperationItem objects
 * @throws H3Error with 500 status code if data is invalid
 *
 * @example
 * ```typescript
 * const operationItems = parseOperationItems(operation.items)
 * ```
 */
export function parseOperationItems(data: unknown): OperationItem[] {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return []
  }

  // Must be an array
  if (!Array.isArray(data)) {
    throw createError({
      statusCode: 500,
      message: 'Invalid operation: items must be an array',
    })
  }

  // Validate each item has the required fields
  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (!item || typeof item !== 'object') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} must be an object`,
      })
    }

    const obj = item as Record<string, unknown>

    // Required fields for OperationItem
    if (typeof obj.itemId !== 'string') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} missing itemId`,
      })
    }
    if (typeof obj.itemName !== 'string') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} missing itemName`,
      })
    }
    if (typeof obj.quantity !== 'number') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} missing quantity`,
      })
    }
    if (typeof obj.previousQty !== 'number') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} missing previousQty`,
      })
    }
    if (typeof obj.newQty !== 'number') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} missing newQty`,
      })
    }

    // Optional fields - validate types if present
    if (obj.costPerItem !== undefined && typeof obj.costPerItem !== 'number') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} has invalid costPerItem`,
      })
    }
    if (obj.previousCost !== undefined && typeof obj.previousCost !== 'number') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} has invalid previousCost`,
      })
    }
    if (obj.newCost !== undefined && typeof obj.newCost !== 'number') {
      throw createError({
        statusCode: 500,
        message: `Invalid operation: item at index ${i} has invalid newCost`,
      })
    }
  }

  return data as OperationItem[]
}
