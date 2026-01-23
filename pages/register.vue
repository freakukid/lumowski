<template>
  <div class="auth-page">
    <!-- Animated background -->
    <div class="auth-background">
      <div class="gradient-orb orb-1"></div>
      <div class="gradient-orb orb-2"></div>
      <div class="gradient-orb orb-3"></div>
      <div class="grid-overlay"></div>
    </div>

    <!-- Theme Switcher - Integrated pill design -->
    <div class="auth-theme-container">
      <ClientOnly>
        <div class="auth-theme-pill">
          <ThemeSwitcher />
        </div>
      </ClientOnly>
    </div>

    <!-- Main content -->
    <div class="auth-container">
      <!-- Logo and branding - Enhanced -->
      <div class="auth-brand">
        <div class="auth-logo">
          <div class="auth-logo-glow"></div>
          <h1 class="auth-logo-text">Lumowski</h1>
        </div>
        <p class="auth-tagline">Create your account</p>
      </div>

      <!-- Register card -->
      <div class="auth-card">
        <div class="card-glow"></div>

        <h2 class="card-title">Create Account</h2>
        <p class="card-subtitle">Fill in your details to get started</p>

        <!-- Error message -->
        <Transition name="shake">
          <div v-if="error" class="error-banner">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ error }}</span>
          </div>
        </Transition>

        <form @submit.prevent="handleRegister" class="form-container">
          <!-- Name field -->
          <UiFormGroup label="Full Name" for="name">
            <UiInput
              id="name"
              v-model="form.name"
              type="text"
              required
              placeholder="John Doe"
              input-class="auth-input"
            >
              <template #prefix>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </template>
            </UiInput>
          </UiFormGroup>

          <!-- Email field -->
          <UiFormGroup label="Email" for="email">
            <UiInput
              id="email"
              v-model="form.email"
              type="email"
              required
              placeholder="you@example.com"
              input-class="auth-input"
            >
              <template #prefix>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </template>
            </UiInput>
          </UiFormGroup>

          <!-- Password field -->
          <UiFormGroup label="Password" for="password" hint="Use at least 8 characters">
            <UiInput
              id="password"
              v-model="form.password"
              type="password"
              required
              :minlength="8"
              placeholder="Minimum 8 characters"
              input-class="auth-input"
            >
              <template #prefix>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </template>
            </UiInput>
          </UiFormGroup>

          <!-- Confirm Password field -->
          <UiFormGroup label="Confirm Password" for="confirmPassword">
            <UiInput
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              required
              placeholder="Confirm your password"
              :input-class="[
                'auth-input',
                passwordsMatch && form.confirmPassword ? 'input-match' : '',
                !passwordsMatch && form.confirmPassword ? 'input-mismatch' : ''
              ].filter(Boolean).join(' ')"
            >
              <template #prefix>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </template>
              <template #suffix>
                <Transition name="fade">
                  <svg v-if="passwordsMatch && form.confirmPassword" class="match-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </Transition>
              </template>
            </UiInput>
          </UiFormGroup>

          <!-- Submit button -->
          <UiButton
            type="submit"
            block
            :loading="isLoading"
            loading-text="Creating account..."
            class="submit-btn"
          >
            Create Account
          </UiButton>
        </form>

        <!-- Google Sign-Up Section -->
        <div class="social-divider">
          <span>or</span>
        </div>

        <ClientOnly>
          <AuthGoogleSignInButton text="signup_with" />
        </ClientOnly>

        <!-- Divider -->
        <div class="divider">
          <span>Already a member?</span>
        </div>

        <!-- Login link -->
        <NuxtLink to="/login" class="login-link">
          <span>Sign in instead</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
          </svg>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: 'auth',
})

const { register, isLoading } = useAuth()
const router = useRouter()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const error = ref('')

const passwordsMatch = computed(() => {
  return form.password === form.confirmPassword
})

const handleRegister = async () => {
  error.value = ''

  if (form.password !== form.confirmPassword) {
    error.value = 'Passwords do not match'
    return
  }

  const result = await register({
    name: form.name,
    email: form.email,
    password: form.password,
  })

  if (result.success) {
    // Redirect to business selection - new users need to create or join a business
    router.push('/business/select')
  } else {
    error.value = result.error || 'Registration failed'
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
  @apply w-48 h-48 md:w-96 md:h-96 -top-20 -right-20;
  background: linear-gradient(135deg, rgb(var(--color-accent-400)), rgb(var(--color-accent-600)));
  animation-delay: 0s;
}

.orb-2 {
  @apply w-40 h-40 md:w-80 md:h-80 top-1/2 -left-20;
  background: linear-gradient(135deg, rgb(var(--color-primary-400)), rgb(var(--color-primary-600)));
  animation-delay: -7s;
}

.orb-3 {
  @apply w-36 h-36 md:w-72 md:h-72 -bottom-10 right-1/3;
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-primary-500)));
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
    transform: translate(-30px, 30px) scale(1.05);
  }
  66% {
    transform: translate(20px, -20px) scale(0.95);
  }
}

/* Container */
.auth-container {
  @apply relative z-10 w-full max-w-md;
}

/* Theme Switcher Pill */
.auth-theme-container {
  @apply absolute top-4 right-4 md:top-6 md:right-6 z-50;
}

.auth-theme-pill {
  @apply rounded-full px-1 py-1;
  background: rgba(var(--color-surface-100), 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--color-surface-300), 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Enhanced Logo and Branding */
.auth-brand {
  @apply text-center mb-8 relative;
}

.auth-brand::after {
  content: '';
  @apply absolute left-1/2 -translate-x-1/2 h-px w-24;
  bottom: -5px;
  background: linear-gradient(90deg,
    transparent,
    rgb(var(--color-accent-500)),
    rgb(var(--color-primary-500)),
    transparent
  );
  background-size: 200% 100%;
  animation: shimmer 3s ease-in-out infinite;
}

.auth-logo {
  @apply relative inline-block;
}

.auth-logo-glow {
  @apply absolute inset-0 blur-2xl;
  background: radial-gradient(
    ellipse at center,
    rgba(var(--color-accent-500), 0.4) 0%,
    rgba(var(--color-primary-500), 0.2) 50%,
    transparent 70%
  );
  transform: scale(2);
  animation: pulse-glow 4s ease-in-out infinite;
}

.auth-logo-text {
  @apply relative font-black tracking-tight text-3xl md:text-4xl lg:text-5xl;
  background: linear-gradient(
    135deg,
    rgb(var(--color-accent-500)) 0%,
    rgb(var(--color-accent-400)) 25%,
    rgb(var(--color-primary-500)) 75%,
    rgb(var(--color-primary-400)) 100%
  );
  background-size: 200% 200%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: shimmer 6s ease-in-out infinite;
}

.auth-tagline {
  @apply mt-3 text-lg font-medium;
  color: rgb(var(--color-surface-600));
  animation: fadeInUp 0.6s ease-out 0.2s both;
}

/* Animations */
@keyframes shimmer {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 0.5;
    transform: scale(2);
  }
  50% {
    opacity: 0.8;
    transform: scale(2.2);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .auth-logo-glow,
  .auth-logo-text,
  .auth-brand::after {
    animation: none;
  }

  .auth-tagline {
    animation: none;
    opacity: 1;
  }
}

/* Card */
.auth-card {
  @apply relative p-5 sm:p-8 md:p-10 rounded-3xl;
  background: rgba(var(--color-surface-100), 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(var(--color-surface-300), 0.3);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(var(--color-accent-500), 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.card-glow {
  @apply absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-500;
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-primary-500)));
  filter: blur(20px);
  z-index: -1;
}

.auth-card:hover .card-glow {
  @apply opacity-20;
}

.card-title {
  @apply text-2xl font-bold mb-1;
  color: rgb(var(--color-surface-900));
}

.card-subtitle {
  @apply text-sm mb-6;
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
  @apply space-y-4 md:space-y-5;
}

/* Override UiFormGroup label styles for auth pages */
.form-container :deep(.label) {
  @apply block text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

/* Helper text override */
.form-container :deep(.helper-text) {
  @apply text-xs;
  color: rgb(var(--color-surface-400));
}

/* Match icon in suffix slot */
.form-container :deep(.match-icon) {
  @apply w-5 h-5;
  color: rgb(var(--color-success-500));
}

/* Auth input styles - applied via input-class prop */
.form-container :deep(.auth-input) {
  @apply w-full pl-12 pr-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 outline-none;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.form-container :deep(.auth-input.input-match) {
  border-color: rgb(var(--color-success-500));
  padding-right: 3rem;
}

.form-container :deep(.auth-input.input-mismatch) {
  border-color: rgb(var(--color-error-500));
}

.form-container :deep(.auth-input)::placeholder {
  color: rgb(var(--color-surface-400));
}

.form-container :deep(.auth-input):focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: 0 0 0 4px rgba(var(--color-primary-500), 0.1);
}

.form-container :deep(.auth-input.input-match):focus {
  border-color: rgb(var(--color-success-500));
  box-shadow: 0 0 0 4px rgba(var(--color-success-500), 0.1);
}

/* Style the prefix icon container */
.form-container :deep(.ui-input-prefix) {
  @apply left-4;
  color: rgb(var(--color-surface-400));
  transition: color 0.2s;
}

.form-container :deep(.ui-input-wrapper:focus-within .ui-input-prefix) {
  color: rgb(var(--color-primary-500));
}

/* Style the suffix container for match icon */
.form-container :deep(.ui-input-suffix) {
  @apply right-4;
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

/* Submit Button - override UiButton styles for auth */
.submit-btn {
  @apply relative py-4 px-6 rounded-xl font-semibold text-white overflow-hidden transition-all duration-300 mt-6 min-h-[44px];
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-primary-500))) !important;
  box-shadow: 0 4px 15px rgba(var(--color-accent-500), 0.3);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(var(--color-accent-500), 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  @apply opacity-70 cursor-not-allowed;
}

/* Social Divider */
.social-divider {
  @apply flex items-center gap-4 my-6;
}

.social-divider::before,
.social-divider::after {
  @apply flex-1 h-px;
  background: linear-gradient(90deg, transparent, rgb(var(--color-surface-300)), transparent);
  content: '';
}

.social-divider span {
  @apply text-sm font-medium uppercase tracking-wider;
  color: rgb(var(--color-surface-400));
}

/* Divider */
.divider {
  @apply flex items-center gap-4 my-6;
}

.divider::before,
.divider::after {
  @apply flex-1 h-px;
  background: linear-gradient(90deg, transparent, rgb(var(--color-surface-300)), transparent);
  content: '';
}

.divider span {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

/* Login Link */
.login-link {
  @apply flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl font-semibold transition-all duration-200;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-accent-600));
  border: 2px solid transparent;
}

.login-link:hover {
  background: rgba(var(--color-accent-500), 0.1);
  border-color: rgb(var(--color-accent-500));
}
</style>
