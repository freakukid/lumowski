<template>
  <div class="empty-state">
    <div class="empty-icon-container">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        />
      </svg>
    </div>
    <h3 class="empty-title">No operations yet</h3>
    <p class="empty-description">
      Create your first receiving operation to start tracking inventory movements.
    </p>
    <NuxtLink to="/operations/receiving" class="empty-cta">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
      <span>New Receiving</span>
    </NuxtLink>
  </div>
</template>

<style scoped>
.empty-state {
  @apply flex flex-col items-center justify-center py-16 px-4 text-center;
}

.empty-icon-container {
  @apply w-20 h-20 rounded-full flex items-center justify-center mb-6;
  background: rgba(var(--color-surface-200), 0.5);
}

.empty-icon {
  @apply w-10 h-10;
  color: rgb(var(--color-surface-400));
}

.empty-title {
  @apply text-xl font-semibold mb-2;
  color: rgb(var(--color-surface-900));
}

.empty-description {
  @apply text-sm max-w-sm mb-6;
  color: rgb(var(--color-surface-500));
}

.empty-cta {
  @apply flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white transition-all;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.empty-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(var(--color-primary-500), 0.4);
}
</style>
