import { vi } from 'vitest'
import { ref, reactive } from 'vue'

// Mock useFetch
export const mockUseFetch = vi.fn(() => ({
  data: ref(null),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(),
  execute: vi.fn()
}))

// Mock useAsyncData
export const mockUseAsyncData = vi.fn(() => ({
  data: ref(null),
  pending: ref(false),
  error: ref(null),
  refresh: vi.fn(),
  execute: vi.fn()
}))

// Mock $fetch
export const mock$Fetch = vi.fn()

// Mock useCookie
export const mockUseCookie = vi.fn(() => ref(null))

// Mock navigateTo
export const mockNavigateTo = vi.fn()

// Mock useRouter
export const mockUseRouter = vi.fn(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  go: vi.fn(),
  currentRoute: ref({ path: '/', params: {}, query: {} })
}))

// Mock useRoute
export const mockUseRoute = vi.fn(() =>
  reactive({
    path: '/',
    params: {},
    query: {},
    hash: '',
    fullPath: '/',
    name: 'index'
  })
)

// Mock useRuntimeConfig
export const mockUseRuntimeConfig = vi.fn(() => ({
  public: {
    googleClientId: 'test-google-client-id',
    apiBase: 'http://localhost:3000'
  }
}))

// Mock useNuxtApp
export const mockUseNuxtApp = vi.fn(() => ({
  $fetch: mock$Fetch,
  provide: vi.fn(),
  hooks: {
    hook: vi.fn(),
    callHook: vi.fn()
  }
}))

// Setup all Nuxt mocks
export function setupNuxtMocks() {
  vi.mock('#app', () => ({
    useFetch: mockUseFetch,
    useAsyncData: mockUseAsyncData,
    useCookie: mockUseCookie,
    navigateTo: mockNavigateTo,
    useRouter: mockUseRouter,
    useRoute: mockUseRoute,
    useRuntimeConfig: mockUseRuntimeConfig,
    useNuxtApp: mockUseNuxtApp
  }))

  vi.mock('#imports', () => ({
    ref,
    reactive,
    computed: vi.fn((fn) => ({ value: fn() })),
    watch: vi.fn(),
    watchEffect: vi.fn(),
    onMounted: vi.fn((cb) => cb()),
    onUnmounted: vi.fn(),
    useFetch: mockUseFetch,
    useAsyncData: mockUseAsyncData,
    useCookie: mockUseCookie,
    navigateTo: mockNavigateTo,
    useRouter: mockUseRouter,
    useRoute: mockUseRoute,
    useRuntimeConfig: mockUseRuntimeConfig,
    useNuxtApp: mockUseNuxtApp
  }))
}

// Helper to mock a successful fetch response
export function mockFetchSuccess<T>(data: T) {
  mockUseFetch.mockReturnValue({
    data: ref(data) as ReturnType<typeof ref>,
    pending: ref(false),
    error: ref(null) as ReturnType<typeof ref>,
    refresh: vi.fn(),
    execute: vi.fn()
  })
}

// Helper to mock a fetch error
export function mockFetchError(error: string) {
  mockUseFetch.mockReturnValue({
    data: ref(null) as ReturnType<typeof ref>,
    pending: ref(false),
    error: ref(new Error(error)) as ReturnType<typeof ref>,
    refresh: vi.fn(),
    execute: vi.fn()
  })
}

// Helper to mock loading state
export function mockFetchLoading() {
  mockUseFetch.mockReturnValue({
    data: ref(null),
    pending: ref(true),
    error: ref(null),
    refresh: vi.fn(),
    execute: vi.fn()
  })
}
