import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  requireBusiness(auth.businessId)

  const business = await prisma.business.findUnique({
    where: { id: auth.businessId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' },
          { createdAt: 'asc' },
        ],
      },
      inviteCodes: {
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!business) {
    throw createError({
      statusCode: 404,
      message: 'Business not found',
    })
  }

  return business
})
