import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate input
  const { email, password } = validateAndThrow(loginSchema, body)

  // Find user with business membership
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
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
      statusCode: 401,
      message: 'Invalid email or password',
    })
  }

  // Check if user has a password (Google-only accounts don't)
  if (!user.password) {
    throw createError({
      statusCode: 401,
      message: 'This account uses Google Sign-In. Please sign in with Google.',
    })
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password)
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password',
    })
  }

  // For multi-business support, we don't automatically select a business on login
  // The user will be redirected to the business selection page to choose one
  // Generate tokens WITHOUT business context - user must select a business after login
  const { accessToken, refreshToken } = generateTokenPair(user, null)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      // Don't return a selected business - user must select one
      business: null,
    },
    accessToken,
    refreshToken,
  }
})
