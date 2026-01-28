import prisma from '~/server/utils/prisma'
import { z } from 'zod'
import type { JwtPayload } from '~/server/utils/auth'

const createInviteSchema = z.object({
  role: z.enum(['BOSS', 'EMPLOYEE']).default('EMPLOYEE'),
  expiresInHours: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const body = await readBody(event)

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER', 'BOSS'], 'generate invite codes')

  const result = createInviteSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  // Only OWNER can create BOSS invites
  if (result.data.role === 'BOSS' && auth.businessRole !== 'OWNER') {
    throw createError({
      statusCode: 403,
      message: 'Only the owner can create invites for the Boss role',
    })
  }

  const expiresAt = result.data.expiresInHours
    ? new Date(Date.now() + result.data.expiresInHours * 60 * 60 * 1000)
    : null

  // Generate unique code using retry-on-conflict pattern
  // This is more efficient than pre-checking because:
  // 1. It uses the database's unique constraint instead of multiple queries
  // 2. Only retries on the rare occasion of a collision
  const MAX_ATTEMPTS = 3
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateInviteCodeString()

    try {
      const inviteCode = await prisma.inviteCode.create({
        data: {
          code,
          role: result.data.role,
          expiresAt,
          maxUses: result.data.maxUses,
          businessId: auth.businessId,
          createdById: auth.userId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return inviteCode
    } catch (error) {
      // Check if this is a unique constraint violation (P2002 in Prisma)
      const isPrismaUniqueError =
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'

      if (isPrismaUniqueError) {
        // Unique constraint violation - retry with a new code
        lastError = error
        continue
      }

      // For any other error, throw immediately
      throw error
    }
  }

  // All attempts failed
  throw createError({
    statusCode: 500,
    message: 'Failed to generate unique invite code after multiple attempts',
  })
})
