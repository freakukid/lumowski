export default defineNuxtPlugin(() => {
  const { initTheme } = useTheme()

  // Initialize theme from localStorage on app startup
  initTheme()
})
