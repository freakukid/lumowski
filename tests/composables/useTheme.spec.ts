import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, computed } from 'vue'

/**
 * Tests for useTheme composable
 *
 * The composable wraps the Pinia theme store and provides:
 * - Theme state: currentTheme, currentThemeId, isDark, availableThemes, lightThemes, darkThemes
 * - Theme actions: initTheme, setTheme, cycleTheme
 */

// Make Vue reactivity functions available globally for Nuxt auto-imports
vi.stubGlobal('ref', ref)
vi.stubGlobal('computed', computed)

// Mock store state that can be modified between tests
const mockStoreState = {
  currentThemeId: 'default',
  currentTheme: { id: 'default', name: 'Ocean Blue', dark: false },
  isDark: false,
  lightThemes: [{ id: 'default', name: 'Ocean Blue', dark: false }],
  darkThemes: [{ id: 'midnight', name: 'Midnight Dark', dark: true }],
}

// Mock functions
const mockInitTheme = vi.fn()
const mockSetTheme = vi.fn()

// Define themes inline in the mock to avoid hoisting issues
vi.mock('~/stores/theme', () => {
  const themesArray = [
    { id: 'default', name: 'Ocean Blue', dark: false },
    { id: 'midnight', name: 'Midnight Dark', dark: true },
  ]

  return {
    useThemeStore: vi.fn(() => mockStoreState),
    themes: themesArray,
  }
})

// Import after mocks are set up
import { useTheme } from '~/composables/useTheme'

// ============================================================================
// Test Utilities
// ============================================================================

// Themes array for test assertions
const testThemes = [
  { id: 'default', name: 'Ocean Blue', dark: false },
  { id: 'midnight', name: 'Midnight Dark', dark: true },
]

function resetMockStoreState() {
  mockStoreState.currentThemeId = 'default'
  mockStoreState.currentTheme = { id: 'default', name: 'Ocean Blue', dark: false }
  mockStoreState.isDark = false
  mockStoreState.lightThemes = [{ id: 'default', name: 'Ocean Blue', dark: false }]
  mockStoreState.darkThemes = [{ id: 'midnight', name: 'Midnight Dark', dark: true }]
  // Re-attach mock functions after reset
  mockStoreState.initTheme = mockInitTheme
  mockStoreState.setTheme = mockSetTheme
  mockInitTheme.mockClear()
  mockSetTheme.mockClear()
}

// ============================================================================
// Tests: Initialization and State
// ============================================================================

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockStoreState()
  })

  describe('initialization', () => {
    it('should return theme composable with all expected properties', () => {
      const theme = useTheme()

      expect(theme).toHaveProperty('currentTheme')
      expect(theme).toHaveProperty('currentThemeId')
      expect(theme).toHaveProperty('isDark')
      expect(theme).toHaveProperty('availableThemes')
      expect(theme).toHaveProperty('lightThemes')
      expect(theme).toHaveProperty('darkThemes')
      expect(theme).toHaveProperty('initTheme')
      expect(theme).toHaveProperty('setTheme')
      expect(theme).toHaveProperty('cycleTheme')
    })

    it('should expose availableThemes as the themes array', () => {
      const theme = useTheme()

      expect(theme.availableThemes).toEqual(testThemes)
      expect(theme.availableThemes).toHaveLength(2)
    })
  })

  // ============================================================================
  // Tests: Computed Properties
  // ============================================================================

  describe('currentTheme', () => {
    it('should return computed currentTheme from store', () => {
      const theme = useTheme()

      expect(theme.currentTheme.value).toEqual({
        id: 'default',
        name: 'Ocean Blue',
        dark: false,
      })
    })

    it('should reflect store changes', () => {
      const theme = useTheme()

      // Simulate store change
      mockStoreState.currentTheme = { id: 'midnight', name: 'Midnight Dark', dark: true }

      expect(theme.currentTheme.value).toEqual({
        id: 'midnight',
        name: 'Midnight Dark',
        dark: true,
      })
    })
  })

  describe('currentThemeId', () => {
    it('should return computed currentThemeId from store', () => {
      const theme = useTheme()

      expect(theme.currentThemeId.value).toBe('default')
    })

    it('should reflect store changes', () => {
      const theme = useTheme()

      mockStoreState.currentThemeId = 'midnight'

      expect(theme.currentThemeId.value).toBe('midnight')
    })
  })

  describe('isDark', () => {
    it('should return false for light theme', () => {
      const theme = useTheme()

      expect(theme.isDark.value).toBe(false)
    })

    it('should return true for dark theme', () => {
      mockStoreState.isDark = true
      const theme = useTheme()

      expect(theme.isDark.value).toBe(true)
    })
  })

  describe('lightThemes', () => {
    it('should return computed lightThemes from store', () => {
      const theme = useTheme()

      expect(theme.lightThemes.value).toEqual([
        { id: 'default', name: 'Ocean Blue', dark: false },
      ])
    })
  })

  describe('darkThemes', () => {
    it('should return computed darkThemes from store', () => {
      const theme = useTheme()

      expect(theme.darkThemes.value).toEqual([
        { id: 'midnight', name: 'Midnight Dark', dark: true },
      ])
    })
  })

  // ============================================================================
  // Tests: initTheme
  // ============================================================================

  describe('initTheme', () => {
    it('should call store initTheme', () => {
      const theme = useTheme()

      theme.initTheme()

      expect(mockInitTheme).toHaveBeenCalledOnce()
    })

    it('should be callable multiple times', () => {
      const theme = useTheme()

      theme.initTheme()
      theme.initTheme()
      theme.initTheme()

      expect(mockInitTheme).toHaveBeenCalledTimes(3)
    })
  })

  // ============================================================================
  // Tests: setTheme
  // ============================================================================

  describe('setTheme', () => {
    it('should call store setTheme with theme id', () => {
      const theme = useTheme()

      theme.setTheme('midnight')

      expect(mockSetTheme).toHaveBeenCalledWith('midnight')
    })

    it('should call store setTheme with default theme id', () => {
      const theme = useTheme()

      theme.setTheme('default')

      expect(mockSetTheme).toHaveBeenCalledWith('default')
    })

    it('should pass invalid theme ids to store (store handles validation)', () => {
      const theme = useTheme()

      theme.setTheme('nonexistent')

      expect(mockSetTheme).toHaveBeenCalledWith('nonexistent')
    })

    it('should pass empty string to store', () => {
      const theme = useTheme()

      theme.setTheme('')

      expect(mockSetTheme).toHaveBeenCalledWith('')
    })
  })

  // ============================================================================
  // Tests: cycleTheme
  // ============================================================================

  describe('cycleTheme', () => {
    it('should cycle from first theme to second theme', () => {
      mockStoreState.currentThemeId = 'default'
      const theme = useTheme()

      theme.cycleTheme()

      expect(mockSetTheme).toHaveBeenCalledWith('midnight')
    })

    it('should cycle from last theme back to first theme (wrap around)', () => {
      mockStoreState.currentThemeId = 'midnight'
      const theme = useTheme()

      theme.cycleTheme()

      expect(mockSetTheme).toHaveBeenCalledWith('default')
    })

    it('should handle multiple cycles correctly', () => {
      mockStoreState.currentThemeId = 'default'
      const theme = useTheme()

      // First cycle: default -> midnight
      theme.cycleTheme()
      expect(mockSetTheme).toHaveBeenCalledWith('midnight')

      // Simulate store update
      mockStoreState.currentThemeId = 'midnight'

      // Second cycle: midnight -> default (wrap around)
      theme.cycleTheme()
      expect(mockSetTheme).toHaveBeenCalledWith('default')
    })
  })

  // ============================================================================
  // Tests: Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle unknown current theme id gracefully', () => {
      mockStoreState.currentThemeId = 'unknown-theme'
      const theme = useTheme()

      // cycleTheme uses findIndex which returns -1 for unknown
      // (-1 + 1) % 2 = 0, so it goes to first theme
      theme.cycleTheme()

      expect(mockSetTheme).toHaveBeenCalledWith('default')
    })

    it('should handle empty current theme id', () => {
      mockStoreState.currentThemeId = ''
      const theme = useTheme()

      theme.cycleTheme()

      // Empty string won't match any theme, so index = -1
      // (-1 + 1) % 2 = 0, goes to first theme
      expect(mockSetTheme).toHaveBeenCalledWith('default')
    })

    it('should return consistent values across multiple calls', () => {
      const theme1 = useTheme()
      const theme2 = useTheme()

      expect(theme1.currentThemeId.value).toBe(theme2.currentThemeId.value)
      expect(theme1.isDark.value).toBe(theme2.isDark.value)
      expect(theme1.availableThemes).toEqual(theme2.availableThemes)
    })
  })

  // ============================================================================
  // Tests: Theme Structure Validation
  // ============================================================================

  describe('theme structure', () => {
    it('should have themes with required properties', () => {
      const theme = useTheme()

      theme.availableThemes.forEach((t) => {
        expect(t).toHaveProperty('id')
        expect(t).toHaveProperty('name')
        expect(t).toHaveProperty('dark')
        expect(typeof t.id).toBe('string')
        expect(typeof t.name).toBe('string')
        expect(typeof t.dark).toBe('boolean')
      })
    })

    it('should have at least one light and one dark theme', () => {
      const theme = useTheme()

      const lightThemes = theme.availableThemes.filter((t) => !t.dark)
      const darkThemes = theme.availableThemes.filter((t) => t.dark)

      expect(lightThemes.length).toBeGreaterThanOrEqual(1)
      expect(darkThemes.length).toBeGreaterThanOrEqual(1)
    })

    it('should have unique theme ids', () => {
      const theme = useTheme()
      const ids = theme.availableThemes.map((t) => t.id)
      const uniqueIds = [...new Set(ids)]

      expect(ids.length).toBe(uniqueIds.length)
    })
  })
})
