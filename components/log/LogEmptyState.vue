<template>
  <div class="flex flex-col items-center justify-center py-12 px-4">
    <div class="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
      <svg class="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    </div>
    <h3 class="text-lg font-medium text-surface-900 mb-2">{{ title }}</h3>
    <p class="text-surface-500 text-center max-w-sm">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  message?: string
}

withDefaults(defineProps<Props>(), {
  title: 'No activity yet',
  message: 'Activity logs will appear here as you create, update, and delete inventory items.',
})
</script>
