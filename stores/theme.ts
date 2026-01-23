import { defineStore } from 'pinia'

/**
 * Theme metadata - colors are defined in assets/css/main.css
 * Two-theme system: Ocean Blue (light) and Midnight Dark (dark)
 */
export interface Theme {
  id: string
  name: string
  dark: boolean
}

// Theme definitions (colors are in CSS)
export const themes: Theme[] = [
  { id: 'default', name: 'Ocean Blue', dark: false },
  { id: 'midnight', name: 'Midnight Dark', dark: true },
]

// Get list of dark theme IDs for the inline script
export const darkThemeIds = themes.filter(t => t.dark).map(t => t.id)

interface ThemeState {
  currentThemeId: string
}

// Get initial theme from DOM (set by inline script) or localStorage
function getInitialThemeId(): string {
  if (typeof window !== 'undefined') {
    // First check DOM attribute (already set by inline head script)
    const domTheme = document.documentElement.getAttribute('data-theme')
    if (domTheme && themes.some(t => t.id === domTheme)) {
      return domTheme
    }
    // Fallback to localStorage
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme && themes.some(t => t.id === savedTheme)) {
      return savedTheme
    }
  }
  return 'default'
}

export const useThemeStore = defineStore('theme', {
  state: (): ThemeState => ({
    currentThemeId: getInitialThemeId(),
  }),

  getters: {
    currentTheme: (state): Theme => {
      return themes.find((t) => t.id === state.currentThemeId) || themes[0]
    },

    isDark: (state): boolean => {
      const theme = themes.find((t) => t.id === state.currentThemeId)
      return theme?.dark || false
    },

    availableThemes: (): Theme[] => themes,

    lightThemes: (): Theme[] => themes.filter(t => !t.dark),

    darkThemes: (): Theme[] => themes.filter(t => t.dark),
  },

  actions: {
    setTheme(themeId: string) {
      const theme = themes.find((t) => t.id === themeId)
      if (theme) {
        this.currentThemeId = themeId
        this.applyTheme(theme)
        // Persist to localStorage
        if (import.meta.client) {
          localStorage.setItem('theme', themeId)
        }
      }
    },

    applyTheme(theme: Theme) {
      if (!import.meta.client) return

      const root = document.documentElement

      // Set data-theme attribute for CSS selectors
      root.setAttribute('data-theme', theme.id)

      // Apply dark mode class
      if (theme.dark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    },

    initTheme() {
      if (import.meta.client) {
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme) {
          this.setTheme(savedTheme)
        } else {
          this.applyTheme(this.currentTheme)
        }
      }
    },
  },
})
