import { defineStore } from 'pinia'
import type { BusinessRole, UserBusiness } from '~/types/schema'
import { isUnauthorizedError } from '~/utils/errorDetection'

export interface User {
  id: string
  email: string
  name: string
  role: 'USER' | 'ADMIN'
  business: UserBusiness | null
}

/**
 * Represents a business the user belongs to (for multi-business selection)
 */
export interface UserBusinessInfo {
  id: string
  name: string
  role: BusinessRole
  memberCount: number
  joinedAt: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
  /** All businesses the user belongs to */
  businesses: UserBusinessInfo[]
  /** Whether businesses list has been fetched */
  businessesFetched: boolean
  /** Whether auth has been initialized from localStorage */
  isInitialized: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: false,
    businesses: [],
    businessesFetched: false,
    isInitialized: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.accessToken && !!state.user,
    hasStoredTokens: (state) => !!state.accessToken,
    isAdmin: (state) => state.user?.role === 'ADMIN',
    /** Whether user has a SELECTED (active) business */
    hasBusiness: (state) => !!state.user?.business,
    /** Whether user belongs to any businesses */
    hasAnyBusiness: (state) => state.businesses.length > 0,
    /** Number of businesses user belongs to */
    businessCount: (state) => state.businesses.length,
    businessId: (state) => state.user?.business?.id ?? null,
    businessName: (state) => state.user?.business?.name ?? null,
    businessRole: (state): BusinessRole | null => state.user?.business?.role ?? null,
    isOwner: (state) => state.user?.business?.role === 'OWNER',
    isBoss: (state) => state.user?.business?.role === 'BOSS',
    isEmployee: (state) => state.user?.business?.role === 'EMPLOYEE',
    canManageMembers: (state) =>
      state.user?.business?.role === 'OWNER' || state.user?.business?.role === 'BOSS',
    canEditSchema: (state) => state.user?.business?.role === 'OWNER',
    canChangeRoles: (state) => state.user?.business?.role === 'OWNER',
    /** Whether user can create, update, or delete inventory items (OWNER and BOSS only) */
    canManageInventory: (state) =>
      state.user?.business?.role === 'OWNER' || state.user?.business?.role === 'BOSS',
  },

  actions: {
    setTokens(accessToken: string, refreshToken: string) {
      this.accessToken = accessToken
      this.refreshToken = refreshToken
      // Persist to localStorage
      if (import.meta.client) {
        localStorage.setItem('accessToken', accessToken)
        localStorage.setItem('refreshToken', refreshToken)
      }
    },

    setUser(user: User) {
      this.user = user
    },

    setBusiness(business: UserBusiness | null) {
      if (this.user) {
        this.user.business = business
      }
    },

    clearAuth() {
      this.user = null
      this.accessToken = null
      this.refreshToken = null
      this.businesses = []
      this.businessesFetched = false
      if (import.meta.client) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    },

    setBusinesses(businesses: UserBusinessInfo[]) {
      this.businesses = businesses
      this.businessesFetched = true
    },

    addBusiness(business: UserBusinessInfo) {
      // Add to the beginning of the list (most recently joined)
      this.businesses.unshift(business)
    },

    loadTokensFromStorage() {
      if (import.meta.client) {
        this.accessToken = localStorage.getItem('accessToken')
        this.refreshToken = localStorage.getItem('refreshToken')
      }
    },

    setInitialized(value: boolean) {
      this.isInitialized = value
    },

    async fetchUser(): Promise<User | null> {
      if (!this.accessToken) return null

      try {
        const user = await $fetch<User>('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        })
        this.setUser(user)
        return user
      } catch {
        // Token might be expired, try to refresh
        const refreshed = await this.refreshTokens()
        if (refreshed) {
          return this.fetchUser()
        }
        this.clearAuth()
        return null
      }
    },

    async refreshTokens() {
      if (!this.refreshToken) return false

      try {
        const response = await $fetch<{ accessToken: string; refreshToken: string }>(
          '/api/auth/refresh',
          {
            method: 'POST',
            body: { refreshToken: this.refreshToken },
          }
        )
        this.setTokens(response.accessToken, response.refreshToken)
        return true
      } catch {
        this.clearAuth()
        return false
      }
    },

    /**
     * Fetches all businesses the user belongs to
     * @param isRetry - Internal flag to prevent infinite retry loops
     */
    async fetchBusinesses(isRetry = false): Promise<UserBusinessInfo[]> {
      if (!this.accessToken) return []

      try {
        const response = await $fetch<{ businesses: UserBusinessInfo[] }>(
          '/api/user/businesses',
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
        )
        this.setBusinesses(response.businesses)
        return response.businesses
      } catch (error: unknown) {
        // If 401 and not already a retry, attempt token refresh
        if (isUnauthorizedError(error) && !isRetry) {
          const refreshed = await this.refreshTokens()
          if (refreshed) {
            return this.fetchBusinesses(true) // Retry once after refresh
          }
        }

        // If fetch fails for other reasons, mark as fetched with empty array
        this.setBusinesses([])
        return []
      }
    },

    /**
     * Selects an active business and updates tokens
     * @param businessId - The ID of the business to select
     * @param isRetry - Internal flag to prevent infinite retry loops
     */
    async selectBusiness(businessId: string, isRetry = false): Promise<User> {
      if (!this.accessToken) {
        throw new Error('Not authenticated')
      }

      try {
        const response = await $fetch<{
          user: User
          accessToken: string
          refreshToken: string
        }>('/api/user/select-business', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
          body: { businessId },
        })

        // Update tokens with new business context
        this.setTokens(response.accessToken, response.refreshToken)
        // Update user with selected business
        this.setUser(response.user)

        return response.user
      } catch (error: unknown) {
        // If 401 and not already a retry, attempt token refresh
        if (isUnauthorizedError(error) && !isRetry) {
          const refreshed = await this.refreshTokens()
          if (refreshed) {
            return this.selectBusiness(businessId, true) // Retry once after refresh
          }
        }

        // Re-throw the error for other cases or if refresh failed
        throw error
      }
    },

    /**
     * Clears the selected business from local state (for switching businesses).
     *
     * Note: This only clears the local state. To properly switch businesses,
     * use selectBusiness() which also updates the JWT tokens with the new
     * business context. This method is useful when navigating to the business
     * selection page where you want to show all options without a "current"
     * selection, or for testing/debugging purposes.
     */
    clearSelectedBusiness() {
      if (this.user) {
        this.user.business = null
      }
    },
  },
})
