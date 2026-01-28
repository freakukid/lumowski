/**
 * Authentication and business selection middleware.
 *
 * Route categories:
 * 1. Public routes (/login, /register) - accessible without authentication
 * 2. Business-optional routes (/business/setup, /business/select) - require auth but NOT a selected business
 * 3. Protected routes (all others) - require both auth AND a selected business
 *
 * Redirect logic summary:
 * - Not authenticated -> login page
 * - Authenticated but no selected business -> business selection page
 * - Authenticated with business accessing setup/select -> allowed (for switching/creating)
 * - Authenticated with business accessing protected routes -> allowed
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server side - auth state is client-only (localStorage)
  if (import.meta.server) return

  const { isAuthenticated, initAuth } = useAuth()
  const authStore = useAuthStore()

  // Wait for auth to be initialized before making routing decisions.
  // This prevents the login page flash on refresh for authenticated users.
  if (!authStore.isInitialized) {
    await initAuth()
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register']

  // Routes that require auth but NOT a selected business
  // These are routes where user is setting up, selecting, or joining a business
  const noSelectedBizRoutes = ['/business/setup', '/business/select', '/business/join']

  // --- Handle public routes ---
  // Allow unauthenticated access; redirect authenticated users appropriately
  if (publicRoutes.includes(to.path)) {
    if (isAuthenticated.value) {
      // Authenticated users shouldn't see login/register pages
      // Redirect based on whether they have a selected business
      if (!authStore.hasBusiness) {
        return navigateTo('/business/select')
      }
      return navigateTo('/')
    }
    // Allow unauthenticated access to public routes
    return
  }

  // --- All routes below require authentication ---
  if (!isAuthenticated.value) {
    return navigateTo('/login')
  }

  // --- Handle business-optional routes (setup/select) ---
  // These routes are for users who need to select or create a business
  // Users WITH a business can still access them (to switch or create another)
  if (noSelectedBizRoutes.includes(to.path)) {
    // Always allow authenticated users to access setup/select pages
    return
  }

  // --- Handle protected routes (require selected business) ---
  // All other routes require both authentication AND a selected business
  if (!authStore.hasBusiness) {
    return navigateTo('/business/select')
  }

  // User is authenticated and has a selected business - allow access
})
