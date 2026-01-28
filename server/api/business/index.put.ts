import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { ownerRoute } from '~/server/utils/apiMiddleware'

const updateBusinessSchema = z.object({
  name: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be at most 100 characters')
    .trim(),
})

/**
 * PUT /api/business
 *
 * Updates the current business name.
 * Only accessible by business OWNER.
 */
export default ownerRoute(async (event, { businessId }) => {
  const body = await readBody(event)
  const parsed = updateBusinessSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    throw createError({
      statusCode: 400,
      message: firstError?.message || 'Invalid business data',
    })
  }

  const { name } = parsed.data

  const business = await prisma.business.update({
    where: { id: businessId },
    data: { name },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return business
}, 'update business name')
