import prisma from '~/server/utils/prisma'
import { z } from 'zod'

const updateMemberSchema = z.object({
  role: z.enum(['BOSS', 'EMPLOYEE']),
})

/**
 * PUT /api/business/members/:id
 * Updates a business member's role. Only the business owner can change roles.
 */
export default ownerRoute(async (event, { auth, businessId }) => {
  const body = await readBody(event)
  const memberId = requireIdParam(event, 'id', 'Member ID is required')

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

  if (member.businessId !== businessId) {
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
}, 'change member roles')
