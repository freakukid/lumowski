import type { User } from '~/stores/auth'

/**
 * Standard authentication response from login, register, and OAuth endpoints.
 * Contains the authenticated user and JWT token pair.
 */
export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}

/**
 * Standard API error response structure returned by Nuxt/Nitro.
 * Use this for typed error handling in catch blocks.
 */
export interface ApiErrorResponse {
  data?: {
    message?: string
    statusCode?: number
  }
  statusCode?: number
  message?: string
}

/**
 * Token refresh response - only returns new tokens, not user data.
 */
export interface TokenRefreshResponse {
  accessToken: string
  refreshToken: string
}

/**
 * Standard pagination metadata for list endpoints.
 */
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * Generic paginated response wrapper.
 * Use this for type-safe paginated API responses.
 *
 * @example
 * ```typescript
 * const response = await authFetch<PaginatedResponse<InventoryItem>>('/api/inventory')
 * ```
 */
export interface PaginatedResponse<T> {
  items: T[]
  pagination: Pagination
}
