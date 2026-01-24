<template>
  <div class="min-h-screen bg-surface-50 dark:bg-surface-50">
    <!-- Show header immediately if tokens exist (prevents layout shift on refresh) -->
    <header
      class="app-header"
      v-if="showHeader"
    >
      <div class="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 h-full">
        <div class="flex justify-between items-center h-full">
          <!-- Logo - always visible -->
          <div class="flex items-center">
            <NuxtLink to="/" class="app-logo">
              <span class="app-logo-text">Lumowski</span>
            </NuxtLink>
          </div>

          <!-- Desktop navigation - hidden on mobile -->
          <div class="hidden md:flex items-center gap-4">
            <!-- Business Widget with dropdown -->
            <BusinessWidget v-if="authStore.hasBusiness" />
            <ThemeSwitcher />
            <button
              @click="logout"
              class="text-sm text-surface-500 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-700"
            >
              Logout
            </button>
          </div>

          <!-- Mobile hamburger button -->
          <button
            @click="toggleMobileMenu"
            class="md:hidden flex items-center justify-center w-11 h-11 touch-target rounded-lg hover:bg-surface-100 transition-colors"
            aria-label="Toggle menu"
            :aria-expanded="mobileMenuOpen"
          >
            <svg
              class="w-6 h-6 text-surface-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                v-if="!mobileMenuOpen"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Mobile menu overlay and slide-out panel -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="mobileMenuOpen && isAuthenticated"
          class="fixed inset-0 bg-black/50 z-40 md:hidden"
          @click="closeMobileMenu"
        />
      </Transition>

      <Transition name="slide">
        <div
          v-if="mobileMenuOpen && isAuthenticated"
          class="fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-white dark:bg-surface-100 shadow-xl z-50 md:hidden safe-area-top"
        >
          <div class="flex flex-col h-full">
            <!-- Mobile menu header -->
            <div class="flex items-center justify-between p-4 border-b border-surface-200">
              <div class="flex items-center gap-3">
                <!-- User avatar placeholder -->
                <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span class="text-primary-600 font-semibold text-lg">
                    {{ user?.name?.charAt(0)?.toUpperCase() || 'U' }}
                  </span>
                </div>
                <div class="flex flex-col">
                  <span class="text-sm font-medium text-surface-900">{{ user?.name }}</span>
                  <span class="text-xs text-surface-500">{{ user?.email }}</span>
                </div>
              </div>
              <button
                @click="closeMobileMenu"
                class="flex items-center justify-center w-10 h-10 touch-target rounded-lg hover:bg-surface-100 transition-colors"
                aria-label="Close menu"
              >
                <svg class="w-5 h-5 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Mobile menu navigation -->
            <nav class="flex-1 py-4 px-2 overflow-y-auto">
              <!-- Current business with enhanced styling -->
              <NuxtLink
                v-if="businessName"
                to="/business/select"
                class="mobile-business-card touch-target"
                @click="closeMobileMenu"
              >
                <!-- Large Avatar -->
                <div class="mobile-business-avatar">
                  {{ businessName?.charAt(0)?.toUpperCase() || '' }}
                </div>
                <div class="flex-1 min-w-0">
                  <!-- Business Name (prominent) -->
                  <span class="block text-base font-semibold truncate text-surface-900">{{ businessName }}</span>
                  <!-- Role Badge -->
                  <span
                    class="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                    :class="mobileRoleBadgeClass"
                  >
                    {{ authStore.businessRole }}
                  </span>
                  <!-- Tap to switch hint -->
                  <span class="block text-xs text-surface-500 mt-1">Tap to switch business</span>
                </div>
                <svg class="w-5 h-5 text-surface-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </NuxtLink>

              <NuxtLink
                to="/"
                class="flex items-center gap-3 px-4 py-3 rounded-xl text-surface-700 hover:bg-surface-100 transition-colors touch-target"
                @click="closeMobileMenu"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                </svg>
                <span class="font-medium">Inventory</span>
              </NuxtLink>

              <NuxtLink
                to="/log"
                class="flex items-center gap-3 px-4 py-3 rounded-xl text-surface-700 hover:bg-surface-100 transition-colors touch-target"
                @click="closeMobileMenu"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>
                </svg>
                <span class="font-medium">Activity Log</span>
              </NuxtLink>

              <NuxtLink
                to="/settings/schema"
                class="flex items-center gap-3 px-4 py-3 rounded-xl text-surface-700 hover:bg-surface-100 transition-colors touch-target"
                @click="closeMobileMenu"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span class="font-medium">Settings</span>
              </NuxtLink>

              <!-- Theme switcher section -->
              <div class="px-4 py-3 mt-2">
                <span class="text-xs font-medium text-surface-500 uppercase tracking-wider">Theme</span>
                <div class="mt-3">
                  <ThemeSwitcher />
                </div>
              </div>
            </nav>

            <!-- Mobile menu footer with logout -->
            <div class="p-4 border-t border-surface-200 safe-area-bottom">
              <button
                @click="handleLogout"
                class="mobile-logout-btn touch-target"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { user, isAuthenticated, hasStoredTokens, isInitialized, logout } = useAuth()
const authStore = useAuthStore()
const businessName = computed(() => authStore.businessName)

// Show header if fully authenticated OR if tokens exist but user data is still loading
// This prevents layout shift on page refresh by showing header immediately when tokens exist
const showHeader = computed(() => isAuthenticated.value || (hasStoredTokens.value && !isInitialized.value))

// Mobile role badge classes
const mobileRoleBadgeClass = computed(() => {
  switch (authStore.businessRole) {
    case 'OWNER':
      return 'bg-primary-100 text-primary-600'
    case 'BOSS':
      return 'bg-accent-100 text-accent-600'
    case 'EMPLOYEE':
      return 'bg-surface-200 text-surface-600'
    default:
      return 'bg-surface-200 text-surface-600'
  }
})

// Mobile menu state
const mobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
}

const handleLogout = () => {
  closeMobileMenu()
  logout()
}

// Close mobile menu on route change
const route = useRoute()
watch(() => route.path, () => {
  closeMobileMenu()
})

// Close mobile menu on escape key
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && mobileMenuOpen.value) {
    closeMobileMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})

// Prevent body scroll when mobile menu is open
watch(mobileMenuOpen, (isOpen) => {
  if (isOpen) {
    document.documentElement.classList.add('overflow-hidden')
  } else {
    document.documentElement.classList.remove('overflow-hidden')
  }
})
</script>

<style scoped>
/* Fade transition for backdrop overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Slide transition for menu panel */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

/* Mobile business card styles */
.mobile-business-card {
  @apply flex items-center gap-4 px-4 py-4 mb-3 rounded-xl transition-colors;
  background: rgba(var(--color-surface-100), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.mobile-business-card:active {
  background: rgb(var(--color-surface-100));
}

.mobile-business-avatar {
  @apply w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-accent-500)));
}

.mobile-logout-btn {
  @apply flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl transition-colors font-medium;
  color: rgb(var(--color-error-600));
}

.mobile-logout-btn:hover {
  background: rgba(var(--color-error-500), 0.08);
}
</style>
