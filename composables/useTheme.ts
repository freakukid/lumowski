import { useThemeStore, themes } from '~/stores/theme'

export const useTheme = () => {
  const themeStore = useThemeStore()

  const initTheme = () => {
    themeStore.initTheme()
  }

  const setTheme = (themeId: string) => {
    themeStore.setTheme(themeId)
  }

  const cycleTheme = () => {
    const currentIndex = themes.findIndex((t) => t.id === themeStore.currentThemeId)
    const nextIndex = (currentIndex + 1) % themes.length
    themeStore.setTheme(themes[nextIndex].id)
  }

  return {
    // State
    currentTheme: computed(() => themeStore.currentTheme),
    currentThemeId: computed(() => themeStore.currentThemeId),
    isDark: computed(() => themeStore.isDark),
    availableThemes: themes,
    lightThemes: computed(() => themeStore.lightThemes),
    darkThemes: computed(() => themeStore.darkThemes),

    // Actions
    initTheme,
    setTheme,
    cycleTheme,
  }
}
