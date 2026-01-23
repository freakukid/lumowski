import { vi, beforeEach } from 'vitest'
import { config } from '@vue/test-utils'

// Stub Nuxt components globally
config.global.stubs = {
  NuxtLink: {
    template: '<a><slot /></a>'
  },
  NuxtPage: true,
  ClientOnly: {
    template: '<slot />'
  },
  Teleport: {
    template: '<div><slot /></div>'
  }
}

// Mock window.matchMedia for theme tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: MockResizeObserver
})

// Mock scrollTo
window.scrollTo = vi.fn()

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks()
})
