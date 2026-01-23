import prisma from '~/server/utils/prisma'
import { z } from 'zod'
import type { JwtPayload } from '~/server/utils/auth'

const selectBusinessSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
})

/**
 * POST /api/user/select-business
 * Sets the user's active business and returns new tokens with the selected business context
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const body = await readBody(event)

  // Validate input
  const result = selectBusinessSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  const { businessId } = result.data

  // Verify user is a member of this business
  const membership = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId,
        userId: auth.userId,
      },
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!membership) {
    throw createError({
      statusCode: 403,
      message: 'You are not a member of this business',
    })
  }

  // Get the user for token generation
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Generate new tokens with the selected business context
  const membershipContext = {
    businessId: membership.businessId,
    businessRole: membership.role,
  }
  const { accessToken, refreshToken } = generateTokenPair(user, membershipContext)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      business: {
        id: membership.business.id,
        name: membership.business.name,
        role: membership.role,
      },
    },
    accessToken,
    refreshToken,
  }
})
