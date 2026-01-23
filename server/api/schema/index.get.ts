import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  if (!auth) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  requireBusiness(auth.businessId)

  const schema = await prisma.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  // Return empty columns array if no schema exists yet
  return schema || { columns: [] }
})
