<template>
  <div class="auth-page">
    <!-- Animated background -->
    <div class="auth-background">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
      <div class="grid-overlay"></div>
    </div>

    <!-- Theme Switcher -->
    <div class="absolute top-4 right-4 md:top-6 md:right-6 z-50">
      <ClientOnly>
        <ThemeSwitcher />
      </ClientOnly>
    </div>

    <!-- Main content -->
    <div class="select-container">
      <!-- Logo and branding -->
      <div class="text-center mb-8">
        <div class="logo-container">
          <div class="logo-glow"></div>
          <h1 class="logo-text text-3xl md:text-4xl lg:text-5xl">Lumowski</h1>
        </div>
        <p class="tagline">Select a business</p>
      </div>

      <!-- Join by Code Section -->
      <div class="join-section">
        <div class="join-card">
          <div class="join-header">
            <div class="join-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <span class="join-title">Have an invite code?</span>
          </div>
          <form @submit.prevent="handleJoinWithCode" class="join-form">
            <input
              v-model="inviteCode"
              type="text"
              placeholder="Enter code"
              class="join-input"
              :disabled="isJoining"
            />
            <button
              type="submit"
              class="join-btn"
              :disabled="!inviteCode.trim() || isJoining"
            >
              <span v-if="isJoining" class="loading-spinner"></span>
              <span v-else>Join</span>
            </button>
          </form>
          <!-- Join error message -->
          <Transition name="fade">
            <p v-if="joinError" class="join-error">{{ joinError }}</p>
          </Transition>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner large"></div>
        <p class="loading-text">Loading your businesses...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="businesses.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg class="w-12 h-12 md:w-16 md:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h2 class="empty-title">No businesses yet</h2>
        <p class="empty-description">
          Create your first business or join one with an invite code
        </p>
        <button @click="goToSetup" class="create-business-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create a Business
        </button>
      </div>

      <!-- Business cards grid -->
      <div v-else class="business-grid">
        <!-- Business cards -->
        <div
          v-for="business in businesses"
          :key="business.id"
          class="business-card"
          :class="{
            'is-selecting': selectingId === business.id,
            'is-current': currentBusinessId === business.id
          }"
          @click="handleSelectBusiness(business)"
          role="button"
          tabindex="0"
          @keydown.enter="handleSelectBusiness(business)"
          @keydown.space.prevent="handleSelectBusiness(business)"
        >
          <!-- Left: Icon -->
          <div class="business-icon">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>

          <!-- Center: Info -->
          <div class="business-info">
            <div class="business-header">
              <h3 class="business-name">{{ business.name }}</h3>
              <span v-if="currentBusinessId === business.id" class="current-badge">
                Current
              </span>
            </div>
            <div class="business-meta-primary">
              <span class="role-badge" :class="getRoleBadgeClass(business.role)">
                {{ formatRole(business.role) }}
              </span>
              <span class="meta-separator">·</span>
              <span class="member-count">{{ business.memberCount }} {{ business.memberCount === 1 ? 'member' : 'members' }}</span>
            </div>
          </div>

          <!-- Right: Actions (ALWAYS VISIBLE) -->
          <div class="business-actions">
            <!-- Settings button (OWNER and BOSS roles) -->
            <button
              v-if="business.role === 'OWNER' || business.role === 'BOSS'"
              class="action-btn action-settings"
              :aria-label="`Manage settings for ${business.name}`"
              title="Business settings"
              :disabled="managingBusinessId === business.id || selectingId !== null"
              @click.stop="handleManageBusiness(business)"
            >
              <span v-if="managingBusinessId === business.id" class="loading-spinner small"></span>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <!-- Select button -->
            <button
              class="action-btn action-select"
              :aria-label="`Select ${business.name}`"
              title="Select business"
              :disabled="selectingId !== null"
              @click.stop="handleSelectBusiness(business)"
            >
              <div v-if="selectingId === business.id" class="loading-spinner small"></div>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Create new business card -->
        <button
          @click="goToSetup"
          class="create-card"
          :disabled="selectingId !== null"
        >
          <div class="create-content">
            <div class="create-icon">
              <svg class="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span class="create-text">Create a new business</span>
          </div>
        </button>
      </div>

      <!-- Selection error message -->
      <Transition name="shake">
        <div v-if="selectError" class="error-banner">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ selectError }}</span>
        </div>
      </Transition>

      <!-- Logout link -->
      <div class="logout-section">
        <button @click="handleLogout" class="logout-link">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { UserBusinessInfo } from '~/stores/auth'
import type { BusinessRole, ApiError } from '~/types/schema'
import { extractApiError } from '~/composables/useApiError'

definePageMeta({
  layout: false,
})

const router = useRouter()
const authStore = useAuthStore()
const { logout } = useAuth()
const { joinBusiness } = useBusiness()

const isLoading = ref(true)
const businesses = ref<UserBusinessInfo[]>([])
const selectingId = ref<string | null>(null)
const selectError = ref('')
const inviteCode = ref('')
const joinError = ref('')
const isJoining = ref(false)
const managingBusinessId = ref<string | null>(null)

// Currently selected business (if any) - for showing "current" indicator
const currentBusinessId = computed(() => authStore.businessId)

// Fetch businesses on mount
onMounted(async () => {
  // Always fetch businesses - user might want to switch businesses
  // Note: We don't redirect if user has a selected business, they might want to switch
  try {
    const result = await authStore.fetchBusinesses()
    businesses.value = result
  } catch (error) {
    // If auth fails (e.g., JWT expired), redirect to login
    console.error('Failed to fetch businesses:', error)
    await navigateTo('/login')
  } finally {
    isLoading.value = false
  }
})

const handleSelectBusiness = async (business: UserBusinessInfo) => {
  selectError.value = ''
  selectingId.value = business.id

  try {
    await authStore.selectBusiness(business.id)
    router.push('/')
  } catch (e: unknown) {
    const err = e as ApiError
    // If auth fails (e.g., JWT expired), redirect to login
    if (err.statusCode === 401 || err.data?.statusCode === 401) {
      await navigateTo('/login')
      return
    }
    selectError.value = extractApiError(e, 'Failed to select business')
    selectingId.value = null
  }
}

const handleManageBusiness = async (business: UserBusinessInfo) => {
  selectError.value = ''
  managingBusinessId.value = business.id

  try {
    // If this business is not the currently selected one, switch to it first
    if (currentBusinessId.value !== business.id) {
      await authStore.selectBusiness(business.id)
    }
    // Navigate to business settings
    router.push('/business')
  } catch (e: unknown) {
    const err = e as ApiError
    // If auth fails (e.g., JWT expired), redirect to login
    if (err.statusCode === 401 || err.data?.statusCode === 401) {
      await navigateTo('/login')
      return
    }
    selectError.value = extractApiError(e, 'Failed to access business settings')
    managingBusinessId.value = null
  }
}

const handleJoinWithCode = async () => {
  if (!inviteCode.value.trim()) return

  joinError.value = ''
  isJoining.value = true

  try {
    const result = await joinBusiness(inviteCode.value.trim())

    // Check if join was successful
    if (!result.success) {
      joinError.value = result.error
      return
    }

    const business = result.business
    // Add the new business to the list
    const newBusinessInfo: UserBusinessInfo = {
      id: business.id,
      name: business.name,
      role: business.members?.find((m) => m.userId === authStore.user?.id)?.role || 'EMPLOYEE',
      memberCount: business.members?.length || 1,
      joinedAt: new Date().toISOString(),
    }
    authStore.addBusiness(newBusinessInfo)
    // Refresh the businesses list
    businesses.value = authStore.businesses
    inviteCode.value = ''
    // Auto-select the newly joined business
    await handleSelectBusiness(newBusinessInfo)
  } catch (e: unknown) {
    joinError.value = extractApiError(e, 'Failed to join business')
  } finally {
    isJoining.value = false
  }
}

const goToSetup = () => {
  router.push('/business/setup')
}

const handleLogout = () => {
  logout()
}

const formatRole = (role: BusinessRole): string => {
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const getRoleBadgeClass = (role: BusinessRole): string => {
  switch (role) {
    case 'OWNER':
      return 'role-owner'
    case 'BOSS':
      return 'role-boss'
    case 'EMPLOYEE':
      return 'role-employee'
    default:
      return ''
  }
}
</script>

<style scoped>
.auth-page {
  @apply min-h-screen w-full flex items-center justify-center p-4 sm:p-8 md:p-10 relative overflow-hidden;
  background: rgb(var(--color-surface-50));
}

/* Animated Background */
.auth-background {
  @apply absolute inset-0 overflow-hidden;
}

.gradient-orb {
  @apply absolute rounded-full blur-3xl opacity-60;
  animation: float 20s ease-in-out infinite;
}

.orb-1 {
  @apply w-48 h-48 md:w-96 md:h-96 -top-20 -left-20;
  background: linear-gradient(135deg, rgb(var(--color-primary-400)), rgb(var(--color-primary-600)));
  animation-delay: 0s;
}

.orb-2 {
  @apply w-40 h-40 md:w-80 md:h-80 top-1/2 -right-20;
  background: linear-gradient(135deg, rgb(var(--color-accent-400)), rgb(var(--color-accent-600)));
  animation-delay: -7s;
}

.orb-3 {
  @apply w-36 h-36 md:w-72 md:h-72 -bottom-10 left-1/3;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
  animation-delay: -14s;
}

.grid-overlay {
  @apply absolute inset-0 opacity-[0.03];
  background-image:
    linear-gradient(rgb(var(--color-surface-900)) 1px, transparent 1px),
    linear-gradient(90deg, rgb(var(--color-surface-900)) 1px, transparent 1px);
  background-size: 60px 60px;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.05);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.95);
  }
}

/* Container */
.select-container {
  @apply relative z-10 w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl;
}

/* Logo */
.logo-container {
  @apply relative inline-block;
}

.logo-glow {
  @apply absolute inset-0 blur-2xl opacity-50;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
  transform: scale(1.5);
}

.logo-text {
  @apply relative font-black tracking-tight;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)) 0%, rgb(var(--color-accent-500)) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tagline {
  @apply mt-3 text-lg font-medium;
  color: rgb(var(--color-surface-600));
}

/* Join Section */
.join-section {
  @apply mb-6;
}

.join-card {
  @apply p-4 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--color-surface-300), 0.3);
}

.join-header {
  @apply flex items-center gap-3 mb-3;
}

.join-icon {
  @apply w-8 h-8 rounded-lg flex items-center justify-center;
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-primary-500)));
  color: white;
}

.join-title {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

.join-form {
  @apply flex gap-2;
}

.join-input {
  @apply flex-1 px-4 py-3 rounded-xl text-sm font-medium uppercase tracking-widest transition-all duration-200 outline-none min-h-[44px];
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.join-input::placeholder {
  @apply normal-case tracking-normal;
  color: rgb(var(--color-surface-400));
}

.join-input:focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.join-btn {
  @apply px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 min-h-[44px] min-w-[80px] flex items-center justify-center;
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-primary-500)));
}

.join-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(var(--color-accent-500), 0.3);
}

.join-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.join-error {
  @apply mt-2 text-sm font-medium;
  color: rgb(var(--color-error-600));
}

/* Loading State */
.loading-container {
  @apply flex flex-col items-center justify-center py-16;
}

.loading-spinner {
  @apply w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin;
}

.loading-spinner.large {
  @apply w-10 h-10;
  border-color: rgb(var(--color-primary-500));
  border-top-color: transparent;
}

.loading-spinner.small {
  @apply w-4 h-4;
}

.loading-text {
  @apply mt-4 text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

/* Empty State */
.empty-state {
  @apply flex flex-col items-center justify-center py-12 px-6 rounded-3xl text-center;
  background: rgba(var(--color-surface-100), 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--color-surface-300), 0.3);
}

.empty-icon {
  @apply w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center mb-4;
  background: linear-gradient(135deg, rgba(var(--color-primary-500), 0.1), rgba(var(--color-accent-500), 0.1));
  color: rgb(var(--color-primary-500));
}

.empty-title {
  @apply text-xl md:text-2xl font-bold mb-2;
  color: rgb(var(--color-surface-900));
}

.empty-description {
  @apply text-sm md:text-base mb-6;
  color: rgb(var(--color-surface-500));
}

.create-business-btn {
  @apply flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 min-h-[44px];
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.create-business-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(var(--color-primary-500), 0.4);
}

/* Business Grid */
.business-grid {
  @apply grid gap-4;
  grid-template-columns: 1fr;
}

/* Business Card - New Design */
.business-card {
  @apply flex items-start gap-4 p-5 rounded-2xl cursor-pointer transition-all duration-200;
  background: rgba(var(--color-surface-100), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.3);
}

.business-card:hover {
  transform: translateY(-2px);
  border-color: rgb(var(--color-primary-500));
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.business-card:focus-visible {
  outline: 2px solid rgb(var(--color-primary-500));
  outline-offset: 2px;
}

.business-card.is-selecting {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.05);
}

.business-card.is-current {
  border-color: rgb(var(--color-accent-500));
  background: rgba(var(--color-accent-500), 0.05);
}

.business-card.is-current:hover {
  border-color: rgb(var(--color-accent-600));
}

/* Business Icon */
.business-icon {
  @apply w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center text-white;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
}

/* Business Info */
.business-info {
  @apply flex-1 min-w-0;
}

.business-header {
  @apply flex items-center gap-2 flex-wrap;
}

.business-name {
  @apply text-lg font-semibold truncate;
  color: rgb(var(--color-surface-900));
}

.current-badge {
  @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold;
  background: rgba(34, 197, 94, 0.15);
  color: rgb(22, 163, 74);
}

/* Business Meta */
.business-meta-primary {
  @apply flex items-center flex-wrap gap-2 text-sm mt-1;
}

.role-badge {
  @apply px-2 py-0.5 rounded-full text-xs font-semibold;
}

.role-owner {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-600));
}

.role-boss {
  background: rgba(var(--color-accent-500), 0.15);
  color: rgb(var(--color-accent-600));
}

.role-employee {
  background: rgba(var(--color-surface-500), 0.15);
  color: rgb(var(--color-surface-600));
}

.meta-separator {
  @apply text-xs;
  color: rgb(var(--color-surface-400));
}

.member-count {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

/* Business Actions - Always Visible */
.business-actions {
  @apply flex items-center gap-2 flex-shrink-0;
}

.action-btn {
  @apply w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200;
}

.action-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.action-btn:focus-visible {
  outline: 2px solid rgb(var(--color-primary-500));
  outline-offset: 2px;
}

/* Settings Button */
.action-settings {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.action-settings:hover:not(:disabled) {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

/* Select Button */
.action-select {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-500));
}

.action-select:hover:not(:disabled) {
  background: rgba(var(--color-primary-500), 0.2);
}

/* Mobile Responsive - Stack actions vertically on very small screens */
@media (max-width: 480px) {
  .business-actions {
    @apply flex-col;
  }
}

/* Create Card */
.create-card {
  @apply relative p-4 md:p-5 rounded-2xl text-left transition-all duration-200 w-full min-h-[100px];
  background: transparent;
  border: 2px dashed rgba(var(--color-surface-400), 0.5);
}

.create-card:hover:not(:disabled) {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.05);
}

.create-card:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.create-content {
  @apply flex items-center gap-3;
}

.create-icon {
  @apply w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center flex-shrink-0;
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-500));
}

.create-card:hover:not(:disabled) .create-icon {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-500));
}

.create-text {
  @apply text-base font-medium;
  color: rgb(var(--color-surface-500));
}

.create-card:hover:not(:disabled) .create-text {
  color: rgb(var(--color-primary-600));
}

/* Error Banner */
.error-banner {
  @apply flex items-center gap-3 p-4 rounded-xl mt-6 text-sm font-medium;
  background: rgba(var(--color-error-500), 0.1);
  border: 1px solid rgba(var(--color-error-500), 0.2);
  color: rgb(var(--color-error-600));
}

.shake-enter-active {
  animation: shake 0.5s ease-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-10px); }
  40% { transform: translateX(10px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}

/* Logout Section */
.logout-section {
  @apply flex justify-center mt-8;
}

.logout-link {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px];
  color: rgb(var(--color-surface-500));
}

.logout-link:hover {
  color: rgb(var(--color-surface-700));
  background: rgba(var(--color-surface-300), 0.3);
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

</style>
