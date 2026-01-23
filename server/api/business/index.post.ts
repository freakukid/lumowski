import prisma from '~/server/utils/prisma'
import { z } from 'zod'
import type { JwtPayload } from '~/server/utils/auth'

const createBusinessSchema = z.object({
  name: z.string().trim().min(1, 'Business name is required').max(100, 'Business name is too long'),
})

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const body = await readBody(event)

  const data = validateAndThrow(createBusinessSchema, body)

  // Note: Users can now belong to multiple businesses, so we no longer
  // check for existing membership here

  // Create business and add user as OWNER
  const business = await prisma.business.create({
    data: {
      name: data.name,
      members: {
        create: {
          userId: auth.userId,
          role: 'OWNER',
        },
      },
    },
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
      },
    },
  })

  // Get user for token generation
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Generate new tokens with business context
  const membership = { businessId: business.id, businessRole: 'OWNER' as const }
  const { accessToken, refreshToken } = generateTokenPair(user, membership)

  return {
    business,
    accessToken,
    refreshToken,
  }
})
