/**
 * Global authentication initialization middleware.
 *
 * This middleware runs on EVERY route (including initial page load) BEFORE
 * the page component renders. Its purpose is to synchronously load tokens
 * from localStorage so that:
 *
 * 1. The layout can immediately show/hide the header based on hasStoredTokens
 * 2. There's no flash of incorrect UI state on page refresh
 *
 * This is different from the route-specific auth.ts middleware which handles
 * route protection and redirects. This global middleware just ensures tokens
 * are loaded early in the navigation lifecycle.
 *
 * Why middleware instead of app.vue?
 * - Middleware runs BEFORE the route component renders
 * - app.vue's script setup might run after the layout template starts rendering
 * - This ensures tokens are available when the layout computes showHeader
 */
export default defineNuxtRouteMiddleware(() => {
  // Only run on client-side - localStorage is not available on server
  if (import.meta.server) return

  const authStore = useAuthStore()

  // Load tokens from localStorage synchronously if not already loaded.
  // This ensures hasStoredTokens is true immediately if tokens exist,
  // preventing the header from flickering on page refresh.
  if (!authStore.accessToken) {
    authStore.loadTokensFromStorage()
  }
})
