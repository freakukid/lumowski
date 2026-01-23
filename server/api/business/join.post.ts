import prisma from '~/server/utils/prisma'
import { z } from 'zod'
import type { JwtPayload } from '~/server/utils/auth'

const joinBusinessSchema = z.object({
  code: z.string().min(1, 'Invite code is required'),
})

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const body = await readBody(event)

  const data = validateAndThrow(joinBusinessSchema, body)

  // Normalize invite code to uppercase for case-insensitive lookup
  const normalizedCode = data.code.toUpperCase()

  // Find invite code
  const inviteCode = await prisma.inviteCode.findUnique({
    where: { code: normalizedCode },
    include: {
      business: true,
    },
  })

  if (!inviteCode) {
    throw createError({
      statusCode: 404,
      message: 'Invalid invite code',
    })
  }

  // Check if code is expired
  if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
    throw createError({
      statusCode: 400,
      message: 'This invite code has expired',
    })
  }

  // Check if code has reached max uses
  if (inviteCode.maxUses && inviteCode.usedCount >= inviteCode.maxUses) {
    throw createError({
      statusCode: 400,
      message: 'This invite code has reached its maximum uses',
    })
  }

  // Add user to business and increment used count
  // Using try/catch to handle race condition where user might already be a member
  let member
  try {
    const [createdMember] = await prisma.$transaction([
      prisma.businessMember.create({
        data: {
          userId: auth.userId,
          businessId: inviteCode.businessId,
          role: inviteCode.role,
        },
        include: {
          business: {
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
          },
        },
      }),
      prisma.inviteCode.update({
        where: { id: inviteCode.id },
        data: { usedCount: { increment: 1 } },
      }),
    ])
    member = createdMember
  } catch (error: unknown) {
    // Check if it's a Prisma unique constraint violation (P2002)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw createError({
        statusCode: 400,
        message: 'You are already a member of this business',
      })
    }
    throw error
  }

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
  const membership = { businessId: inviteCode.businessId, businessRole: inviteCode.role }
  const { accessToken, refreshToken } = generateTokenPair(user, membership)

  return {
    business: member.business,
    accessToken,
    refreshToken,
  }
})
