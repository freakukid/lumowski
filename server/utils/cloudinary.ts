import { v2 as cloudinary, type UploadApiResponse, type UploadApiOptions } from 'cloudinary'

/**
 * Supported image MIME types for upload validation.
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
] as const

export type SupportedImageType = typeof SUPPORTED_IMAGE_TYPES[number]

/**
 * Default maximum file size in bytes (5MB).
 */
export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * Options for uploading an image to Cloudinary.
 */
export interface ImageUploadOptions {
  /** Folder path in Cloudinary (e.g., 'business/logos') */
  folder?: string
  /** Custom public_id for the image (auto-generated if not provided) */
  publicId?: string
  /**
   * Incoming transformation options applied BEFORE storing the asset.
   * These transformations modify what gets stored as the "original" in Cloudinary.
   *
   * Note: 'format' here converts the stored format. Use a specific format like 'webp'
   * for storage optimization. 'auto' only works at delivery time (not for incoming
   * transformations) since it depends on browser capabilities.
   */
  transformation?: {
    width?: number
    height?: number
    crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'limit'
    quality?: number | 'auto'
    /**
     * Output format for the stored image.
     * - 'webp': Modern format with excellent compression (recommended for storage)
     * - 'png': Lossless, supports transparency
     * - 'jpg': Good compression for photos
     * - 'auto': Only works at delivery time, not during upload
     */
    format?: 'webp' | 'png' | 'jpg' | 'auto'
  }
  /** Resource type (default: 'image') */
  resourceType?: 'image' | 'raw' | 'auto'
  /** Overwrite existing file with same public_id */
  overwrite?: boolean
  /** Tags to associate with the upload */
  tags?: string[]
}

/**
 * Result of a successful image upload.
 */
export interface ImageUploadResult {
  /** The secure URL to access the image */
  url: string
  /** The public_id used to reference this image in Cloudinary */
  publicId: string
  /** Original filename */
  originalFilename?: string
  /** File format */
  format: string
  /** File size in bytes */
  bytes: number
  /** Image width in pixels */
  width: number
  /** Image height in pixels */
  height: number
}

/**
 * Options for deleting an image from Cloudinary.
 */
export interface ImageDeleteOptions {
  /** Resource type (default: 'image') */
  resourceType?: 'image' | 'raw' | 'video'
  /** Invalidate CDN cache */
  invalidate?: boolean
}

/**
 * Configures the Cloudinary SDK with credentials from runtime config.
 * Must be called before any Cloudinary operations.
 *
 * @throws Error if Cloudinary credentials are not configured
 */
export function configureCloudinary(): typeof cloudinary {
  const config = useRuntimeConfig()

  if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    throw createError({
      statusCode: 500,
      message: 'Cloudinary credentials are not configured',
    })
  }

  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
    secure: true,
  })

  return cloudinary
}

/**
 * Validates a base64 data URL and extracts the MIME type and data.
 *
 * @param dataUrl - Base64 data URL (e.g., 'data:image/png;base64,iVBOR...')
 * @param allowedTypes - Array of allowed MIME types
 * @param maxSize - Maximum file size in bytes
 * @returns Object containing mimeType and base64 data
 * @throws Error if validation fails
 */
export function validateBase64Image(
  dataUrl: string,
  allowedTypes: readonly string[] = SUPPORTED_IMAGE_TYPES,
  maxSize: number = DEFAULT_MAX_FILE_SIZE
): { mimeType: string; base64Data: string } {
  // Validate data URL format
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw createError({
      statusCode: 400,
      message: 'Invalid image format. Please provide a valid base64 data URL.',
    })
  }

  const [, mimeType, base64Data] = match

  // Validate MIME type
  if (!allowedTypes.includes(mimeType as SupportedImageType)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid file type. Please upload a PNG, JPG, WEBP, or SVG image.',
    })
  }

  // Calculate and validate file size
  // Base64 encoding increases size by ~33%, so we estimate original size
  const estimatedSize = Math.ceil((base64Data.length * 3) / 4)
  if (estimatedSize > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024))
    throw createError({
      statusCode: 400,
      message: `File is too large. Maximum size is ${maxSizeMB}MB.`,
    })
  }

  return { mimeType, base64Data }
}

/**
 * Uploads an image to Cloudinary from a base64 data URL.
 * This is a generic, reusable function for any image upload use case.
 *
 * @param dataUrl - Base64 data URL of the image
 * @param options - Upload options (folder, transformations, etc.)
 * @returns Upload result with URL and public_id
 *
 * @example
 * ```typescript
 * // Upload a business logo
 * const result = await uploadImage(base64DataUrl, {
 *   folder: 'business/logos',
 *   transformation: { width: 400, height: 400, crop: 'limit', quality: 'auto' }
 * })
 * ```
 */
export async function uploadImage(
  dataUrl: string,
  options: ImageUploadOptions = {}
): Promise<ImageUploadResult> {
  const cloud = configureCloudinary()

  // Validate the base64 image
  validateBase64Image(dataUrl)

  // Build Cloudinary upload options
  const uploadOptions: UploadApiOptions = {
    resource_type: options.resourceType || 'image',
    folder: options.folder,
    public_id: options.publicId,
    overwrite: options.overwrite ?? true,
    // Invalidate CDN cache when overwriting to ensure the new file is served immediately.
    // This is important when the format changes (e.g., PNG -> WebP) as the old cached
    // version might persist on the CDN otherwise.
    invalidate: options.overwrite ?? true,
    tags: options.tags,
  }

  // Add incoming transformations if specified
  // Incoming transformations are applied BEFORE storing the asset in Cloudinary.
  // This means the transformed version becomes the stored "original".
  // See: https://cloudinary.com/documentation/eager_and_incoming_transformations
  if (options.transformation) {
    const { width, height, crop, quality, format } = options.transformation
    const transformation: Record<string, unknown> = {}

    // Resize parameters
    if (width) transformation.width = width
    if (height) transformation.height = height
    if (crop) transformation.crop = crop
    else if (width || height) transformation.crop = 'limit'

    // Quality optimization
    if (quality) transformation.quality = quality

    // IMPORTANT: Format conversion must be set at the TOP LEVEL of upload options,
    // NOT inside the transformation object. Setting format inside transformation
    // only affects delivery URLs, not the stored file format.
    // See: https://support.cloudinary.com/hc/en-us/community/posts/360037433232
    if (format) {
      if (format === 'auto') {
        // 'f_auto' only works at delivery time, not during upload.
        // Convert to webp for optimal storage since it provides excellent compression
        // while maintaining quality and supporting transparency.
        uploadOptions.format = 'webp'
      } else {
        // Set format at the top level to actually convert the stored file
        uploadOptions.format = format
      }
    }

    if (Object.keys(transformation).length > 0) {
      uploadOptions.transformation = [transformation]
    }
  }

  try {
    const result: UploadApiResponse = await cloud.uploader.upload(dataUrl, uploadOptions)

    return {
      url: result.secure_url,
      publicId: result.public_id,
      originalFilename: result.original_filename,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    }
  } catch (error: unknown) {
    const errorDetails = error instanceof Error ? error.message : JSON.stringify(error, null, 2)
    console.error('Cloudinary upload error:', {
      operation: 'upload',
      error: errorDetails,
      fullError: error,
      timestamp: new Date().toISOString(),
    })

    // Check for specific Cloudinary errors
    if (errorDetails.includes('quota') || errorDetails.includes('limit')) {
      throw createError({
        statusCode: 503,
        message: 'Upload service temporarily unavailable. Please try again later.',
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to upload image. Please try again.',
    })
  }
}

/**
 * Deletes an image from Cloudinary by its public_id.
 *
 * @param publicId - The public_id of the image to delete
 * @param options - Delete options
 * @returns true if deletion was successful
 *
 * @example
 * ```typescript
 * await deleteImage('business/logos/abc123')
 * ```
 */
export async function deleteImage(
  publicId: string,
  options: ImageDeleteOptions = {}
): Promise<boolean> {
  const cloud = configureCloudinary()

  try {
    const result = await cloud.uploader.destroy(publicId, {
      resource_type: options.resourceType || 'image',
      invalidate: options.invalidate ?? true,
    })

    return result.result === 'ok'
  } catch (error: unknown) {
    const errorDetails = error instanceof Error ? error.message : String(error)
    console.error('Cloudinary delete error:', {
      operation: 'delete',
      publicId,
      error: errorDetails,
      timestamp: new Date().toISOString(),
    })

    // Check for specific Cloudinary errors
    if (errorDetails.includes('quota') || errorDetails.includes('limit')) {
      throw createError({
        statusCode: 503,
        message: 'Delete service temporarily unavailable. Please try again later.',
      })
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to delete image. Please try again.',
    })
  }
}

/**
 * Uploads a business logo with preset optimizations.
 * Convenience wrapper around uploadImage with logo-specific settings.
 *
 * The logo is stored as WebP format for optimal file size while maintaining
 * quality and transparency support. WebP typically provides 25-35% smaller
 * file sizes compared to PNG/JPEG with equivalent quality.
 *
 * @param dataUrl - Base64 data URL of the logo image
 * @param businessId - Business ID for organizing in Cloudinary
 * @returns Upload result
 */
export async function uploadBusinessLogo(
  dataUrl: string,
  businessId: string
): Promise<ImageUploadResult> {
  // Validate businessId format (UUID) to prevent injection attacks
  if (!/^[a-f0-9-]{36}$/i.test(businessId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid business ID format',
    })
  }

  return uploadImage(dataUrl, {
    folder: `lumowski/business/${businessId}/logo`,
    publicId: `${businessId}-logo`,
    overwrite: true,
    transformation: {
      width: 400,
      height: 400,
      crop: 'limit',
      quality: 'auto',
      // Use 'webp' for storage optimization. This is an incoming transformation
      // that converts the image BEFORE storing, ensuring the stored file is
      // in an efficient format. Note: 'auto' doesn't work here because format
      // negotiation requires knowing the browser capabilities at delivery time.
      format: 'webp',
    },
    tags: ['business-logo', businessId],
  })
}
