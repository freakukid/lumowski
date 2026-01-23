<template>
  <div class="google-signin-container">
    <!-- Custom themed button -->
    <button
      type="button"
      :disabled="isLoading || !isGoogleLoaded"
      class="google-btn"
      @click="handleClick"
    >
      <svg v-if="isLoading" class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <svg v-else class="google-logo" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      <span>{{ buttonText }}</span>
    </button>

    <!-- Error message -->
    <Transition name="fade">
      <p v-if="error" class="google-error">{{ error }}</p>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
}>()

const { isGoogleLoaded, isLoading, error, showOneTap } = useGoogleAuth()

const buttonText = computed(() => {
  if (isLoading.value) return 'Signing in...'
  if (!isGoogleLoaded.value) return 'Loading...'

  switch (props.text) {
    case 'signin_with':
      return 'Sign in with Google'
    case 'signup_with':
      return 'Sign up with Google'
    case 'signin':
      return 'Sign in'
    default:
      return 'Continue with Google'
  }
})

const handleClick = () => {
  if (isGoogleLoaded.value && !isLoading.value) {
    showOneTap()
  }
}
</script>

<style scoped>
.google-signin-container {
  @apply w-full;
}

.google-btn {
  @apply w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-semibold transition-all duration-200;
  background: rgba(var(--color-surface-100), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

.google-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-200), 0.9);
  border-color: rgba(var(--color-primary-400), 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--color-surface-900), 0.1);
}

.google-btn:active:not(:disabled) {
  transform: translateY(0);
}

.google-btn:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.google-logo {
  @apply w-5 h-5 flex-shrink-0;
}

.google-error {
  @apply mt-3 text-sm text-center font-medium;
  color: rgb(var(--color-error-500));
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
