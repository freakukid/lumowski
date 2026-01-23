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

  // Generate unique code
  let code: string
  let attempts = 0
  do {
    code = generateInviteCodeString()
    const existing = await prisma.inviteCode.findUnique({ where: { code } })
    if (!existing) break
    attempts++
  } while (attempts < 10)

  if (attempts >= 10) {
    throw createError({
      statusCode: 500,
      message: 'Failed to generate unique invite code',
    })
  }

  const expiresAt = result.data.expiresInHours
    ? new Date(Date.now() + result.data.expiresInHours * 60 * 60 * 1000)
    : null

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
})
