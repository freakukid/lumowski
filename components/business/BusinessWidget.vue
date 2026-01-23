<template>
  <NuxtLink
    to="/business/select"
    class="business-widget"
  >
    <!-- Business Avatar -->
    <div class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold text-white flex-shrink-0 gradient-mixed">
      {{ currentBusiness?.name?.charAt(0)?.toUpperCase() || 'B' }}
    </div>

    <!-- Business Name -->
    <span class="font-medium text-sm truncate max-w-[180px]" style="color: rgb(var(--color-surface-900));">
      {{ currentBusiness?.name || 'Select Business' }}
    </span>

    <!-- Role Badge -->
    <span
      v-if="authStore.businessRole"
      class="role-badge-mini"
      :class="getRoleBadgeClass(authStore.businessRole)"
    >
      {{ authStore.businessRole }}
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { BusinessRole } from '~/types/schema'

const authStore = useAuthStore()

// Current business computed from store
const currentBusiness = computed(() => {
  if (!authStore.businessId) return null
  return authStore.businesses.find(b => b.id === authStore.businessId) || {
    id: authStore.businessId,
    name: authStore.businessName || 'Business',
    role: authStore.businessRole || 'EMPLOYEE',
    memberCount: 0,
    joinedAt: ''
  }
})

// Get role badge class
function getRoleBadgeClass(role: BusinessRole | null): string {
  switch (role) {
    case 'OWNER':
      return 'role-owner'
    case 'BOSS':
      return 'role-boss'
    case 'EMPLOYEE':
      return 'role-employee'
    default:
      return ''
  }
}
</script>

<style scoped>
/* Role badge mini (smaller for widget) */
.role-badge-mini {
  @apply px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide;
}

.role-owner {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.role-boss {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.role-employee {
  background: rgb(var(--color-surface-200));
  color: rgb(var(--color-surface-600));
}
</style>
