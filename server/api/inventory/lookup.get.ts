import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getBusinessSchema, validateAndThrow } from '~/server/utils/apiHelpers'

/**
 * Response type for barcode lookup endpoint.
 */
interface BarcodeLookupResponse {
  found: boolean
  item: Awaited<ReturnType<typeof prisma.inventoryItem.findFirst>> | null
  error?: string
}

/**
 * Zod schema for barcode query validation.
 * Validates that the barcode:
 * - Is a non-empty string
 * - Does not exceed 255 characters
 * - Contains only printable ASCII characters (0x20-0x7E)
 */
const barcodeQuerySchema = z.object({
  barcode: z.string()
    .min(1, 'Barcode is required')
    .max(255, 'Barcode too long (max 255 characters)')
    .regex(/^[\x20-\x7E]+$/, 'Barcode contains invalid characters')
    .transform((val) => val.trim()),
})

/**
 * GET /api/inventory/lookup
 * Looks up an inventory item by barcode value.
 *
 * Query parameters:
 * - barcode: The barcode value to search for (required)
 *
 * Returns:
 * - { found: true, item: DynamicInventoryItem } if item is found
 * - { found: false, item: null, error?: string } if not found or no barcode column configured
 */
export default businessRoute(async (event, { businessId }): Promise<BarcodeLookupResponse> => {
  const query = getQuery(event)

  // Validate and sanitize barcode input using Zod schema
  const { barcode } = validateAndThrow(barcodeQuerySchema, query)

  // Get the business schema to find the barcode column
  const columns = await getBusinessSchema(prisma, businessId)

  // Find the column with the 'barcode' role
  const barcodeColumn = columns.find((c) => c.role === 'barcode')

  if (!barcodeColumn) {
    return {
      found: false,
      item: null,
      error: 'No barcode column configured',
    }
  }

  // Query for inventory item where the barcode column matches exactly
  // Using Prisma's JSON path query for the dynamic data field
  // Note: We don't include createdBy info here because barcode lookup is used
  // for cart operations which only need the item's id and data, not user info.
  // This reduces query overhead and response size.
  const item = await prisma.inventoryItem.findFirst({
    where: {
      businessId,
      data: {
        path: [barcodeColumn.id],
        equals: barcode,
      },
    },
  })

  if (!item) {
    return {
      found: false,
      item: null,
    }
  }

  return {
    found: true,
    item,
  }
})
