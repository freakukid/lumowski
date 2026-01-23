import prisma from '~/server/utils/prisma'
import { z } from 'zod'
import type { JwtPayload } from '~/server/utils/auth'

const updateMemberSchema = z.object({
  role: z.enum(['BOSS', 'EMPLOYEE']),
})

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const memberId = getRouterParam(event, 'id')
  const body = await readBody(event)

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER'], 'change member roles')

  if (!memberId) {
    throw createError({
      statusCode: 400,
      message: 'Member ID is required',
    })
  }

  const result = updateMemberSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  const member = await prisma.businessMember.findUnique({
    where: { id: memberId },
  })

  if (!member) {
    throw createError({
      statusCode: 404,
      message: 'Member not found',
    })
  }

  if (member.businessId !== auth.businessId) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to modify this member',
    })
  }

  // Cannot change owner's role
  if (member.role === 'OWNER') {
    throw createError({
      statusCode: 400,
      message: 'Cannot change the role of the business owner',
    })
  }

  // Cannot change own role
  if (member.userId === auth.userId) {
    throw createError({
      statusCode: 400,
      message: 'You cannot change your own role',
    })
  }

  const updatedMember = await prisma.businessMember.update({
    where: { id: memberId },
    data: { role: result.data.role },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  return updatedMember
})
