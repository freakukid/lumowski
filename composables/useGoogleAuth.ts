import { useAuthStore } from '~/stores/auth'
import type { AuthResponse } from '~/types/api'

interface CredentialResponse {
  credential: string
  select_by: string
}

interface TokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void
}

interface CodeClient {
  requestCode: () => void
}

interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void
          prompt: (callback?: (notification: PromptNotification) => void) => void
          renderButton: (element: HTMLElement, config: ButtonConfig) => void
          cancel: () => void
          disableAutoSelect: () => void
        }
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient
          initCodeClient: (config: CodeClientConfig) => CodeClient
        }
      }
    }
  }
}

interface GoogleIdConfig {
  client_id: string
  callback: (response: CredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  itp_support?: boolean
  use_fedcm_for_prompt?: boolean
}

interface PromptNotification {
  isDisplayMoment: () => boolean
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () => string
  isSkippedMoment: () => boolean
  getSkippedReason: () => string
  isDismissedMoment: () => boolean
  getDismissedReason: () => string
}

interface ButtonConfig {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
  error_callback?: (error: { type: string; message: string }) => void
}

interface CodeClientConfig {
  client_id: string
  scope: string
  ux_mode?: 'popup' | 'redirect'
  callback: (response: { code: string; error?: string }) => void
  error_callback?: (error: { type: string; message: string }) => void
}

export const useGoogleAuth = () => {
  const { consumePendingInviteCode } = useInviteCode()
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  const router = useRouter()

  const isGoogleLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Handle credential response from One Tap
  const handleCredentialResponse = async (response: CredentialResponse) => {
    isLoading.value = true
    error.value = null

    try {
      const result = await $fetch<AuthResponse>('/api/auth/google', {
        method: 'POST',
        body: { credential: response.credential },
      })

      authStore.setTokens(result.accessToken, result.refreshToken)
      authStore.setUser(result.user)

      // Check for pending invite code first
      const pendingCode = consumePendingInviteCode()
      if (pendingCode) {
        // Redirect to join page to complete the invite flow
        router.push(`/business/join?code=${encodeURIComponent(pendingCode)}`)
      } else {
        // Default redirect - middleware will handle business selection if needed
        router.push('/')
      }

      return { success: true, user: result.user }
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } }
      error.value = e.data?.message || 'Google sign-in failed'
      return { success: false, error: error.value }
    } finally {
      isLoading.value = false
    }
  }

  const initializeGoogle = () => {
    if (!window.google || !config.public.googleClientId) {
      return
    }

    // Initialize for One Tap (as fallback)
    window.google.accounts.id.initialize({
      client_id: config.public.googleClientId,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: false,
      context: 'signin',
      itp_support: true,
      use_fedcm_for_prompt: false,
    })

    isGoogleLoaded.value = true
  }

  // Try One Tap first, fall back to OAuth popup
  const showOneTap = () => {
    if (!window.google || !isGoogleLoaded.value) {
      return
    }

    error.value = null

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        // Fall back to OAuth popup
        openOAuthPopup()
      }
    })
  }

  // OAuth popup flow - works without Chrome sign-in
  const openOAuthPopup = () => {
    if (!config.public.googleClientId) {
      error.value = 'Google client ID not configured'
      return
    }

    isLoading.value = true
    error.value = null

    const clientId = config.public.googleClientId
    const redirectUri = window.location.origin
    const scope = 'openid email profile'
    const responseType = 'id_token'
    // Generate a cryptographically secure nonce using Web Crypto API
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const nonce = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')

    // Store nonce in both sessionStorage (for client verification) and a cookie (for server verification)
    sessionStorage.setItem('google_nonce', nonce)
    // Set a short-lived cookie for server-side nonce verification (10 minutes, secure, same-site strict)
    document.cookie = `google_nonce=${nonce}; path=/; max-age=600; samesite=strict${window.location.protocol === 'https:' ? '; secure' : ''}`

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', responseType)
    authUrl.searchParams.set('scope', scope)
    authUrl.searchParams.set('nonce', nonce)
    authUrl.searchParams.set('prompt', 'select_account')

    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    const popup = window.open(
      authUrl.toString(),
      'google-auth',
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    )

    if (!popup) {
      isLoading.value = false
      error.value = 'Popup was blocked. Please allow popups for this site.'
      return
    }

    // Listen for the popup to return with the token
    const checkPopup = setInterval(async () => {
      try {
        if (popup.closed) {
          clearInterval(checkPopup)
          isLoading.value = false
          return
        }

        // Check if popup has redirected back to our origin
        if (popup.location.origin === window.location.origin) {
          clearInterval(checkPopup)

          const hash = popup.location.hash.substring(1)
          const params = new URLSearchParams(hash)
          const idToken = params.get('id_token')

          popup.close()

          if (idToken) {
            await handleCredentialResponse({ credential: idToken, select_by: 'popup' })
          } else {
            const errorMsg = params.get('error')
            error.value = errorMsg || 'Failed to get ID token'
            isLoading.value = false
          }
        }
      } catch {
        // Cross-origin error - popup hasn't redirected yet, keep waiting
      }
    }, 100)

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkPopup)
      if (!popup.closed) {
        popup.close()
      }
      if (isLoading.value) {
        isLoading.value = false
        error.value = 'Sign-in timed out'
      }
    }, 300000)
  }

  const renderButton = (element: HTMLElement | null, options?: ButtonConfig) => {
    if (!window.google || !isGoogleLoaded.value || !element) {
      return
    }

    window.google.accounts.id.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      ...options,
    })
  }

  const cancelOneTap = () => {
    if (window.google) {
      window.google.accounts.id.cancel()
    }
  }

  // Watch for script load
  onMounted(() => {
    if (window.google) {
      initializeGoogle()
    } else {
      // Wait for script to load
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle)
          initializeGoogle()
        }
      }, 100)

      // Cleanup after 10 seconds
      setTimeout(() => clearInterval(checkGoogle), 10000)
    }
  })

  onUnmounted(() => {
    cancelOneTap()
  })

  return {
    isGoogleLoaded,
    isLoading,
    error,
    showOneTap,
    openOAuthPopup,
    renderButton,
    cancelOneTap,
    initializeGoogle,
  }
}
