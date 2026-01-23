import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  // Get token from Authorization header
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      message: 'Missing or invalid authorization header',
    })
  }

  const token = authHeader.substring(7)
  const payload = verifyAccessToken(token)

  if (!payload) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired access token',
    })
  }

  // Get user from database with business membership
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      businessMemberships: {
        include: {
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Get the SELECTED business from the token (not just the first membership)
  // If the token has a businessId, return that business info
  // Otherwise, return null (user needs to select a business)
  let selectedBusiness = null

  if (payload.businessId) {
    // Find the membership for the selected business
    const membership = user.businessMemberships.find(
      (m) => m.business.id === payload.businessId
    )

    if (membership) {
      selectedBusiness = {
        id: membership.business.id,
        name: membership.business.name,
        role: membership.role,
      }
    }
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    business: selectedBusiness,
  }
})
