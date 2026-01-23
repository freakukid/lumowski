export default defineNuxtPlugin(async () => {
  const { initAuth } = useAuth()

  // Initialize auth state from localStorage on app startup
  await initAuth()
})
