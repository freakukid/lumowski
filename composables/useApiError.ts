/**
 * Extracts a user-friendly error message from an API error response.
 *
 * Handles the common error structures returned by Nuxt/Nitro fetch calls,
 * including nested data.message patterns and top-level message properties.
 *
 * @param error - The caught error (typically from a $fetch or authFetch call)
 * @param fallback - Default message to return if no specific message is found
 * @returns A user-friendly error message string
 *
 * @example
 * ```typescript
 * try {
 *   await authFetch('/api/resource')
 * } catch (error) {
 *   const message = extractApiError(error, 'Failed to fetch resource')
 *   // message will be the API error message or the fallback
 * }
 * ```
 */
export function extractApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>
    if (typeof err.data === 'object' && err.data !== null) {
      const data = err.data as Record<string, unknown>
      if (typeof data.message === 'string') return data.message
    }
    if (typeof err.message === 'string') return err.message
  }
  return fallback
}
