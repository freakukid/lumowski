import { useAuthStore } from '~/stores/auth'
import { isUnauthorizedError } from '~/utils/errorDetection'

/**
 * Options for authenticated fetch requests.
 * Extends standard RequestInit with typed method and query support.
 */
interface AuthFetchOptions extends Omit<RequestInit, 'method' | 'body'> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
}

/**
 * Composable for making authenticated API calls with automatic token refresh.
 *
 * Features:
 * - Automatically adds Authorization header with the current access token
 * - Catches 401 Unauthorized errors and attempts token refresh
 * - Retries the original request with the new token if refresh succeeds
 * - Throws the error if refresh fails or if the retry also fails
 *
 * @example
 * ```typescript
 * const { authFetch } = useAuthFetch()
 *
 * // GET request
 * const data = await authFetch<User[]>('/api/users')
 *
 * // POST request with body
 * const newItem = await authFetch<Item>('/api/items', {
 *   method: 'POST',
 *   body: { name: 'New Item' }
 * })
 *
 * // GET request with query params
 * const results = await authFetch<SearchResults>('/api/search', {
 *   query: { q: 'search term', page: 1 }
 * })
 * ```
 */
export function useAuthFetch() {
  const authStore = useAuthStore()

  /**
   * Makes an authenticated API request with automatic token refresh on 401 errors.
   *
   * @param url - The API endpoint URL (relative or absolute)
   * @param options - Fetch options including method, body, query params, and headers
   * @returns Promise resolving to the typed response data
   * @throws Re-throws the error if it's not a 401, or if token refresh fails
   */
  const authFetch = async <T>(url: string, options: AuthFetchOptions = {}): Promise<T> => {
    const { query, ...fetchOptions } = options

    /**
     * Performs the actual fetch with current access token.
     * Separated to allow retry after token refresh.
     */
    const doFetch = async (): Promise<T> => {
      const result = await $fetch(url, {
        ...fetchOptions,
        body: fetchOptions.body as Record<string, unknown> | undefined,
        query,
        headers: {
          ...fetchOptions.headers,
          Authorization: `Bearer ${authStore.accessToken}`,
        },
      })
      return result as T
    }

    try {
      return await doFetch()
    } catch (error: unknown) {
      // Only attempt refresh for 401 Unauthorized errors
      if (isUnauthorizedError(error)) {
        // Attempt to refresh the access token
        const refreshed = await authStore.refreshTokens()

        if (refreshed) {
          // Token refresh succeeded - retry the original request with new token
          return await doFetch()
        }
        // Refresh failed - authStore.refreshTokens() already cleared auth state
      }

      // Re-throw for non-401 errors or if refresh failed
      throw error
    }
  }

  return { authFetch }
}
