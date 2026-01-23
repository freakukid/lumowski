import { useAuthStore } from '~/stores/auth'
import type { AuthResponse } from '~/types/api'
import { extractApiError } from '~/composables/useApiError'

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterData {
  email: string
  password: string
  name: string
}

export const useAuth = () => {
  const authStore = useAuthStore()
  const router = useRouter()

  const login = async (credentials: LoginCredentials) => {
    authStore.isLoading = true
    try {
      const response = await $fetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: credentials,
      })

      authStore.setTokens(response.accessToken, response.refreshToken)
      authStore.setUser(response.user)

      return { success: true, user: response.user }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Login failed') }
    } finally {
      authStore.isLoading = false
    }
  }

  const register = async (data: RegisterData) => {
    authStore.isLoading = true
    try {
      const response = await $fetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: data,
      })

      authStore.setTokens(response.accessToken, response.refreshToken)
      authStore.setUser(response.user)

      return { success: true, user: response.user }
    } catch (error: unknown) {
      return { success: false, error: extractApiError(error, 'Registration failed') }
    } finally {
      authStore.isLoading = false
    }
  }

  const logout = () => {
    authStore.clearAuth()
    router.push('/login')
  }

  const initAuth = async () => {
    // Prevent duplicate initialization
    if (authStore.isInitialized) return

    // Only load tokens if not already loaded (app.vue may have loaded them synchronously)
    if (!authStore.accessToken) {
      authStore.loadTokensFromStorage()
    }

    if (authStore.accessToken) {
      await authStore.fetchUser()
    }
    authStore.setInitialized(true)
  }

  return {
    // State
    user: computed(() => authStore.user),
    isAuthenticated: computed(() => authStore.isAuthenticated),
    hasStoredTokens: computed(() => authStore.hasStoredTokens),
    isAdmin: computed(() => authStore.isAdmin),
    isLoading: computed(() => authStore.isLoading),
    isInitialized: computed(() => authStore.isInitialized),
    accessToken: computed(() => authStore.accessToken),

    // Actions
    login,
    register,
    logout,
    initAuth,
  }
}
