<template>
  <div class="setup-reminder">
    <div class="reminder-icon">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <div class="reminder-content">
      <p class="reminder-text">
        <strong>{{ title }}</strong>
        {{ message }}
      </p>
      <NuxtLink to="/settings/schema" class="reminder-link">
        <span>Go to Schema Settings</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /**
   * The bold title text displayed before the message
   */
  title: string
  /**
   * The message text explaining what action is needed
   */
  message: string
}>()
</script>

<style scoped>
.setup-reminder {
  @apply flex items-start gap-4 p-4 rounded-xl mb-6;
  background: rgba(var(--color-warning-500), 0.08);
  border: 1px solid rgba(var(--color-warning-500), 0.2);
}

.reminder-icon {
  @apply flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg;
  background: rgba(var(--color-warning-500), 0.12);
  color: rgb(var(--color-warning-600));
}

.reminder-content {
  @apply flex-1 min-w-0;
}

.reminder-text {
  @apply text-sm leading-relaxed mb-2;
  color: rgb(var(--color-surface-700));
}

.reminder-text strong {
  color: rgb(var(--color-warning-700));
}

.reminder-link {
  @apply inline-flex items-center gap-1.5 text-sm font-semibold transition-colors min-h-[44px] -mb-2;
  color: rgb(var(--color-warning-600));
}

.reminder-link:hover {
  color: rgb(var(--color-warning-700));
}

.reminder-link:focus {
  @apply outline-none;
  border-radius: 4px;
  box-shadow: var(--focus-ring);
}
</style>
