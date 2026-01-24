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
    <div class="absolute top-6 right-6 z-50">
      <ClientOnly>
        <ThemeSwitcher />
      </ClientOnly>
    </div>

    <!-- Main content -->
    <div class="auth-container">
      <!-- Logo and branding -->
      <div class="text-center mb-8">
        <div class="logo-container">
          <div class="logo-glow"></div>
          <h1 class="logo-text">Lumowski</h1>
        </div>
        <p class="tagline">{{ mode === 'choice' ? 'Set up your workspace' : mode === 'create' ? 'Create a Business' : 'Join a Business' }}</p>
      </div>

      <!-- Back to selection link (when user has existing businesses) -->
      <div v-if="hasExistingBusinesses && mode === 'choice'" class="back-to-select">
        <NuxtLink to="/business/select" class="back-to-select-link">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to business selection
        </NuxtLink>
      </div>

      <!-- Choice card -->
      <div v-if="mode === 'choice'" class="auth-card">
        <div class="card-glow"></div>

        <h2 class="card-title">{{ hasExistingBusinesses ? 'Add another business' : `Welcome, ${authStore.user?.name}!` }}</h2>
        <p class="card-subtitle">{{ hasExistingBusinesses ? 'Create a new business or join an existing one' : 'Get started by creating a business or joining an existing one' }}</p>

        <div class="choice-buttons">
          <button @click="mode = 'create'" class="choice-btn create-btn">
            <div class="choice-icon">
              <svg class="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span class="choice-title">Create Business</span>
            <span class="choice-description">Start a new workspace and invite your team</span>
          </button>

          <button @click="mode = 'join'" class="choice-btn join-btn">
            <div class="choice-icon">
              <svg class="w-6 h-6 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span class="choice-title">Join Business</span>
            <span class="choice-description">Use an invite code to join an existing team</span>
          </button>
        </div>
      </div>

      <!-- Create business card -->
      <div v-else-if="mode === 'create'" class="auth-card">
        <div class="card-glow"></div>

        <button @click="mode = 'choice'" class="back-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 class="card-title">Create Your Business</h2>
        <p class="card-subtitle">Give your workspace a name</p>

        <!-- Error message -->
        <Transition name="shake">
          <div v-if="error" class="error-banner">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ error }}</span>
          </div>
        </Transition>

        <form @submit.prevent="handleCreate" class="form-container">
          <UiFormGroup label="Business Name" for="businessName">
            <UiInput
              id="businessName"
              v-model="businessName"
              type="text"
              required
              placeholder="My Business"
              input-class="auth-input"
            >
              <template #prefix>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </template>
            </UiInput>
          </UiFormGroup>

          <UiButton
            type="submit"
            block
            :loading="isLoading"
            loading-text="Creating..."
            class="submit-btn"
          >
            Create Business
          </UiButton>
        </form>
      </div>

      <!-- Join business card -->
      <div v-else-if="mode === 'join'" class="auth-card">
        <div class="card-glow"></div>

        <button @click="mode = 'choice'" class="back-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h2 class="card-title">Join a Business</h2>
        <p class="card-subtitle">Enter the invite code you received</p>

        <!-- Error message -->
        <Transition name="shake">
          <div v-if="error" class="error-banner">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ error }}</span>
          </div>
        </Transition>

        <form @submit.prevent="handleJoin" class="form-container">
          <UiFormGroup label="Invite Code" for="inviteCode">
            <UiInput
              id="inviteCode"
              v-model="inviteCode"
              type="text"
              required
              placeholder="ABCD1234"
              input-class="auth-input invite-code-input"
            >
              <template #prefix>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </template>
            </UiInput>
          </UiFormGroup>

          <UiButton
            type="submit"
            block
            :loading="isLoading"
            loading-text="Joining..."
            class="submit-btn"
          >
            Join Business
          </UiButton>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
})

const router = useRouter()
const authStore = useAuthStore()
const { createBusiness, joinBusiness, isLoading } = useBusiness()

const mode = ref<'choice' | 'create' | 'join'>('choice')
const businessName = ref('')
const inviteCode = ref('')
const error = ref('')

// Check if user has existing businesses (for UI adjustments)
const hasExistingBusinesses = computed(() => authStore.businessCount > 0 || authStore.hasBusiness)

// Fetch businesses on mount to know if user already has any
onMounted(async () => {
  if (!authStore.businessesFetched) {
    await authStore.fetchBusinesses()
  }
})

const handleCreate = async () => {
  error.value = ''
  const result = await createBusiness(businessName.value)

  if (!result.success) {
    error.value = result.error
    return
  }

  const business = result.business
  // Add the new business to the list
  authStore.addBusiness({
    id: business.id,
    name: business.name,
    role: 'OWNER',
    memberCount: 1,
    joinedAt: new Date().toISOString(),
  })
  // The newly created business is automatically selected (tokens updated by createBusiness)
  // Redirect to business selection page
  router.push('/business/select')
}

const handleJoin = async () => {
  error.value = ''
  const result = await joinBusiness(inviteCode.value)

  if (!result.success) {
    error.value = result.error
    return
  }

  const business = result.business
  // Add the new business to the list
  const member = business.members?.find((m) => m.userId === authStore.user?.id)
  authStore.addBusiness({
    id: business.id,
    name: business.name,
    role: member?.role || 'EMPLOYEE',
    memberCount: business.members?.length || 1,
    joinedAt: new Date().toISOString(),
  })
  // The joined business is automatically selected (tokens updated by joinBusiness)
  // Redirect to home since business is now selected
  router.push('/')
}
</script>

<style scoped>
.auth-page {
  @apply min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden;
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
  @apply w-96 h-96 -top-20 -left-20;
  background: linear-gradient(135deg, rgb(var(--color-primary-400)), rgb(var(--color-primary-600)));
  animation-delay: 0s;
}

.orb-2 {
  @apply w-80 h-80 top-1/2 -right-20;
  background: linear-gradient(135deg, rgb(var(--color-accent-400)), rgb(var(--color-accent-600)));
  animation-delay: -7s;
}

.orb-3 {
  @apply w-72 h-72 -bottom-10 left-1/3;
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
.auth-container {
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
  @apply relative text-4xl sm:text-5xl font-black tracking-tight;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)) 0%, rgb(var(--color-accent-500)) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.tagline {
  @apply mt-3 text-base md:text-lg font-medium;
  color: rgb(var(--color-surface-600));
}

/* Card */
.auth-card {
  @apply relative p-5 sm:p-8 md:p-10 rounded-3xl;
  background: rgba(var(--color-surface-100), 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--color-surface-300), 0.3);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(var(--color-primary-500), 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.card-glow {
  @apply absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-500;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
  filter: blur(20px);
  z-index: -1;
}

.auth-card:hover .card-glow {
  @apply opacity-20;
}

.card-title {
  @apply text-xl md:text-2xl font-bold mb-1;
  color: rgb(var(--color-surface-900));
}

.card-subtitle {
  @apply text-sm mb-6;
  color: rgb(var(--color-surface-500));
}

/* Back button */
.back-btn {
  @apply flex items-center gap-1 text-sm font-medium mb-4 transition-colors min-h-[44px] px-2 -ml-2;
  color: rgb(var(--color-surface-500));
}

.back-btn:hover {
  color: rgb(var(--color-primary-500));
}

/* Choice buttons */
.choice-buttons {
  @apply space-y-4;
}

.choice-btn {
  @apply w-full p-5 md:p-6 rounded-2xl text-left transition-all duration-200;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
}

.choice-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.create-btn:hover {
  border-color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.05);
}

.join-btn:hover {
  border-color: rgb(var(--color-accent-500));
  background: rgba(var(--color-accent-500), 0.05);
}

.choice-icon {
  @apply w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mb-3;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
  color: white;
}

.join-btn .choice-icon {
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-primary-500)));
}

.choice-title {
  @apply block text-lg font-semibold mb-1;
  color: rgb(var(--color-surface-900));
}

.choice-description {
  @apply block text-sm;
  color: rgb(var(--color-surface-500));
}

/* Error */
.error-banner {
  @apply flex items-center gap-3 p-4 rounded-xl mb-6 text-sm font-medium;
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

/* Form */
.form-container {
  @apply space-y-5;
}

.form-container :deep(.label) {
  @apply block text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.form-container :deep(.auth-input) {
  @apply w-full pl-12 pr-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 outline-none;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.form-container :deep(.invite-code-input) {
  @apply uppercase tracking-widest;
}

.form-container :deep(.auth-input)::placeholder {
  color: rgb(var(--color-surface-400));
}

.form-container :deep(.auth-input):focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.form-container :deep(.ui-input-prefix) {
  @apply left-4;
  color: rgb(var(--color-surface-400));
  transition: color 0.2s;
}

.form-container :deep(.ui-input-wrapper:focus-within .ui-input-prefix) {
  color: rgb(var(--color-primary-500));
}

/* Submit Button */
.submit-btn {
  @apply relative py-4 px-6 rounded-xl font-semibold text-white overflow-hidden transition-all duration-300;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600))) !important;
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(var(--color-primary-500), 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  @apply opacity-70 cursor-not-allowed;
}

/* Back to selection link */
.back-to-select {
  @apply mb-4 text-center;
}

.back-to-select-link {
  @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px];
  color: rgb(var(--color-surface-500));
}

.back-to-select-link:hover {
  color: rgb(var(--color-primary-500));
  background: rgba(var(--color-primary-500), 0.1);
}
</style>
