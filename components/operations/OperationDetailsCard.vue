<template>
  <div class="details-card">
    <div class="card-header">
      <div :class="['card-header-icon', iconColorClass]">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <span class="card-header-text">Operation Details</span>
    </div>

    <dl class="details-list">
      <div class="detail-row">
        <dt class="detail-label">Date</dt>
        <dd class="detail-value">{{ formatDate(operation.date) }}</dd>
      </div>

      <div v-if="operation.reference" class="detail-row">
        <dt class="detail-label">Reference</dt>
        <dd class="detail-value">{{ operation.reference }}</dd>
      </div>

      <div v-if="operation.customer" class="detail-row">
        <dt class="detail-label">Customer</dt>
        <dd class="detail-value">{{ operation.customer }}</dd>
      </div>

      <div v-if="operation.notes" class="detail-row">
        <dt class="detail-label">Notes</dt>
        <dd class="detail-value notes-value">{{ operation.notes }}</dd>
      </div>

      <div class="detail-row">
        <dt class="detail-label">Created By</dt>
        <dd class="detail-value">{{ operation.user.name }}</dd>
      </div>

      <!-- Show Created At for RECEIVING operations -->
      <div v-if="operation.type === 'RECEIVING'" class="detail-row">
        <dt class="detail-label">Created At</dt>
        <dd class="detail-value">{{ formatDateTime(operation.createdAt) }}</dd>
      </div>

      <!-- Undone information -->
      <template v-if="operation.undoneAt">
        <div class="detail-row undone-detail">
          <dt class="detail-label">Undone At</dt>
          <dd class="detail-value">{{ formatDateTime(operation.undoneAt) }}</dd>
        </div>

        <div v-if="operation.undoneBy" class="detail-row undone-detail">
          <dt class="detail-label">Undone By</dt>
          <dd class="detail-value">{{ operation.undoneBy.name }}</dd>
        </div>
      </template>
    </dl>
  </div>
</template>

<script setup lang="ts">
import type { Operation } from '~/types/operation'

const props = defineProps<{
  operation: Operation
}>()

const { formatDate, formatDateTime } = useDate()

/**
 * Icon color class based on operation type.
 * SALE uses primary color, RECEIVING uses accent color.
 */
const iconColorClass = computed(() => {
  return props.operation.type === 'SALE'
    ? 'card-header-icon-primary'
    : 'card-header-icon-accent'
})
</script>

<style scoped>
.details-card {
  @apply p-5 md:p-6 rounded-2xl;
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
}

.card-header-icon-primary {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.card-header-icon-accent {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
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

.undone-detail .detail-label,
.undone-detail .detail-value {
  color: rgb(var(--color-surface-500));
}
</style>
