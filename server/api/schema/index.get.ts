import prisma from '~/server/utils/prisma'

/**
 * GET /api/schema
 * Retrieves the inventory schema (column definitions) for the current business.
 * Returns an empty columns array if no schema exists yet.
 */
export default businessRoute(async (_event, { businessId }) => {
  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId },
  })

  // Return empty columns array if no schema exists yet
  return schema || { columns: [] }
})
