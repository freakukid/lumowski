<template>
  <div class="import-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <NuxtLink to="/" class="back-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="hidden sm:inline">Back to Inventory</span>
          <span class="sm:hidden">Back</span>
        </NuxtLink>
        <h1 class="page-title">Import Inventory</h1>
      </div>

      <!-- Wizard Card -->
      <div class="wizard-card">
        <ImportWizard @complete="handleComplete" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()

const handleComplete = () => {
  router.push('/')
}
</script>

<style scoped>
.import-page {
  @apply min-h-screen py-4 px-3 md:py-8 md:px-4;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-4xl mx-auto;
}

.page-header {
  @apply flex items-center gap-4 mb-6;
}

.back-btn {
  @apply flex items-center gap-2 px-3 min-h-[44px] rounded-xl font-medium transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.back-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.page-title {
  @apply text-xl md:text-2xl font-bold;
  color: rgb(var(--color-surface-900));
}

.wizard-card {
  @apply p-4 sm:p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}
</style>
