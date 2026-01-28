<template>
  <div class="operations-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-info">
          <h1 class="page-title">Operations</h1>
          <p class="page-subtitle">
            {{ pagination.total }} operations total
          </p>
        </div>
        <div class="header-actions">
          <NuxtLink to="/cashier" class="add-btn add-btn-sale">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span class="btn-label">New Sale</span>
          </NuxtLink>
          <NuxtLink to="/returns" class="add-btn add-btn-return">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span class="btn-label">Returns</span>
          </NuxtLink>
          <NuxtLink to="/operations/receiving" class="add-btn">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <span class="btn-label">New Receiving</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Initial Loading State (before first fetch completes) -->
      <div v-if="!hasInitiallyLoaded" class="loading-state">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p>Loading operations...</p>
      </div>

      <!-- Content (only shown after initial load completes) -->
      <template v-else>
        <!-- Empty State (only shown after load confirms no operations) -->
        <OperationsEmptyState v-if="operations.length === 0" />

        <!-- Operations Cards Grid -->
        <template v-else>
          <div class="operations-cards-grid">
            <OperationsOperationCard
              v-for="operation in operations"
              :key="operation.id"
              :operation="operation"
            />
          </div>

          <!-- Pagination -->
          <div v-if="pagination.totalPages > 1" class="pagination">
            <button
              :disabled="pagination.page === 1"
              class="pagination-btn"
              @click="changePage(pagination.page - 1)"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              <span class="hidden md:inline">Previous</span>
            </button>
            <span class="pagination-info">
              <span class="md:hidden">{{ pagination.page }}</span>
              <span class="hidden md:inline">
                Page {{ pagination.page }} of {{ pagination.totalPages }}
              </span>
            </span>
            <button
              :disabled="pagination.page === pagination.totalPages"
              class="pagination-btn"
              @click="changePage(pagination.page + 1)"
            >
              <span class="hidden md:inline">Next</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Operation } from '~/types/operation'

definePageMeta({
  middleware: 'auth',
})

// Note: isLoading is available but not currently displayed in the UI
// (initial loading uses hasInitiallyLoaded for cleaner UX)
const { operations, pagination, hasInitiallyLoaded, fetchOperations } = useOperations()
const { onOperationUndone, offOperationUndone, onOperationCreated, offOperationCreated } = useSocket()

/**
 * Handles real-time operation:undone events from socket.
 * Updates the operation in the list if it exists.
 */
function handleOperationUndone(operation: Operation) {
  const index = operations.value.findIndex((op) => op.id === operation.id)
  if (index !== -1) {
    operations.value[index] = operation
  }
}

/**
 * Handles real-time operation:created events from socket.
 * Refreshes the operations list to include the new operation.
 */
function handleOperationCreated(_operation: Operation) {
  // Refresh the list to get the new operation in the correct position
  // This is simpler than inserting and re-sorting manually
  fetchOperations({ page: pagination.value.page })
}

// Fetch operations on mount and subscribe to socket events
onMounted(async () => {
  await fetchOperations()

  // Subscribe to real-time operation events
  onOperationUndone(handleOperationUndone)
  onOperationCreated(handleOperationCreated)
})

// Cleanup socket subscriptions on unmount
onUnmounted(() => {
  offOperationUndone(handleOperationUndone)
  offOperationCreated(handleOperationCreated)
})

/**
 * Changes the current page and fetches operations.
 */
async function changePage(page: number): Promise<void> {
  await fetchOperations({ page })
}
</script>

<style scoped>
.operations-page {
  @apply min-h-screen py-8 px-4;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-7xl mx-auto;
}

.page-header {
  @apply flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6;
}

.header-info {
  @apply space-y-1;
}

.page-title {
  @apply text-xl md:text-2xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.header-actions {
  @apply flex items-center gap-3;
}

.add-btn {
  @apply flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl font-semibold text-white transition-all;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.add-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

.add-btn-sale {
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-600)));
  box-shadow: 0 4px 15px rgba(var(--color-accent-500), 0.3);
}

.add-btn-sale:hover {
  box-shadow: 0 6px 20px rgba(var(--color-accent-500), 0.4);
}

.add-btn-return {
  background: linear-gradient(135deg, rgb(var(--color-warning-500)), rgb(var(--color-warning-600)));
  box-shadow: 0 4px 15px rgba(var(--color-warning-500), 0.3);
}

.add-btn-return:hover {
  box-shadow: 0 6px 20px rgba(var(--color-warning-500), 0.4);
}

/* Hide button label text on mobile for compact layout */
@media (max-width: 640px) {
  .add-btn .btn-label {
    @apply sr-only;
  }
}

/* Loading State */
.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

/* Cards Grid */
.operations-cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .operations-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Pagination */
.pagination {
  @apply flex items-center justify-between md:justify-center gap-4 mt-6;
}

.pagination-btn {
  @apply flex items-center justify-center gap-1 min-w-[44px] min-h-[44px] p-3 md:px-4 md:py-2 rounded-lg font-medium transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.5);
}

.pagination-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.pagination-info {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}
</style>
