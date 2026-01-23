import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Validate input
  const { email, password, name } = validateAndThrow(registerSchema, body)

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    throw createError({
      statusCode: 400,
      message: 'Email already registered',
    })
  }

  // Create user
  const hashedPassword = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
    },
  })

  // Generate tokens (no business context for new users)
  const { accessToken, refreshToken } = generateTokenPair(user, null)

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      business: null,
    },
    accessToken,
    refreshToken,
  }
})
