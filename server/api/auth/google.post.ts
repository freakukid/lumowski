import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate input
  const result = googleAuthSchema.safeParse(body)
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: result.error.errors[0].message,
    })
  }

  // Verify Google ID token
  const googleUser = await verifyGoogleToken(result.data.credential)
  if (!googleUser) {
    throw createError({
      statusCode: 401,
      message: 'Invalid Google token',
    })
  }

  // Verify nonce to prevent replay attacks (OAuth popup flow only)
  // The nonce is set by the client in a cookie before redirecting to Google
  const nonceCookie = getCookie(event, 'google_nonce')
  if (nonceCookie) {
    // If a nonce cookie exists, the token MUST have a matching nonce
    if (!googleUser.nonce || googleUser.nonce !== nonceCookie) {
      throw createError({
        statusCode: 401,
        message: 'Invalid nonce - possible replay attack',
      })
    }
    // Clear the nonce cookie after successful verification (single use)
    deleteCookie(event, 'google_nonce')
  }
  // Note: One Tap flow doesn't use a nonce cookie, so we skip verification for that flow

  // Check if user exists by googleId first
  let user = await prisma.user.findUnique({
    where: { googleId: googleUser.sub },
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
    // Check if user exists by email (for account linking)
    const existingUser = await prisma.user.findUnique({
      where: { email: googleUser.email },
    })

    if (existingUser) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { googleId: googleUser.sub },
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
    } else {
      // Create new user with Google account (no password)
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.sub,
        },
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
    }
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
