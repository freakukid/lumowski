import type { ZodSchema, ZodError } from 'zod'
import type { PrismaClient } from '@prisma/client'
import type { ColumnDefinition } from '~/types/schema'

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

  return schema.columns as unknown as ColumnDefinition[]
}
