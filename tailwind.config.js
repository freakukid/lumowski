/** @type {import('tailwindcss').Config} */

// Helper function to create color with CSS variable (comma-separated RGB values)
const withOpacity = (variableName) => {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`
    }
    return `rgb(var(${variableName}))`
  }
}

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './plugins/**/*.{js,ts}',
    './app.vue',
    './error.vue',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors using CSS variables
        primary: {
          50: withOpacity('--color-primary-50'),
          100: withOpacity('--color-primary-100'),
          200: withOpacity('--color-primary-200'),
          300: withOpacity('--color-primary-300'),
          400: withOpacity('--color-primary-400'),
          500: withOpacity('--color-primary-500'),
          600: withOpacity('--color-primary-600'),
          700: withOpacity('--color-primary-700'),
          800: withOpacity('--color-primary-800'),
          900: withOpacity('--color-primary-900'),
          950: withOpacity('--color-primary-950'),
        },
        accent: {
          50: withOpacity('--color-accent-50'),
          100: withOpacity('--color-accent-100'),
          200: withOpacity('--color-accent-200'),
          300: withOpacity('--color-accent-300'),
          400: withOpacity('--color-accent-400'),
          500: withOpacity('--color-accent-500'),
          600: withOpacity('--color-accent-600'),
          700: withOpacity('--color-accent-700'),
          800: withOpacity('--color-accent-800'),
          900: withOpacity('--color-accent-900'),
          950: withOpacity('--color-accent-950'),
        },
        surface: {
          50: withOpacity('--color-surface-50'),
          100: withOpacity('--color-surface-100'),
          200: withOpacity('--color-surface-200'),
          300: withOpacity('--color-surface-300'),
          400: withOpacity('--color-surface-400'),
          500: withOpacity('--color-surface-500'),
          600: withOpacity('--color-surface-600'),
          700: withOpacity('--color-surface-700'),
          800: withOpacity('--color-surface-800'),
          900: withOpacity('--color-surface-900'),
          950: withOpacity('--color-surface-950'),
        },
        error: {
          50: withOpacity('--color-error-50'),
          100: withOpacity('--color-error-100'),
          200: withOpacity('--color-error-200'),
          300: withOpacity('--color-error-300'),
          400: withOpacity('--color-error-400'),
          500: withOpacity('--color-error-500'),
          600: withOpacity('--color-error-600'),
          700: withOpacity('--color-error-700'),
          800: withOpacity('--color-error-800'),
          900: withOpacity('--color-error-900'),
        },
        success: {
          50: withOpacity('--color-success-50'),
          100: withOpacity('--color-success-100'),
          200: withOpacity('--color-success-200'),
          300: withOpacity('--color-success-300'),
          400: withOpacity('--color-success-400'),
          500: withOpacity('--color-success-500'),
          600: withOpacity('--color-success-600'),
          700: withOpacity('--color-success-700'),
          800: withOpacity('--color-success-800'),
          900: withOpacity('--color-success-900'),
        },
        warning: {
          50: withOpacity('--color-warning-50'),
          100: withOpacity('--color-warning-100'),
          200: withOpacity('--color-warning-200'),
          300: withOpacity('--color-warning-300'),
          400: withOpacity('--color-warning-400'),
          500: withOpacity('--color-warning-500'),
          600: withOpacity('--color-warning-600'),
          700: withOpacity('--color-warning-700'),
          800: withOpacity('--color-warning-800'),
          900: withOpacity('--color-warning-900'),
        },
      },
    },
  },
  plugins: [],
}
