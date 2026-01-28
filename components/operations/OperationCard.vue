<template>
  <NuxtLink
    :to="`/operations/${operation.id}`"
    :class="[
      'operation-card',
      `operation-card-${operation.type.toLowerCase()}`,
      { 'operation-card-undone': operation.undoneAt }
    ]"
  >
    <!-- Header: Type Badge + Date -->
    <div class="card-header">
      <div class="card-header-left">
        <OperationsTypeBadge :type="operation.type" />
        <span v-if="operation.undoneAt" class="undone-badge">Undone</span>
      </div>
      <span class="card-date">{{ formatDateShort(operation.date) }}</span>
    </div>

    <!-- Key Metric -->
    <div class="card-key-metric">
      <div class="metric-row">
        <span :class="['metric-value', { 'metric-undone': operation.undoneAt }]">
          <template v-if="operation.undoneAt">
            <s>{{ keyMetricValue }}</s>
          </template>
          <template v-else>
            {{ keyMetricValue }}
          </template>
        </span>
        <span class="metric-items">{{ operation.items.length }} {{ operation.items.length === 1 ? 'item' : 'items' }}</span>
      </div>
      <span class="metric-label">{{ keyMetricLabel }}</span>
    </div>

    <!-- Items Preview -->
    <div class="card-items-preview">
      <div
        v-for="item in visibleItems"
        :key="item.itemId"
        class="preview-item"
      >
        <span class="item-name">{{ item.itemName }}</span>
        <span class="item-qty">x{{ item.quantity }}</span>
        <span v-if="isSaleItem(item)" class="item-total">{{ formatCurrency(item.lineTotal) }}</span>
        <span v-else-if="isReturnItem(item)" class="item-total item-refund">-{{ formatCurrency(item.refundAmount) }}</span>
      </div>
      <button
        v-if="hiddenItemsCount > 0"
        class="more-items-btn"
        @click.prevent="toggleExpanded"
      >
        {{ isExpanded ? 'Show less' : `+${hiddenItemsCount} more items` }}
      </button>
    </div>

    <!-- Secondary Info -->
    <div v-if="hasSecondaryInfo" class="card-secondary-info">
      <!-- Customer (SALE) -->
      <div v-if="operation.type === 'SALE' && operation.customer" class="info-row">
        <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span class="info-text">{{ operation.customer }} <span class="info-label">(customer)</span></span>
      </div>

      <!-- Payment Method (SALE) -->
      <div v-if="operation.type === 'SALE' && paymentDisplay" class="info-row">
        <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span class="info-text">{{ paymentDisplay }}</span>
      </div>

      <!-- Supplier (RECEIVING) -->
      <div v-if="operation.type === 'RECEIVING' && operation.supplier" class="info-row">
        <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <span class="info-text">{{ operation.supplier }} <span class="info-label">(supplier)</span></span>
      </div>

      <!-- Total Cost (RECEIVING with cost data) -->
      <div v-if="operation.type === 'RECEIVING' && totalReceivingCost > 0" class="info-row">
        <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="info-text">{{ formatCurrency(totalReceivingCost) }} <span class="info-label">(total cost)</span></span>
      </div>

      <!-- Original Sale Reference (RETURN) -->
      <div v-if="operation.type === 'RETURN' && operation.originalSaleId" class="info-row">
        <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="info-text">Return for sale <span class="info-label">#{{ operation.originalSaleId.slice(0, 8).toUpperCase() }}</span></span>
      </div>

      <!-- Return Reason (RETURN) -->
      <div v-if="operation.type === 'RETURN' && operation.returnReason" class="info-row">
        <svg class="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="info-text">{{ operation.returnReason }}</span>
      </div>
    </div>

    <!-- Footer: User + Reference -->
    <div class="card-footer">
      <span class="footer-user">by {{ operation.user.name }}</span>
      <span v-if="operation.reference" class="footer-reference">{{ operation.reference }}</span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Operation, OperationItem, SaleOperationItem, ReturnOperationItem } from '~/types/operation'

const props = defineProps<{
  operation: Operation
}>()

const { formatCurrency } = useCurrency()
const { formatDateShort } = useDate()
const { formatPaymentMethod } = usePaymentFormatting()

/** Number of items to show by default in collapsed state */
const PREVIEW_ITEM_COUNT = 2

/** Track whether items list is expanded */
const isExpanded = ref(false)

/**
 * Determines if an item is a sale item (has lineTotal)
 */
function isSaleItem(item: OperationItem | SaleOperationItem): item is SaleOperationItem {
  return 'lineTotal' in item
}

/**
 * Determines if an item is a return item (has refundAmount)
 */
function isReturnItem(item: OperationItem | SaleOperationItem | ReturnOperationItem): item is ReturnOperationItem {
  return 'refundAmount' in item
}

/**
 * Items to display in the preview section
 */
const visibleItems = computed(() => {
  if (isExpanded.value) {
    return props.operation.items
  }
  return props.operation.items.slice(0, PREVIEW_ITEM_COUNT)
})

/**
 * Count of hidden items when collapsed
 */
const hiddenItemsCount = computed(() => {
  return Math.max(0, props.operation.items.length - PREVIEW_ITEM_COUNT)
})

/**
 * Toggle the expanded state
 */
function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
}

/**
 * Key metric value based on operation type
 * SALE: Grand Total as currency (includes tax)
 * RETURN: Grand Total refund as negative currency (includes tax)
 * RECEIVING: +N Total Qty
 */
const keyMetricValue = computed(() => {
  if (props.operation.type === 'SALE' && props.operation.grandTotal != null) {
    return formatCurrency(props.operation.grandTotal)
  }
  if (props.operation.type === 'RETURN') {
    // Use grandTotal which includes tax, with fallback to calculated subtotal
    if (props.operation.grandTotal != null) {
      return `-${formatCurrency(props.operation.grandTotal)}`
    }
    // Fallback: Calculate total refund from return items (pre-tax subtotal)
    const totalRefund = (props.operation.items as ReturnOperationItem[]).reduce(
      (sum, item) => sum + (item.refundAmount || 0),
      0
    )
    return `-${formatCurrency(totalRefund)}`
  }
  // For RECEIVING or SALE without grandTotal
  return `+${props.operation.totalQty}`
})

/**
 * Key metric label based on operation type
 */
const keyMetricLabel = computed(() => {
  if (props.operation.type === 'SALE' && props.operation.grandTotal != null) {
    return 'Grand Total'
  }
  if (props.operation.type === 'RETURN') {
    return 'Total Refund'
  }
  return 'Total Quantity'
})

/**
 * Calculate total cost for receiving operations
 */
const totalReceivingCost = computed(() => {
  if (props.operation.type !== 'RECEIVING') return 0
  return props.operation.items.reduce((sum, item) => {
    const cost = item.costPerItem ?? 0
    return sum + (cost * item.quantity)
  }, 0)
})

/**
 * Payment display string for sale operations
 */
const paymentDisplay = computed(() => {
  if (props.operation.type !== 'SALE') return null

  // Check for split payments first
  if (props.operation.payments && props.operation.payments.length > 0) {
    if (props.operation.payments.length === 1) {
      const payment = props.operation.payments[0]
      return formatPaymentMethod(payment.method, payment.cardType)
    }
    return `Split (${props.operation.payments.length} payments)`
  }

  // Single payment method
  if (props.operation.paymentMethod) {
    return formatPaymentMethod(props.operation.paymentMethod, props.operation.cardType)
  }

  return null
})

/**
 * Whether to show the secondary info section
 */
const hasSecondaryInfo = computed(() => {
  if (props.operation.type === 'SALE') {
    return !!props.operation.customer || !!paymentDisplay.value
  }
  if (props.operation.type === 'RECEIVING') {
    return !!props.operation.supplier || totalReceivingCost.value > 0
  }
  if (props.operation.type === 'RETURN') {
    return !!props.operation.originalSaleId || !!props.operation.returnReason
  }
  return false
})
</script>

<style scoped>
/* Card Base */
.operation-card {
  display: block;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  border-left-width: 3px;
  background: rgba(var(--color-surface-100), 0.7);
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s, box-shadow 0.2s;
}

.operation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(var(--color-surface-900), 0.08);
}

/* Type-specific accents */
.operation-card-sale {
  border-left-color: rgb(var(--color-primary-500));
}

.operation-card-receiving {
  border-left-color: rgb(var(--color-accent-500));
}

.operation-card-return {
  border-left-color: rgb(var(--color-warning-500));
}

/* Undone state */
.operation-card-undone {
  opacity: 0.65;
  border-style: dashed;
}

.operation-card-undone:hover {
  opacity: 0.8;
}

/* Header */
.card-header {
  @apply flex items-center justify-between gap-2 mb-3;
}

.card-header-left {
  @apply flex items-center gap-2;
}

.card-date {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.undone-badge {
  @apply px-2 py-0.5 text-xs font-semibold rounded-full;
  background: rgba(var(--color-surface-400), 0.15);
  color: rgb(var(--color-surface-500));
}

/* Key Metric */
.card-key-metric {
  @apply mb-3 pb-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.6);
}

.metric-row {
  @apply flex items-baseline justify-between gap-2;
}

.metric-value {
  @apply text-2xl font-bold;
  color: rgb(var(--color-surface-900));
}

.metric-undone {
  color: rgb(var(--color-surface-500));
}

.metric-items {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

.metric-label {
  @apply text-xs;
  color: rgb(var(--color-surface-400));
}

/* Items Preview */
.card-items-preview {
  @apply mb-3 pb-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.6);
}

.preview-item {
  @apply flex items-center gap-2 py-1.5;
}

.item-name {
  @apply flex-1 text-sm truncate;
  color: rgb(var(--color-surface-700));
}

.item-qty {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-500));
}

.item-total {
  @apply text-sm font-semibold min-w-[70px] text-right;
  color: rgb(var(--color-surface-700));
}

.item-total.item-refund {
  color: rgb(var(--color-warning-600));
}

.more-items-btn {
  @apply mt-1 text-xs font-medium;
  color: rgb(var(--color-primary-500));
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.more-items-btn:hover {
  color: rgb(var(--color-primary-600));
  text-decoration: underline;
}

/* Secondary Info */
.card-secondary-info {
  @apply mb-3 space-y-1.5;
}

.info-row {
  @apply flex items-center gap-2;
}

.info-icon {
  @apply w-4 h-4 flex-shrink-0;
  color: rgb(var(--color-surface-400));
}

.info-text {
  @apply text-sm truncate;
  color: rgb(var(--color-surface-600));
}

.info-label {
  @apply text-xs;
  color: rgb(var(--color-surface-400));
}

/* Footer */
.card-footer {
  @apply flex items-center justify-between gap-2 pt-2;
  border-top: 1px solid rgba(var(--color-surface-200), 0.4);
}

.footer-user {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.footer-reference {
  @apply text-xs font-mono;
  color: rgb(var(--color-surface-400));
}
</style>
