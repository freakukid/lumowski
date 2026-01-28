import prisma from '~/server/utils/prisma'

/**
 * GET /api/business/settings
 * Retrieves business settings, creating default settings if they don't exist.
 * Uses upsert for consistency with the PUT endpoint.
 */
export default businessRoute(async (_event, { businessId }) => {
  // Upsert to get or create settings - consistent with settings.put.ts pattern
  const settings = await prisma.businessSettings.upsert({
    where: { businessId },
    create: {
      businessId,
    },
    update: {},
  })

  return settings
})
