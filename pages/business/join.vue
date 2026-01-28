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
    <div class="join-container">
      <!-- Logo and branding -->
      <div class="text-center mb-8">
        <div class="logo-container">
          <div class="logo-glow"></div>
          <h1 class="logo-text text-3xl md:text-4xl lg:text-5xl">Lumowski</h1>
        </div>
        <p class="tagline">{{ statusTagline }}</p>
      </div>

      <!-- Status Card -->
      <div class="status-card">
        <!-- Loading State -->
        <div v-if="status === 'loading'" class="status-content">
          <div class="status-icon loading">
            <div class="loading-spinner"></div>
          </div>
          <h2 class="status-title">Joining Business</h2>
          <p class="status-description">Please wait while we process your invite...</p>
        </div>

        <!-- Success State -->
        <div v-else-if="status === 'success'" class="status-content">
          <div class="status-icon success">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="status-title">Welcome!</h2>
          <p class="status-description">
            You've successfully joined <strong>{{ businessName }}</strong>
          </p>
          <p class="status-subtitle">Redirecting you to the dashboard...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="status === 'error'" class="status-content">
          <div class="status-icon error">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 class="status-title">Unable to Join</h2>
          <p class="status-description">{{ errorMessage }}</p>

          <div class="action-buttons">
            <button @click="retryJoin" class="btn-primary" v-if="canRetry">
              Try Again
            </button>
            <NuxtLink to="/business/select" class="btn-secondary">
              Go to Business Selection
            </NuxtLink>
          </div>
        </div>

        <!-- No Code State -->
        <div v-else-if="status === 'no-code'" class="status-content">
          <div class="status-icon warning">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 class="status-title">No Invite Code</h2>
          <p class="status-description">
            You need an invite code to join a business. Ask your team member to share their invite link with you.
          </p>

          <div class="action-buttons">
            <NuxtLink to="/business/select" class="btn-primary">
              Go to Business Selection
            </NuxtLink>
          </div>
        </div>

        <!-- Redirecting to Login State -->
        <div v-else-if="status === 'redirecting'" class="status-content">
          <div class="status-icon loading">
            <div class="loading-spinner"></div>
          </div>
          <h2 class="status-title">Sign In Required</h2>
          <p class="status-description">Redirecting you to sign in...</p>
          <p class="status-subtitle">Your invite code has been saved and will be used after you sign in.</p>
        </div>
      </div>

      <!-- Back to login link (shown when there's an error and user might want to re-auth) -->
      <div v-if="status === 'error'" class="logout-section">
        <button @click="handleLogout" class="logout-link">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign out and try again</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { extractApiError } from '~/composables/useApiError'

definePageMeta({
  layout: false,
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { logout } = useAuth()
const { joinBusiness } = useBusiness()
const { storeInviteCode, clearStoredInviteCode } = useInviteCode()

type JoinStatus = 'loading' | 'success' | 'error' | 'no-code' | 'redirecting'

const status = ref<JoinStatus>('loading')
const errorMessage = ref('')
const businessName = ref('')
const canRetry = ref(true)
const inviteCode = ref('')

const statusTagline = computed(() => {
  switch (status.value) {
    case 'loading':
      return 'Processing your invite...'
    case 'success':
      return 'You\'re all set!'
    case 'error':
      return 'Something went wrong'
    case 'no-code':
      return 'Missing invite code'
    case 'redirecting':
      return 'Almost there...'
    default:
      return 'Join a business'
  }
})

/**
 * Attempts to join the business using the invite code.
 */
const attemptJoin = async (code: string) => {
  status.value = 'loading'
  errorMessage.value = ''

  try {
    const result = await joinBusiness(code)

    if (result.success) {
      businessName.value = result.business.name
      status.value = 'success'

      // Clear the stored invite code since we've used it
      clearStoredInviteCode()

      // Redirect to dashboard after a short delay to show success message
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } else {
      status.value = 'error'
      errorMessage.value = result.error

      // Determine if retry makes sense based on the error
      const nonRetryableErrors = [
        'already a member',
        'Invalid invite code',
      ]
      canRetry.value = !nonRetryableErrors.some(e =>
        result.error.toLowerCase().includes(e.toLowerCase())
      )
    }
  } catch (e: unknown) {
    status.value = 'error'
    errorMessage.value = extractApiError(e, 'Failed to join business')
    canRetry.value = true
  }
}

/**
 * Retry joining with the same invite code.
 */
const retryJoin = () => {
  if (inviteCode.value) {
    attemptJoin(inviteCode.value)
  }
}

/**
 * Handle logout - clears auth and redirects to login.
 */
const handleLogout = () => {
  // Keep the invite code stored so user can try again after re-authenticating
  logout()
}

/**
 * Main initialization logic.
 * Handles the different scenarios based on auth state and invite code presence.
 */
onMounted(async () => {
  // Get the invite code from the URL query parameter
  const code = route.query.code as string | undefined

  if (!code) {
    // No invite code provided
    status.value = 'no-code'
    return
  }

  // Store the code for potential retry
  inviteCode.value = code

  // Check if user is authenticated
  // We need to wait for auth to be initialized
  const { initAuth, isAuthenticated } = useAuth()

  if (!authStore.isInitialized) {
    await initAuth()
  }

  if (isAuthenticated.value) {
    // User is logged in - attempt to join immediately
    // Clear any previously stored invite code first
    clearStoredInviteCode()
    await attemptJoin(code)
  } else {
    // User is not logged in
    // Store the invite code and redirect to login
    storeInviteCode(code)
    status.value = 'redirecting'

    // Short delay to show the redirecting message
    setTimeout(() => {
      // Redirect to login with a return URL back to this page
      router.push(`/login?redirect=/business/join?code=${encodeURIComponent(code)}`)
    }, 1500)
  }
})
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
.join-container {
  @apply relative z-10 w-full max-w-md;
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

/* Status Card */
.status-card {
  @apply relative p-6 md:p-8 rounded-3xl;
  background: rgba(var(--color-surface-100), 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--color-surface-300), 0.3);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(var(--color-primary-500), 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.status-content {
  @apply flex flex-col items-center text-center;
}

.status-icon {
  @apply w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mb-4;
}

.status-icon.loading {
  background: linear-gradient(135deg, rgba(var(--color-primary-500), 0.1), rgba(var(--color-accent-500), 0.1));
  color: rgb(var(--color-primary-500));
}

.status-icon.success {
  background: rgba(var(--color-success-500), 0.15);
  color: rgb(var(--color-success-500));
}

.status-icon.error {
  background: rgba(var(--color-error-500), 0.15);
  color: rgb(var(--color-error-500));
}

.status-icon.warning {
  background: rgba(var(--color-warning-500), 0.15);
  color: rgb(var(--color-warning-600));
}

.status-title {
  @apply text-xl md:text-2xl font-bold mb-2;
  color: rgb(var(--color-surface-900));
}

.status-description {
  @apply text-sm md:text-base mb-2;
  color: rgb(var(--color-surface-600));
}

.status-description strong {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.status-subtitle {
  @apply text-xs md:text-sm;
  color: rgb(var(--color-surface-500));
}

/* Action Buttons */
.action-buttons {
  @apply flex flex-col sm:flex-row gap-3 mt-6 w-full;
}

.btn-primary {
  @apply flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 min-h-[44px];
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(var(--color-primary-500), 0.4);
}

.btn-secondary {
  @apply flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 min-h-[44px];
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
  border: 2px solid transparent;
}

.btn-secondary:hover {
  background: rgba(var(--color-surface-300), 0.5);
  border-color: rgb(var(--color-surface-400));
}

/* Loading Spinner */
.loading-spinner {
  @apply w-8 h-8 rounded-full border-2 animate-spin;
  border-color: rgb(var(--color-primary-500));
  border-top-color: transparent;
}

/* Logout Section */
.logout-section {
  @apply flex justify-center mt-6;
}

.logout-link {
  @apply flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px];
  color: rgb(var(--color-surface-500));
}

.logout-link:hover {
  color: rgb(var(--color-surface-700));
  background: rgba(var(--color-surface-300), 0.3);
}
</style>
