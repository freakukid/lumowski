import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate input
  const data = validateAndThrow(refreshSchema, body)

  const { refreshToken: token } = data

  // Verify refresh token
  const payload = verifyRefreshToken(token)
  if (!payload) {
    throw createError({
      statusCode: 401,
      message: 'Invalid or expired refresh token',
    })
  }

  // Find user with business membership
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      businessMemberships: true,
    },
  })

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'User not found',
    })
  }

  // Preserve the business context from the token instead of picking arbitrary first
  const membership = user.businessMemberships.find(
    m => m.businessId === payload.businessId
  ) ?? (user.businessMemberships.length > 0 ? user.businessMemberships[0] : null)
  const membershipContext = membership
    ? { businessId: membership.businessId, businessRole: membership.role }
    : null

  // Generate new tokens with business context
  const { accessToken, refreshToken } = generateTokenPair(user, membershipContext)

  return {
    accessToken,
    refreshToken,
  }
})
