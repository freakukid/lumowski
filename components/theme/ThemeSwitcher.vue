<template>
  <button
    @click="toggleTheme"
    class="theme-toggle"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Switch to Ocean Blue (Light)' : 'Switch to Midnight Dark'"
  >
    <!-- Sun icon for dark mode (shows when dark, click to go light) -->
    <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
    <!-- Moon icon for light mode (shows when light, click to go dark) -->
    <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useThemeStore } from '~/stores/theme'
import { storeToRefs } from 'pinia'

const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)

function toggleTheme() {
  themeStore.setTheme(isDark.value ? 'default' : 'midnight')
}
</script>

<style scoped>
.theme-toggle {
  @apply w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200;
  background: rgba(var(--color-surface-100), 0.8);
  color: rgb(var(--color-surface-600));
}

.theme-toggle:hover {
  background: rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-700));
}
</style>
