<template>
  <UiModal
    :model-value="modelValue"
    title="Held Sales"
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- Empty State -->
    <div v-if="sales.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg
          class="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <p class="empty-title">No Held Sales</p>
      <p class="empty-description">
        Sales you put on hold will appear here. Use the "Hold" button to park a sale for later.
      </p>
    </div>

    <!-- Sales List -->
    <ul
      v-else
      class="sales-list"
      role="list"
      aria-label="Held sales"
    >
      <li
        v-for="sale in sales"
        :key="sale.id"
        class="sale-item"
      >
        <!-- Sale Info -->
        <div class="sale-info">
          <div class="sale-header">
            <span class="sale-label">{{ sale.label }}</span>
            <span class="sale-time">{{ formatRelativeTime(sale.parkedAt) }}</span>
          </div>
          <div class="sale-details">
            <span class="sale-items">
              {{ sale.totalItems }} {{ sale.totalItems === 1 ? 'item' : 'items' }}
            </span>
            <span class="sale-separator" aria-hidden="true">-</span>
            <span class="sale-total">{{ formatCurrency(sale.grandTotal) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="sale-actions">
          <UiButton
            size="sm"
            variant="primary"
            :aria-label="`Retrieve ${sale.label}`"
            @click="handleRetrieve(sale.id)"
          >
            Retrieve
          </UiButton>
          <UiButton
            size="sm"
            variant="ghost"
            icon-only
            class="delete-btn w-11 h-11"
            :aria-label="`Delete ${sale.label}`"
            @click="handleDelete(sale.id)"
          >
            <template #icon-left>
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </template>
          </UiButton>
        </div>
      </li>
    </ul>

    <template #footer>
      <UiButton
        variant="secondary"
        @click="$emit('update:modelValue', false)"
      >
        Close
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import type { ParkedSale } from '~/types/parked-sale'

interface Props {
  /** Controls modal visibility (v-model) */
  modelValue: boolean
  /** Array of held/parked sales to display */
  sales: ParkedSale[]
}

defineProps<Props>()

const emit = defineEmits<{
  /** Emitted when modal visibility should change */
  'update:modelValue': [value: boolean]
  /** Emitted when user wants to retrieve a held sale */
  'retrieve': [saleId: string]
  /** Emitted when user wants to delete a held sale */
  'delete': [saleId: string]
}>()

/**
 * Formats a number as USD currency.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

/**
 * Formats an ISO date string as relative time (e.g., "5 min ago").
 * Shows minutes for recent times, hours for older, or date for very old.
 */
function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) {
    return 'Just now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`
  }

  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
  }

  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
  }

  // For older dates, show the actual date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Handles retrieve button click.
 * Emits the retrieve event and closes the modal.
 */
function handleRetrieve(saleId: string): void {
  emit('retrieve', saleId)
  emit('update:modelValue', false)
}

/**
 * Handles delete button click.
 * Emits the delete event (modal stays open to allow multiple deletions).
 */
function handleDelete(saleId: string): void {
  emit('delete', saleId)
}
</script>

<style scoped>
/* Empty State */
.empty-state {
  @apply flex flex-col items-center justify-center py-8 px-4 text-center;
}

.empty-icon {
  @apply flex items-center justify-center w-20 h-20 rounded-full mb-4;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-400));
}

.empty-title {
  @apply text-lg font-semibold mb-2;
  color: rgb(var(--color-surface-700));
}

.empty-description {
  @apply text-sm max-w-xs;
  color: rgb(var(--color-surface-500));
}

/* Sales List */
.sales-list {
  @apply flex flex-col gap-3;
}

.sale-item {
  @apply flex flex-col gap-3 p-4 rounded-xl;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

/* Desktop: horizontal layout */
@media (min-width: 640px) {
  .sale-item {
    @apply flex-row items-center justify-between gap-4;
  }
}

/* Sale Info */
.sale-info {
  @apply flex flex-col gap-1 flex-1 min-w-0;
}

.sale-header {
  @apply flex items-center gap-2;
}

.sale-label {
  @apply font-semibold;
  color: rgb(var(--color-surface-900));
}

.sale-time {
  @apply text-xs px-2 py-0.5 rounded-full;
  background: rgba(var(--color-surface-200), 0.6);
  color: rgb(var(--color-surface-500));
}

.sale-details {
  @apply flex items-center gap-2 text-sm;
}

.sale-items {
  color: rgb(var(--color-surface-600));
}

.sale-separator {
  color: rgb(var(--color-surface-300));
}

.sale-total {
  @apply font-semibold;
  color: rgb(var(--color-primary-600));
}

/* Actions */
.sale-actions {
  @apply flex items-center gap-2;
}

/* Mobile: full-width buttons */
@media (max-width: 639px) {
  .sale-actions {
    @apply w-full;
  }

  .sale-actions :deep(.btn) {
    @apply flex-1;
  }

  .sale-actions :deep(.delete-btn) {
    @apply flex-none;
  }
}

/* Delete button styling */
.delete-btn {
  color: rgb(var(--color-error-500));
}

.delete-btn:hover {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}
</style>
