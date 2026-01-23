<template>
  <div class="operation-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <NuxtLink to="/operations" class="back-link">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Operations</span>
        </NuxtLink>

        <!-- Undo Button (visible only for owners, not undone operations) -->
        <button
          v-if="canUndo"
          class="undo-button"
          :disabled="isUndoing"
          @click="showUndoModal = true"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span>Undo</span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && !currentOperation" class="loading-state">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading operation...</p>
      </div>

      <!-- Operation Details -->
      <div v-else-if="currentOperation" :class="{ 'operation-undone': currentOperation.undoneAt }">
        <!-- Header Content -->
        <div class="header-content">
          <!-- Header Icon -->
          <div :class="['header-icon', { 'header-icon-undone': currentOperation.undoneAt }]">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 11v4m0 0l-2-2m2 2l2-2" />
            </svg>
          </div>

          <div class="header-text">
            <div class="title-row">
              <h1 class="page-title">{{ operationTitle }}</h1>
              <OperationsTypeBadge :type="currentOperation.type" />
              <span v-if="currentOperation.undoneAt" class="undone-badge">Undone</span>
            </div>
            <p class="page-subtitle">{{ formatDate(currentOperation.date) }}</p>
          </div>
        </div>

        <!-- Details Card -->
        <div class="details-card">
          <div class="card-header">
            <div class="card-header-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span class="card-header-text">Operation Details</span>
          </div>

          <dl class="details-list">
            <div class="detail-row">
              <dt class="detail-label">Date</dt>
              <dd class="detail-value">{{ formatDate(currentOperation.date) }}</dd>
            </div>

            <div v-if="currentOperation.reference" class="detail-row">
              <dt class="detail-label">Reference</dt>
              <dd class="detail-value">{{ currentOperation.reference }}</dd>
            </div>

            <div v-if="currentOperation.supplier" class="detail-row">
              <dt class="detail-label">Supplier</dt>
              <dd class="detail-value">{{ currentOperation.supplier }}</dd>
            </div>

            <div v-if="currentOperation.notes" class="detail-row">
              <dt class="detail-label">Notes</dt>
              <dd class="detail-value notes-value">{{ currentOperation.notes }}</dd>
            </div>

            <div class="detail-row">
              <dt class="detail-label">Created By</dt>
              <dd class="detail-value">{{ currentOperation.user.name }}</dd>
            </div>

            <div class="detail-row">
              <dt class="detail-label">Created At</dt>
              <dd class="detail-value">{{ formatDateTime(currentOperation.createdAt) }}</dd>
            </div>

            <!-- Undone information -->
            <template v-if="currentOperation.undoneAt">
              <div class="detail-row undone-detail">
                <dt class="detail-label">Undone At</dt>
                <dd class="detail-value">{{ formatDateTime(currentOperation.undoneAt) }}</dd>
              </div>

              <div v-if="currentOperation.undoneBy" class="detail-row undone-detail">
                <dt class="detail-label">Undone By</dt>
                <dd class="detail-value">{{ currentOperation.undoneBy.name }}</dd>
              </div>
            </template>
          </dl>
        </div>

        <!-- Summary Card -->
        <div :class="['summary-card', { 'summary-card-undone': currentOperation.undoneAt }]">
          <div class="summary-item">
            <span :class="['summary-value', { 'summary-value-undone': currentOperation.undoneAt }]">
              <template v-if="currentOperation.undoneAt">
                <s>+{{ currentOperation.totalQty }}</s>
              </template>
              <template v-else>+{{ currentOperation.totalQty }}</template>
            </span>
            <span class="summary-label">Total Quantity</span>
          </div>
          <div :class="['summary-divider', { 'summary-divider-undone': currentOperation.undoneAt }]"></div>
          <div class="summary-item">
            <span :class="['summary-value', { 'summary-value-undone': currentOperation.undoneAt }]">{{ currentOperation.items.length }}</span>
            <span class="summary-label">Items</span>
          </div>
        </div>

        <!-- Items Section -->
        <div class="items-section">
          <div class="section-header">
            <h2 class="section-title">Items</h2>
          </div>

          <!-- Desktop Table -->
          <div class="hidden sm:block">
            <div class="items-table-container">
              <table class="items-table">
                <thead>
                  <tr>
                    <th class="table-header">Item</th>
                    <th class="table-header text-center">Qty Received</th>
                    <th class="table-header text-center">Stock Change</th>
                    <th v-if="hasCostInfo" class="table-header text-right">Cost Info</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in currentOperation.items" :key="item.itemId" class="table-row">
                    <td class="table-cell">
                      <NuxtLink :to="`/inventory/${item.itemId}`" class="item-link">
                        {{ item.itemName }}
                      </NuxtLink>
                    </td>
                    <td class="table-cell text-center">
                      <span class="qty-badge">+{{ item.quantity }}</span>
                    </td>
                    <td class="table-cell text-center">
                      <span class="stock-change">{{ item.previousQty }} &rarr; {{ item.newQty }}</span>
                    </td>
                    <td v-if="hasCostInfo" class="table-cell text-right">
                      <div v-if="item.costPerItem !== undefined" class="cost-info">
                        <span class="cost-per-item">{{ formatCurrency(item.costPerItem) }}/unit</span>
                        <span v-if="item.previousCost !== undefined && item.newCost !== undefined" class="cost-change">
                          {{ formatCurrency(item.previousCost) }} &rarr; {{ formatCurrency(item.newCost) }} avg
                        </span>
                      </div>
                      <span v-else class="empty-text">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Mobile Cards -->
          <div class="sm:hidden cards-container">
            <div v-for="item in currentOperation.items" :key="item.itemId" class="item-card">
              <div class="item-card-header">
                <NuxtLink :to="`/inventory/${item.itemId}`" class="item-link">
                  {{ item.itemName }}
                </NuxtLink>
                <span class="qty-badge">+{{ item.quantity }}</span>
              </div>
              <div class="item-card-content">
                <div class="item-card-field">
                  <span class="field-label">Stock Change</span>
                  <span class="stock-change">{{ item.previousQty }} &rarr; {{ item.newQty }}</span>
                </div>
                <div v-if="item.costPerItem !== undefined" class="item-card-field">
                  <span class="field-label">Cost Per Item</span>
                  <span class="field-value">{{ formatCurrency(item.costPerItem) }}</span>
                </div>
                <div v-if="item.previousCost !== undefined && item.newCost !== undefined" class="item-card-field">
                  <span class="field-label">Avg Cost Change</span>
                  <span class="cost-change">{{ formatCurrency(item.previousCost) }} &rarr; {{ formatCurrency(item.newCost) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Not Found -->
      <div v-else class="empty-state">
        <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-xl font-bold mb-2">Operation Not Found</h2>
        <p class="mb-4">The operation you're looking for doesn't exist or has been deleted.</p>
        <NuxtLink to="/operations" class="back-btn">Back to Operations</NuxtLink>
      </div>
    </div>

    <!-- Undo Confirmation Modal -->
    <UiModal
      v-model="showUndoModal"
      title="Undo Operation"
      variant="warning"
      size="md"
      :persistent="isUndoing"
    >
      <div class="undo-modal-content">
        <!-- Warning Icon -->
        <div class="warning-icon-container">
          <svg class="warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <p class="warning-text">
          Are you sure you want to undo this receiving operation? This will revert the following inventory changes:
        </p>

        <!-- Changes List -->
        <div v-if="currentOperation" class="changes-list">
          <div v-for="item in currentOperation.items" :key="item.itemId" class="change-item">
            <span class="change-item-name">{{ item.itemName }}</span>
            <span class="change-item-qty">-{{ item.quantity }} units</span>
          </div>
        </div>

        <!-- Cost Warning -->
        <p v-if="hasCostInfo" class="cost-warning">
          Cost per unit values will be recalculated based on remaining inventory.
        </p>

        <p class="confirmation-note">
          This action cannot be automatically undone.
        </p>
      </div>

      <template #footer>
        <div class="modal-actions">
          <button
            type="button"
            class="cancel-btn"
            :disabled="isUndoing"
            @click="showUndoModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="undo-confirm-btn"
            :disabled="isUndoing"
            @click="handleUndo"
          >
            <svg v-if="isUndoing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span v-else>Undo Operation</span>
          </button>
        </div>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { Operation } from '~/types/operation'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const authStore = useAuthStore()
const { currentOperation, isLoading, fetchOperation, undoOperation } = useOperations()
const { onOperationUndone, offOperationUndone } = useSocket()

// Undo modal state
const showUndoModal = ref(false)
const isUndoing = ref(false)

// Computed: can the current user undo this operation
const canUndo = computed(() => {
  return authStore.isOwner && currentOperation.value && !currentOperation.value.undoneAt
})

/**
 * Handles real-time operation:undone events from socket.
 * Updates the current operation if it matches the undone operation.
 */
function handleOperationUndone(operation: Operation) {
  if (currentOperation.value && currentOperation.value.id === operation.id) {
    // Update the current operation with the undone data
    currentOperation.value = operation
  }
}

// Fetch operation on mount and subscribe to socket events
onMounted(async () => {
  const id = route.params.id as string
  await fetchOperation(id)

  // Subscribe to real-time operation:undone events
  onOperationUndone(handleOperationUndone)
})

// Cleanup socket subscription on unmount
onUnmounted(() => {
  offOperationUndone(handleOperationUndone)
})

/**
 * Handles the undo operation action.
 */
async function handleUndo() {
  if (!currentOperation.value) return

  isUndoing.value = true
  const result = await undoOperation(currentOperation.value.id)

  if (result.success) {
    showUndoModal.value = false
  } else {
    // Show error - could use a toast notification here
    console.error('Failed to undo operation:', result.error)
    alert(result.error || 'Failed to undo operation')
  }

  isUndoing.value = false
}

/**
 * Generates a human-readable title based on operation type.
 */
const operationTitle = computed(() => {
  if (!currentOperation.value) return 'Operation'
  switch (currentOperation.value.type) {
    case 'RECEIVING':
      return 'Receiving Operation'
    default:
      return 'Operation'
  }
})

/**
 * Checks if any items have cost information.
 */
const hasCostInfo = computed(() => {
  if (!currentOperation.value) return false
  return currentOperation.value.items.some(item => item.costPerItem !== undefined)
})

/**
 * Formats a date string for display (date only).
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Formats a date string for display with time.
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formats a number as currency.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}
</script>

<style scoped>
.operation-page {
  @apply min-h-screen py-8 px-4;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-4xl mx-auto;
}

.page-header {
  @apply mb-6;
}

.back-link {
  @apply min-h-[44px] inline-flex items-center gap-2 px-2 -ml-2 text-sm font-medium transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

/* Header Content */
.header-content {
  @apply flex items-start gap-4 mb-6;
}

.header-icon {
  @apply flex items-center justify-center flex-shrink-0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-600)));
  color: white;
  box-shadow: 0 4px 12px rgba(var(--color-accent-500), 0.3);
}

@media (min-width: 768px) {
  .header-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }
}

.header-text {
  @apply flex flex-col gap-1;
}

.title-row {
  @apply flex flex-wrap items-center gap-3;
}

.page-title {
  @apply text-xl md:text-2xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Loading State */
.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

/* Details Card */
.details-card {
  @apply p-5 md:p-6 rounded-2xl mb-6;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 4px 20px rgba(var(--color-surface-900), 0.04);
}

.card-header {
  @apply flex items-center gap-3 mb-4 pb-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.card-header-icon {
  @apply flex items-center justify-center w-9 h-9 rounded-lg;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.card-header-text {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}

.details-list {
  @apply divide-y;
  border-color: rgba(var(--color-surface-200), 0.6);
}

.detail-row {
  @apply py-3 flex flex-col md:grid md:grid-cols-3 md:gap-4 gap-1;
}

.detail-row:first-child {
  @apply pt-0;
}

.detail-row:last-child {
  @apply pb-0;
}

.detail-label {
  @apply text-xs md:text-sm font-semibold;
  color: rgb(var(--color-surface-500));
}

.detail-value {
  @apply text-sm md:col-span-2;
  color: rgb(var(--color-surface-900));
}

.notes-value {
  @apply whitespace-pre-wrap;
}

/* Summary Card */
.summary-card {
  @apply flex items-center justify-center gap-8 p-5 rounded-2xl mb-6;
  background: rgba(var(--color-accent-500), 0.05);
  border: 1px solid rgba(var(--color-accent-500), 0.15);
}

.summary-item {
  @apply flex flex-col items-center text-center;
}

.summary-value {
  @apply text-2xl md:text-3xl font-bold;
  color: rgb(var(--color-accent-600));
}

.summary-label {
  @apply text-xs md:text-sm font-medium mt-1;
  color: rgb(var(--color-surface-500));
}

.summary-divider {
  @apply w-px h-12;
  background: rgba(var(--color-accent-500), 0.2);
}

/* Items Section */
.items-section {
  @apply rounded-2xl overflow-hidden;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.section-header {
  @apply px-5 py-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.section-title {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}

/* Desktop Table */
.items-table-container {
  @apply overflow-x-auto;
}

.items-table {
  @apply w-full;
  border-collapse: collapse;
}

.table-header {
  @apply px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider;
  background: rgba(var(--color-surface-200), 0.3);
  color: rgb(var(--color-surface-500));
}

.table-row {
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.6);
  transition: background-color 0.15s ease;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: rgba(var(--color-surface-200), 0.3);
}

.table-cell {
  @apply px-5 py-4 text-sm;
  color: rgb(var(--color-surface-700));
}

/* Quantity Badge */
.qty-badge {
  @apply px-2.5 py-1 text-sm font-bold rounded-lg inline-block;
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

/* Stock Change */
.stock-change {
  @apply font-medium;
  color: rgb(var(--color-surface-600));
}

/* Item Link */
.item-link {
  @apply font-medium transition-colors;
  color: rgb(var(--color-primary-600));
}

.item-link:hover {
  color: rgb(var(--color-primary-500));
  text-decoration: underline;
}

/* Cost Info */
.cost-info {
  @apply flex flex-col items-end gap-0.5;
}

.cost-per-item {
  @apply font-semibold text-sm;
  color: rgb(var(--color-surface-700));
}

.cost-change {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.empty-text {
  color: rgb(var(--color-surface-400));
}

/* Mobile Cards */
.cards-container {
  @apply p-4 space-y-3;
}

.item-card {
  @apply p-4 rounded-xl;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.item-card-header {
  @apply flex items-center justify-between gap-3 mb-3;
}

.item-card-content {
  @apply space-y-2;
}

.item-card-field {
  @apply flex justify-between items-center;
}

.field-label {
  @apply text-xs font-medium;
  color: rgb(var(--color-surface-400));
}

.field-value {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

/* Empty State */
.empty-state {
  @apply flex flex-col items-center justify-center py-20 text-center;
  color: rgb(var(--color-surface-500));
}

.back-btn {
  @apply px-4 py-2 rounded-lg font-medium;
  background: rgb(var(--color-primary-500));
  color: white;
}

.back-btn:hover {
  background: rgb(var(--color-primary-600));
}

/* Page Header with Undo Button */
.page-header {
  @apply flex items-center justify-between;
}

/* Undo Button */
.undo-button {
  @apply min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-700));
  border: 1px solid rgba(var(--color-warning-500), 0.3);
}

.undo-button:hover:not(:disabled) {
  background: rgba(var(--color-warning-500), 0.2);
  border-color: rgba(var(--color-warning-500), 0.5);
}

.undo-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Undone Badge */
.undone-badge {
  @apply px-2.5 py-1 text-xs font-semibold rounded-full;
  background: rgba(var(--color-surface-400), 0.15);
  color: rgb(var(--color-surface-500));
}

/* Undone Operation Styling */
.operation-undone .header-icon-undone {
  background: linear-gradient(135deg, rgb(var(--color-surface-400)), rgb(var(--color-surface-500)));
  box-shadow: 0 4px 12px rgba(var(--color-surface-400), 0.3);
}

.undone-detail .detail-label,
.undone-detail .detail-value {
  color: rgb(var(--color-surface-500));
}

/* Summary Card Undone State */
.summary-card-undone {
  background: rgba(var(--color-surface-200), 0.3);
  border-color: rgba(var(--color-surface-300), 0.5);
}

.summary-value-undone {
  color: rgb(var(--color-surface-500)) !important;
}

.summary-divider-undone {
  background: rgba(var(--color-surface-300), 0.5);
}

/* Undo Modal Styles */
.undo-modal-content {
  @apply space-y-4;
}

.warning-icon-container {
  @apply flex justify-center mb-2;
}

.warning-icon {
  @apply w-12 h-12;
  color: rgb(var(--color-warning-500));
}

.warning-text {
  @apply text-sm text-center;
  color: rgb(var(--color-surface-700));
}

.changes-list {
  @apply rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto;
  background: rgba(var(--color-surface-100), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.change-item {
  @apply flex justify-between items-center py-1.5 px-2 rounded;
}

.change-item:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.change-item-name {
  @apply text-sm font-medium truncate mr-3;
  color: rgb(var(--color-surface-700));
  max-width: 200px;
}

.change-item-qty {
  @apply text-sm font-semibold flex-shrink-0;
  color: rgb(var(--color-error-600));
}

.cost-warning {
  @apply text-xs text-center px-3 py-2 rounded-lg;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-700));
}

.confirmation-note {
  @apply text-xs text-center;
  color: rgb(var(--color-surface-500));
}

/* Modal Actions */
.modal-actions {
  @apply flex justify-end gap-3;
}

.cancel-btn {
  @apply min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.cancel-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.5);
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.undo-confirm-btn {
  @apply min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2;
  background: rgb(var(--color-warning-500));
  color: white;
}

.undo-confirm-btn:hover:not(:disabled) {
  background: rgb(var(--color-warning-600));
}

.undo-confirm-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
