<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <!-- Header -->
    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Activity Log</h1>
        <p class="mt-1 text-surface-500">Track all changes to your inventory</p>
      </div>
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="action-btn-labeled">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
          <span>Inventory</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="error-container">
      <div class="error-header">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-medium">Error loading logs</span>
      </div>
      <p class="error-message">{{ error }}</p>
      <button
        class="error-retry"
        @click="loadLogs"
      >
        Try again
      </button>
    </div>

    <!-- Log list -->
    <LogList
      ref="logListRef"
      :logs="logs"
      :loading="loading"
      :has-initially-loaded="hasInitiallyLoaded"
      :pagination="pagination"
      :users="users"
      @filter="handleFilter"
      @page="handlePage"
      @undo="handleUndo"
    />

    <!-- Toast notification -->
    <Teleport to="body">
      <Transition name="toast">
        <div
          v-if="toast.show"
          class="fixed bottom-4 right-4 z-50 max-w-sm bg-white dark:bg-surface-100 rounded-lg shadow-lg border border-surface-200 p-4"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              :class="toast.type === 'success' ? 'toast-icon-success' : 'toast-icon-error'"
            >
              <svg
                v-if="toast.type === 'success'"
                class="w-4 h-4 toast-svg-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg
                v-else
                class="w-4 h-4 toast-svg-error"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-surface-900">{{ toast.title }}</p>
              <p v-if="toast.message" class="text-sm text-surface-500 mt-0.5">{{ toast.message }}</p>
            </div>
            <button
              class="text-surface-400 hover:text-surface-500"
              @click="toast.show = false"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { InventoryLog, LogFilters, Pagination } from '~/types/log'

definePageMeta({
  middleware: 'auth',
})

const { fetchLogs, undoLog: undoLogApi, loading, error } = useLog()

const logs = ref<InventoryLog[]>([])
const pagination = ref<Pagination | null>(null)
const users = ref<{ id: string; name: string }[]>([])
const currentFilters = ref<LogFilters>({})
const currentPage = ref(1)
const hasInitiallyLoaded = ref(false)

const logListRef = ref<{ closeUndoModal: () => void } | null>(null)

// Toast state
const toast = reactive({
  show: false,
  type: 'success' as 'success' | 'error',
  title: '',
  message: '',
})

function showToast(type: 'success' | 'error', title: string, message = '') {
  toast.type = type
  toast.title = title
  toast.message = message
  toast.show = true

  setTimeout(() => {
    toast.show = false
  }, 4000)
}

async function loadLogs() {
  const result = await fetchLogs(currentFilters.value, currentPage.value)
  if (result) {
    logs.value = result.logs
    pagination.value = result.pagination

    // Extract unique users from logs for filter dropdown
    const userMap = new Map<string, { id: string; name: string }>()
    for (const log of result.logs) {
      if (!userMap.has(log.user.id)) {
        userMap.set(log.user.id, { id: log.user.id, name: log.user.name })
      }
    }
    users.value = Array.from(userMap.values())
  }
  hasInitiallyLoaded.value = true
}

function handleFilter(filters: LogFilters) {
  currentFilters.value = filters
  currentPage.value = 1 // Reset to first page on filter change
  loadLogs()
}

function handlePage(page: number) {
  currentPage.value = page
  loadLogs()
}

async function handleUndo(log: InventoryLog) {
  const result = await undoLogApi(log.id)

  if (result?.success) {
    showToast('success', 'Action undone', result.message)
    logListRef.value?.closeUndoModal()
    // Reload logs to reflect the change
    await loadLogs()
  } else {
    showToast('error', 'Failed to undo', error.value || 'Something went wrong')
    logListRef.value?.closeUndoModal()
  }
}

// Load initial data
onMounted(() => {
  loadLogs()
})
</script>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(1rem);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

.action-btn-labeled {
  @apply flex items-center gap-2 px-4 min-h-[44px] rounded-xl font-medium transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.action-btn-labeled:hover {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

/* Error state styles */
.error-container {
  @apply rounded-lg p-4 mb-4;
  background: rgba(var(--color-error-500), 0.1);
  border: 1px solid rgba(var(--color-error-500), 0.3);
}

.error-header {
  @apply flex items-center gap-2;
  color: rgb(var(--color-error-700));
}

.error-message {
  @apply text-sm mt-1;
  color: rgb(var(--color-error-600));
}

.error-retry {
  @apply mt-2 text-sm underline;
  color: rgb(var(--color-error-700));
}

.error-retry:hover {
  text-decoration: none;
}

/* Toast icon styles */
.toast-icon-success {
  background: rgba(var(--color-success-500), 0.15);
}

.toast-icon-error {
  background: rgba(var(--color-error-500), 0.15);
}

.toast-svg-success {
  color: rgb(var(--color-success-600));
}

.toast-svg-error {
  color: rgb(var(--color-error-600));
}
</style>
