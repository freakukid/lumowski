/**
 * Error structure commonly returned by $fetch on HTTP errors.
 * Handles both Nuxt/Nitro (statusCode) and standard fetch (status) properties.
 */
interface FetchErrorLike {
  statusCode?: number
  status?: number
  data?: {
    statusCode?: number
  }
}

/**
 * Checks if an error is a 401 Unauthorized response.
 *
 * Handles different error structures from various sources:
 * - Nuxt/Nitro errors with `statusCode` property
 * - Standard fetch errors with `status` property
 * - Nested error structures with `data.statusCode`
 *
 * @param error - The error to check (can be any type)
 * @returns True if the error represents a 401 Unauthorized response
 *
 * @example
 * ```typescript
 * try {
 *   await $fetch('/api/protected')
 * } catch (error) {
 *   if (isUnauthorizedError(error)) {
 *     // Handle 401 - token expired, redirect to login, etc.
 *   }
 * }
 * ```
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const fetchError = error as FetchErrorLike

  return (
    fetchError.statusCode === 401 ||
    fetchError.status === 401 ||
    fetchError.data?.statusCode === 401
  )
}
