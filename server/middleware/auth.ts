import { verifyAccessToken } from '~/server/utils/auth'

export default defineEventHandler((event) => {
  // Protect API routes that require authentication
  const url = getRequestURL(event)
  const protectedPaths = [
    '/api/inventory',
    '/api/schema',
    '/api/business',
    '/api/user',
    '/api/import',
    '/api/log',
    '/api/operations',
  ]
  const isProtected = protectedPaths.some((path) => url.pathname.startsWith(path))
  if (!isProtected) {
    return
  }

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

  // Attach user info to event context
  event.context.auth = payload
})
