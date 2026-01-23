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
          <NuxtLink to="/operations/receiving" class="add-btn">
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

        <!-- Operations List -->
        <template v-else>
          <!-- Desktop Table -->
          <div class="hidden sm:block">
            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="data-table-header">Date</th>
                    <th class="data-table-header">Type</th>
                    <th class="data-table-header text-center">Items</th>
                    <th class="data-table-header text-center">Total Qty</th>
                    <th class="data-table-header">Reference</th>
                    <th class="data-table-header">User</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="operation in operations"
                    :key="operation.id"
                    :class="['data-table-row', 'clickable-row', { 'row-undone': operation.undoneAt }]"
                    @click="navigateToOperation(operation.id)"
                  >
                    <td class="data-table-cell">
                      {{ formatDate(operation.date) }}
                    </td>
                    <td class="data-table-cell">
                      <div class="flex items-center gap-2">
                        <OperationsTypeBadge :type="operation.type" />
                        <span v-if="operation.undoneAt" class="undone-badge">Undone</span>
                      </div>
                    </td>
                    <td class="data-table-cell text-center">
                      {{ operation.items.length }}
                    </td>
                    <td :class="['data-table-cell', 'text-center', 'font-semibold', { 'qty-undone': operation.undoneAt }]">
                      <template v-if="operation.undoneAt"><s>+{{ operation.totalQty }}</s></template>
                      <template v-else>+{{ operation.totalQty }}</template>
                    </td>
                    <td class="data-table-cell">
                      <span v-if="operation.reference" class="reference-text">
                        {{ operation.reference }}
                      </span>
                      <span v-else class="empty-text">-</span>
                    </td>
                    <td class="data-table-cell">
                      {{ operation.user.name }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Mobile Cards -->
          <div class="sm:hidden cards-container">
            <NuxtLink
              v-for="operation in operations"
              :key="operation.id"
              :to="`/operations/${operation.id}`"
              :class="['operation-card', 'clickable-card', { 'card-undone': operation.undoneAt }]"
            >
              <!-- Card Header -->
              <div class="card-header">
                <div class="card-header-left">
                  <OperationsTypeBadge :type="operation.type" />
                  <span v-if="operation.undoneAt" class="undone-badge">Undone</span>
                  <span class="card-date">{{ formatDate(operation.date) }}</span>
                </div>
                <div :class="['card-total-qty', { 'qty-undone': operation.undoneAt }]">
                  <template v-if="operation.undoneAt"><s>+{{ operation.totalQty }}</s></template>
                  <template v-else>+{{ operation.totalQty }}</template>
                </div>
              </div>

              <!-- Card Content -->
              <div class="card-content">
                <div class="card-field">
                  <span class="field-label">Items</span>
                  <span class="field-value">{{ operation.items.length }} items</span>
                </div>
                <div v-if="operation.reference" class="card-field">
                  <span class="field-label">Reference</span>
                  <span class="field-value">{{ operation.reference }}</span>
                </div>
                <div v-if="operation.supplier" class="card-field">
                  <span class="field-label">Supplier</span>
                  <span class="field-value">{{ operation.supplier }}</span>
                </div>
                <div class="card-field">
                  <span class="field-label">By</span>
                  <span class="field-value">{{ operation.user.name }}</span>
                </div>
              </div>
            </NuxtLink>
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

const router = useRouter()
const { operations, pagination, isLoading, hasInitiallyLoaded, fetchOperations } = useOperations()
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
 * Navigates to the operation details page.
 */
function navigateToOperation(id: string): void {
  router.push(`/operations/${id}`)
}

/**
 * Formats a date string for display.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

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

/* Loading State */
.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

/* Table Styles */
.data-table-container {
  @apply rounded-2xl overflow-hidden;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.data-table {
  @apply w-full;
  border-collapse: collapse;
}

.data-table-header {
  @apply px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider;
  background: rgba(var(--color-surface-200), 0.3);
  color: rgb(var(--color-surface-500));
}

.data-table-row {
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.6);
  transition: background-color 0.15s ease;
}

.data-table-row:last-child {
  border-bottom: none;
}

.data-table-row:hover {
  background: rgba(var(--color-surface-200), 0.3);
}

.data-table-row.clickable-row {
  @apply cursor-pointer;
}

.data-table-row.clickable-row:hover {
  background: rgba(var(--color-primary-500), 0.05);
}

.data-table-cell {
  @apply px-4 py-3 text-sm;
  color: rgb(var(--color-surface-700));
}

.reference-text {
  @apply font-medium;
  color: rgb(var(--color-surface-600));
}

.empty-text {
  color: rgb(var(--color-surface-400));
}

/* Mobile Cards */
.cards-container {
  @apply space-y-4;
}

.operation-card {
  @apply rounded-xl p-4 block;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  text-decoration: none;
}

.operation-card.clickable-card {
  @apply cursor-pointer transition-all;
}

.operation-card.clickable-card:hover {
  background: rgba(var(--color-primary-500), 0.05);
  border-color: rgba(var(--color-primary-500), 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--color-surface-900), 0.08);
}

.card-header {
  @apply flex items-center justify-between gap-3 mb-3;
}

.card-header-left {
  @apply flex items-center gap-2;
}

.card-date {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.card-total-qty {
  @apply text-lg font-bold;
  color: rgb(var(--color-accent-500));
}

.card-content {
  @apply grid grid-cols-2 gap-x-4 gap-y-2;
}

.card-field {
  @apply flex flex-col;
}

.field-label {
  @apply text-xs font-medium mb-0.5;
  color: rgb(var(--color-surface-400));
}

.field-value {
  @apply text-sm;
  color: rgb(var(--color-surface-700));
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

/* Undone Operation Styles */
.undone-badge {
  @apply px-2 py-0.5 text-xs font-semibold rounded-full;
  background: rgba(var(--color-surface-400), 0.15);
  color: rgb(var(--color-surface-500));
}

.row-undone {
  opacity: 0.7;
}

.row-undone:hover {
  opacity: 0.85;
}

.card-undone {
  opacity: 0.7;
}

.card-undone:hover {
  opacity: 0.85;
}

.qty-undone {
  color: rgb(var(--color-surface-500)) !important;
}
</style>
