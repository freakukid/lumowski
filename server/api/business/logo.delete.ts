import prisma from '~/server/utils/prisma'
import { deleteImage } from '~/server/utils/cloudinary'

/**
 * DELETE /api/business/logo
 * Deletes the business logo from Cloudinary and removes references in settings.
 * Only business owners can delete the logo.
 */
export default ownerRoute(async (_event, { businessId }) => {
  // Get current settings to find the logo public ID
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId },
    select: { logoPublicId: true },
  })

  if (!settings?.logoPublicId) {
    throw createError({
      statusCode: 404,
      message: 'No logo found to delete',
    })
  }

  // Delete from Cloudinary
  await deleteImage(settings.logoPublicId)

  // Update settings to remove logo references
  await prisma.businessSettings.update({
    where: { businessId },
    data: {
      logoUrl: null,
      logoPublicId: null,
    },
  })

  return { success: true }
}, 'delete business logo')
