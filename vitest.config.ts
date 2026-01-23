import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules', '.nuxt', 'dist'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'components/**/*.vue',
        'composables/**/*.ts',
        'stores/**/*.ts',
        'server/api/**/*.ts',
        'server/utils/**/*.ts',
        'utils/**/*.ts'
      ],
      exclude: [
        'node_modules',
        'tests',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts',
        'nuxt.config.ts',
        '.nuxt'
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, '.'),
      '@': resolve(__dirname, '.'),
      '#app': resolve(__dirname, 'node_modules/nuxt/dist/app'),
      '#imports': resolve(__dirname, '.nuxt/imports.d.ts')
    }
  }
})
