import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'
import { uploadBusinessLogo, deleteImage } from '~/server/utils/cloudinary'

const uploadLogoSchema = z.object({
  image: z.string().min(1, 'Image data is required'),
})

// Simple in-memory rate limiting (max 10 uploads per hour per user)
const uploadLimiter = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const record = uploadLimiter.get(userId)

  if (!record || record.resetTime < now) {
    uploadLimiter.set(userId, { count: 1, resetTime: now + 3600000 }) // 1 hour
    return true
  }

  if (record.count >= 10) {
    return false
  }

  record.count++
  return true
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER'], 'upload business logo')

  // Validate Content-Type header
  const contentType = getHeader(event, 'content-type')
  if (!contentType?.includes('application/json')) {
    throw createError({
      statusCode: 400,
      message: 'Content-Type must be application/json',
    })
  }

  // Check rate limit
  if (!checkRateLimit(auth.userId)) {
    throw createError({
      statusCode: 429,
      message: 'Too many upload requests. Please try again later.',
    })
  }

  const body = await readBody(event)
  const parsed = uploadLogoSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request data',
    })
  }

  const { image } = parsed.data

  // Get current settings to check for existing logo
  const existingSettings = await prisma.businessSettings.findUnique({
    where: { businessId: auth.businessId },
    select: { logoPublicId: true },
  })

  // Delete old logo from Cloudinary if it exists
  if (existingSettings?.logoPublicId) {
    try {
      await deleteImage(existingSettings.logoPublicId)
    } catch (error) {
      // Log but don't fail if old image deletion fails
      console.error('Failed to delete old logo:', error)
    }
  }

  // Upload new logo to Cloudinary
  const uploadResult = await uploadBusinessLogo(image, auth.businessId)

  // Upsert settings with new logo URL and public ID
  const settings = await prisma.businessSettings.upsert({
    where: { businessId: auth.businessId },
    create: {
      businessId: auth.businessId,
      logoUrl: uploadResult.url,
      logoPublicId: uploadResult.publicId,
    },
    update: {
      logoUrl: uploadResult.url,
      logoPublicId: uploadResult.publicId,
    },
  })

  return {
    logoUrl: settings.logoUrl,
    logoPublicId: settings.logoPublicId,
  }
})
