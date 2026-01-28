import { useAuthStore } from '~/stores/auth'
import { useAuthFetch } from '~/composables/useAuthFetch'
import { extractApiError } from '~/composables/useApiError'
import type { Business, BusinessMember, InviteCode, BusinessSettings, BusinessSettingsUpdate, LogoUploadResponse } from '~/types/business'
import type { TokenRefreshResponse } from '~/types/api'

/**
 * Response from business creation or join - includes business and new tokens.
 */
interface BusinessAuthResponse extends TokenRefreshResponse {
  business: Business
}

interface CreateInviteOptions {
  role?: 'BOSS' | 'EMPLOYEE'
  expiresInHours?: number
  maxUses?: number
}

export const useBusiness = () => {
  const authStore = useAuthStore()
  const { authFetch } = useAuthFetch()
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const createBusiness = async (name: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await authFetch<BusinessAuthResponse>('/api/business', {
        method: 'POST',
        body: { name },
      })

      // Update tokens with business context
      authStore.setTokens(response.accessToken, response.refreshToken)

      // Update user with business info
      authStore.setBusiness({
        id: response.business.id,
        name: response.business.name,
        role: 'OWNER',
      })

      return { success: true as const, business: response.business }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to create business')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const joinBusiness = async (code: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await authFetch<BusinessAuthResponse>('/api/business/join', {
        method: 'POST',
        body: { code },
      })

      // Update tokens with business context
      authStore.setTokens(response.accessToken, response.refreshToken)

      // Find the user's membership to get their role
      const member = response.business.members?.find(
        (m) => m.userId === authStore.user?.id
      )

      // Update user with business info
      authStore.setBusiness({
        id: response.business.id,
        name: response.business.name,
        role: member?.role || 'EMPLOYEE',
      })

      return { success: true as const, business: response.business }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to join business')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const getBusiness = async () => {
    isLoading.value = true
    error.value = null

    try {
      const business = await authFetch<Business>('/api/business')

      return { success: true as const, business }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to fetch business')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const createInviteCode = async (options: CreateInviteOptions = {}) => {
    isLoading.value = true
    error.value = null

    try {
      const inviteCode = await authFetch<InviteCode>('/api/business/invite', {
        method: 'POST',
        body: options,
      })

      return { success: true as const, inviteCode }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to create invite code')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const deleteInviteCode = async (id: string) => {
    isLoading.value = true
    error.value = null

    try {
      await authFetch(`/api/business/invite/${id}`, {
        method: 'DELETE',
      })

      return { success: true as const }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to delete invite code')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const updateMemberRole = async (memberId: string, role: 'BOSS' | 'EMPLOYEE') => {
    isLoading.value = true
    error.value = null

    try {
      const member = await authFetch<BusinessMember>(`/api/business/members/${memberId}`, {
        method: 'PUT',
        body: { role },
      })

      return { success: true as const, member }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to update member role')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const removeMember = async (memberId: string) => {
    isLoading.value = true
    error.value = null

    try {
      await authFetch(`/api/business/members/${memberId}`, {
        method: 'DELETE',
      })

      return { success: true as const }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to remove member')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Deletes the current business and all related data.
   * Only OWNER role can perform this action.
   * After deletion, clears the auth state (user no longer has this business).
   */
  const deleteBusiness = async () => {
    isLoading.value = true
    error.value = null

    try {
      await authFetch('/api/business', {
        method: 'DELETE',
      })

      // Clear the selected business from auth state
      // The user no longer has this business
      authStore.setBusiness(null)

      // Remove the deleted business from the businesses list
      const deletedBusinessId = authStore.businessId
      if (deletedBusinessId) {
        const updatedBusinesses = authStore.businesses.filter(
          (b) => b.id !== deletedBusinessId
        )
        authStore.setBusinesses(updatedBusinesses)
      }

      return { success: true as const }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to delete business')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Deletes a specific business by ID.
   * Used when deleting from the business selection page.
   * Only OWNER role can perform this action.
   */
  const deleteBusinessById = async (businessId: string) => {
    isLoading.value = true
    error.value = null

    try {
      // First, we need to select the business to get a token with that business context
      // Then delete it
      const selectResponse = await authFetch<{
        accessToken: string
        refreshToken: string
      }>('/api/user/select-business', {
        method: 'POST',
        body: { businessId },
      })

      // Now delete the business using the new token
      await $fetch('/api/business', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${selectResponse.accessToken}`,
        },
      })

      // Remove the deleted business from the businesses list
      const updatedBusinesses = authStore.businesses.filter(
        (b) => b.id !== businessId
      )
      authStore.setBusinesses(updatedBusinesses)

      // If the deleted business was the currently selected one, clear it
      if (authStore.businessId === businessId) {
        authStore.setBusiness(null)
      }

      return { success: true as const }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to delete business')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const getBusinessSettings = async () => {
    isLoading.value = true
    error.value = null

    try {
      const settings = await authFetch<BusinessSettings>('/api/business/settings')

      // Update the auth store with settings for reactivity across components
      authStore.setBusinessSettings({ logoUrl: settings.logoUrl })

      return { success: true as const, settings }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to fetch business settings')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const updateBusinessSettings = async (data: BusinessSettingsUpdate) => {
    isLoading.value = true
    error.value = null

    try {
      const settings = await authFetch<BusinessSettings>('/api/business/settings', {
        method: 'PUT',
        body: data,
      })

      return { success: true as const, settings }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to update business settings')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Uploads a new business logo.
   * Only OWNER role can perform this action.
   *
   * @param imageBase64 - Base64 data URL of the image
   */
  const uploadBusinessLogo = async (imageBase64: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await authFetch<LogoUploadResponse>('/api/business/logo', {
        method: 'POST',
        body: { image: imageBase64 },
      })

      // Update the auth store with the new logo URL for reactivity across components
      authStore.setBusinessLogoUrl(response.logoUrl)

      return { success: true as const, logoUrl: response.logoUrl }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to upload logo. Please try again.')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Deletes the current business logo.
   * Only OWNER role can perform this action.
   */
  const deleteBusinessLogo = async () => {
    isLoading.value = true
    error.value = null

    try {
      await authFetch('/api/business/logo', {
        method: 'DELETE',
      })

      // Clear the logo URL in the auth store for reactivity across components
      authStore.setBusinessLogoUrl(null)

      return { success: true as const }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to delete logo. Please try again.')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Updates the business name.
   * Only OWNER role can perform this action.
   *
   * @param name - The new business name (2-100 characters)
   */
  const updateBusinessName = async (name: string) => {
    isLoading.value = true
    error.value = null

    try {
      const business = await authFetch<Business>('/api/business', {
        method: 'PUT',
        body: { name },
      })

      // Update the auth store with the new name for reactivity across components
      authStore.updateBusinessName(business.name)

      return { success: true as const, business }
    } catch (e: unknown) {
      const message = extractApiError(e, 'Failed to update business name')
      error.value = message
      return { success: false as const, error: message }
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    createBusiness,
    joinBusiness,
    getBusiness,
    createInviteCode,
    deleteInviteCode,
    updateMemberRole,
    removeMember,
    deleteBusiness,
    deleteBusinessById,
    getBusinessSettings,
    updateBusinessSettings,
    uploadBusinessLogo,
    deleteBusinessLogo,
    updateBusinessName,
  }
}
