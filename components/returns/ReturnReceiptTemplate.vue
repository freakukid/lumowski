<template>
  <div class="receipt-template receipt-return" ref="receiptRef">
    <!-- Prominent RETURN Banner - At the very top for immediate visibility -->
    <div class="receipt-return-banner">
      <div class="return-banner-text">REFUND RECEIPT</div>
      <div class="return-banner-subtext">Items Returned</div>
    </div>

    <!-- Header Section -->
    <div class="receipt-header">
      <!-- Business Name -->
      <div class="receipt-business-name">
        {{ businessName }}
      </div>

      <!-- Business Logo (crossorigin for CORS/canvas support) -->
      <img
        v-if="settings?.logoUrl"
        :src="settings.logoUrl"
        alt=""
        class="receipt-logo"
        crossorigin="anonymous"
      />

      <!-- Custom Header Text -->
      <div v-if="settings?.receiptHeader" class="receipt-header-text">
        {{ settings.receiptHeader }}
      </div>

      <!-- Transaction Meta (date/ref integrated into header) -->
      <div class="receipt-meta">
        <span>{{ formattedDate }}</span>
        <span class="receipt-meta-separator">|</span>
        <span>#{{ referenceNumber }}</span>
      </div>
    </div>

    <!-- Original Sale Reference -->
    <div v-if="originalSale" class="receipt-original-ref">
      <span class="original-ref-label">Original Sale:</span>
      <span class="original-ref-value">#{{ originalSaleReference }}</span>
    </div>

    <!-- Items Section -->
    <div class="receipt-items">
      <div class="receipt-items-header">
        <span>RETURNED ITEMS</span>
        <span>{{ receiptItems.length }}</span>
      </div>

      <div
        v-for="(item, index) in receiptItems"
        :key="index"
        class="receipt-item"
      >
        <div class="receipt-item-row">
          <span class="receipt-item-name">{{ item.name }}</span>
          <span class="receipt-item-total refund-amount">-{{ formatCurrency(item.refundAmount) }}</span>
        </div>
        <div class="receipt-item-details">
          {{ item.quantity }} x {{ formatCurrency(item.unitPrice) }}
          <span :class="['receipt-item-condition', item.condition]">
            ({{ formatCondition(item.condition) }})
          </span>
        </div>
      </div>
    </div>

    <!-- Summary Section (Totals + Refund Method) -->
    <div class="receipt-summary">
      <!-- Subtotal row -->
      <div class="receipt-row">
        <span class="receipt-row-label">Subtotal</span>
        <span class="receipt-row-dots" aria-hidden="true"></span>
        <span class="receipt-row-value">-{{ formatCurrency(subtotal) }}</span>
      </div>

      <!-- Discount row (if applicable) -->
      <div v-if="totalDiscount > 0" class="receipt-row receipt-row-discount">
        <span class="receipt-row-label">Discount</span>
        <span class="receipt-row-dots" aria-hidden="true"></span>
        <span class="receipt-row-value">{{ formatCurrency(totalDiscount) }}</span>
      </div>

      <!-- Tax row (if applicable) -->
      <div v-if="taxAmount > 0" class="receipt-row">
        <span class="receipt-row-label">{{ taxLabel }}</span>
        <span class="receipt-row-dots" aria-hidden="true"></span>
        <span class="receipt-row-value">-{{ formatCurrency(taxAmount) }}</span>
      </div>

      <!-- Total Refund -->
      <div class="receipt-grand-total receipt-refund-total">
        <span class="receipt-grand-total-label">TOTAL REFUND</span>
        <span class="receipt-grand-total-value">-{{ formatCurrency(grandTotal) }}</span>
      </div>

      <!-- Refund Method -->
      <div class="receipt-payment">
        <div class="receipt-payment-row">
          <span class="receipt-payment-method">Refunded via {{ formatRefundMethod }}</span>
        </div>
      </div>

      <!-- Return Reason -->
      <div v-if="operation?.returnReason" class="receipt-reason">
        <span class="reason-label">Reason:</span>
        <span class="reason-value">{{ operation.returnReason }}</span>
      </div>
    </div>

    <!-- Footer Section -->
    <div class="receipt-footer">
      <!-- Footer Text: Custom or Default -->
      <div class="receipt-footer-message">
        {{ settings?.receiptFooter || 'Thank you for your business!' }}
      </div>

      <!-- Reference as barcode-style text -->
      <div class="receipt-barcode">
        *{{ referenceNumber }}*
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Operation, ReturnOperationItem, RefundMethod, CardType, ReturnItemCondition } from '~/types/operation'
import type { BusinessSettings } from '~/types/business'

interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  refundAmount: number
  condition: ReturnItemCondition
}

interface Props {
  /** The completed return operation */
  operation: Operation | null
  /** Original sale operation */
  originalSale: Operation | null
  /** Business settings for receipt customization */
  settings: BusinessSettings | null
  /** Business name */
  businessName?: string
}

const props = withDefaults(defineProps<Props>(), {
  businessName: 'Business',
})

// Template ref for PDF generation
const receiptRef = ref<HTMLElement | null>(null)

// Expose the ref for parent component access
defineExpose({
  receiptRef,
})

// Use composables for formatting
const { formatCondition } = useReturnFormatting()
const { formatRefundMethod: formatRefundMethodBase } = usePaymentFormatting()
const { formatCurrency } = useCurrency()

/**
 * Computed formatted date string.
 */
const formattedDate = computed(() => {
  if (!props.operation?.date) return ''
  return new Date(props.operation.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

/**
 * Computed reference number for this return.
 */
const referenceNumber = computed(() => {
  if (props.operation?.reference) {
    return props.operation.reference
  }
  return 'RET-' + (props.operation?.id?.slice(0, 8).toUpperCase() || '')
})

/**
 * Computed reference number for the original sale.
 */
const originalSaleReference = computed(() => {
  if (props.originalSale?.reference) {
    return props.originalSale.reference
  }
  return props.originalSale?.id?.slice(0, 8).toUpperCase() || ''
})

/**
 * Computed receipt items from the return operation.
 */
const receiptItems = computed<ReceiptItem[]>(() => {
  if (!props.operation?.items) return []

  return (props.operation.items as ReturnOperationItem[]).map((item) => ({
    name: item.itemName,
    quantity: item.quantity,
    unitPrice: item.pricePerItem,
    refundAmount: item.refundAmount,
    condition: item.condition,
  }))
})

/**
 * Computed subtotal (sum of refund amounts before tax).
 * Uses stored value from operation if available, otherwise calculates from items.
 */
const subtotal = computed(() => {
  if (props.operation?.subtotal != null) {
    return props.operation.subtotal
  }
  // Fallback: calculate from items (pre-tax refund amounts)
  return receiptItems.value.reduce((sum, item) => sum + item.refundAmount, 0)
})

/**
 * Computed total discount amount.
 * For returns, discount is a credit back to the customer (shown as positive).
 */
const totalDiscount = computed(() => {
  return props.operation?.totalDiscount ?? 0
})

/**
 * Tax rate from operation.
 */
const taxRate = computed(() => props.operation?.taxRate ?? 0)

/**
 * Tax name from operation.
 */
const taxName = computed(() => props.operation?.taxName ?? 'Tax')

/**
 * Tax label with rate percentage.
 */
const taxLabel = computed(() => {
  if (taxRate.value > 0) {
    return `${taxName.value} (${taxRate.value}%)`
  }
  return taxName.value
})

/**
 * Computed tax amount.
 */
const taxAmount = computed(() => {
  return props.operation?.taxAmount ?? 0
})

/**
 * Computed grand total (total refund amount including tax).
 * Uses stored value from operation if available.
 */
const grandTotal = computed(() => {
  if (props.operation?.grandTotal != null) {
    return props.operation.grandTotal
  }
  // Fallback: subtotal + tax
  return subtotal.value + taxAmount.value
})

/**
 * Formats the refund method for display.
 * For ORIGINAL_METHOD, shows details from the original sale if available.
 */
const formatRefundMethod = computed(() => {
  const method = props.operation?.refundMethod as RefundMethod | null
  const cardType = props.operation?.cardType as CardType | null

  if (!method) return 'N/A'

  // Special handling for ORIGINAL_METHOD to show original payment details
  if (method === 'ORIGINAL_METHOD' && props.originalSale?.paymentMethod) {
    const origMethod = props.originalSale.paymentMethod
    if (origMethod === 'CARD' && props.originalSale.cardType) {
      return `Original (${props.originalSale.cardType})`
    }
    return `Original (${origMethod})`
  }

  // Use the consolidated formatting function for standard cases
  return formatRefundMethodBase(method, cardType)
})
</script>

<style scoped>
/* ==========================================================================
   RETURN RECEIPT TEMPLATE - Based on ReceiptTemplate with return-specific styles
   Visually distinct from regular sale receipts
   ========================================================================== */

.receipt-template {
  width: 80mm;
  max-width: 320px;
  padding: 0 12px 16px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  line-height: 1.5;
  background: white;
  color: #1a1a1a;
}

/* Return receipt gets a subtle border to distinguish it */
.receipt-template.receipt-return {
  border-left: 4px solid #b45309;
}

/* ==========================================================================
   RETURN BANNER - Prominent display at the very top
   ========================================================================== */

.receipt-return-banner {
  text-align: center;
  background: #292524;
  color: white;
  padding: 12px 8px;
  margin: 0 -12px 16px -12px;
}

.return-banner-text {
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 3px;
  text-transform: uppercase;
}

.return-banner-subtext {
  font-size: 10px;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-top: 4px;
  opacity: 0.8;
}

/* ==========================================================================
   HEADER - Centered business info
   ========================================================================== */

.receipt-header {
  text-align: center;
  margin-bottom: 20px;
}

.receipt-logo {
  max-width: 96px;
  max-height: 96px;
  margin: 0 auto 12px;
  display: block;
}

.receipt-business-name {
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  text-transform: uppercase;
}

.receipt-header-text {
  font-size: 10px;
  white-space: pre-wrap;
  color: #555;
  margin-bottom: 10px;
  line-height: 1.4;
}

.receipt-meta {
  font-size: 10px;
  color: #666;
  padding-top: 10px;
  border-top: 1px solid #ddd;
  margin-top: 4px;
}

.receipt-meta-separator {
  margin: 0 6px;
  color: #bbb;
}

/* ==========================================================================
   ORIGINAL SALE REFERENCE
   ========================================================================== */

.receipt-original-ref {
  text-align: center;
  font-size: 10px;
  color: #666;
  margin-bottom: 16px;
  padding: 6px;
  background: #f8f8f8;
}

.original-ref-label {
  margin-right: 4px;
}

.original-ref-value {
  font-weight: 600;
}

/* ==========================================================================
   ITEMS - Light background block for visual grouping
   ========================================================================== */

.receipt-items {
  margin-bottom: 20px;
  padding: 12px 10px;
  background: #fafafa;
}

.receipt-items-header {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #eee;
}

.receipt-item {
  margin-bottom: 10px;
  padding-bottom: 10px;
}

.receipt-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
}

.receipt-item:not(:last-child) {
  border-bottom: 1px dotted #e0e0e0;
}

.receipt-item-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.receipt-item-name {
  font-weight: 600;
  flex: 1;
  word-break: break-word;
  color: #222;
}

.receipt-item-total {
  font-weight: 600;
  white-space: nowrap;
  color: #222;
}

.receipt-item-total.refund-amount {
  color: #b45309;
}

.receipt-item-details {
  font-size: 10px;
  color: #666;
  margin-top: 3px;
}

/* Condition styling */
.receipt-item-condition {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 4px;
}

.receipt-item-condition.resellable {
  color: #16a34a;
}

.receipt-item-condition.damaged,
.receipt-item-condition.defective {
  color: #dc2626;
}

/* ==========================================================================
   SUMMARY - Totals with refund styling
   ========================================================================== */

.receipt-summary {
  margin-bottom: 24px;
  padding: 0 2px;
}

/* Row with dot leaders for alignment */
.receipt-row {
  display: flex;
  align-items: baseline;
  margin-bottom: 6px;
  font-size: 11px;
}

.receipt-row-label {
  color: #555;
  white-space: nowrap;
}

/*
 * Dot leader using actual characters for true baseline alignment.
 * The overflow:hidden + text-overflow approach ensures dots fill the space
 * and naturally sit on the text baseline.
 */
.receipt-row-dots {
  flex: 1;
  min-width: 20px;
  margin: 0 4px;
  overflow: hidden;
}

.receipt-row-dots::before {
  /*
   * Use middle dots (U+00B7) repeated - these are baseline-aligned characters.
   * We generate more dots than needed; overflow:hidden on parent clips them.
   */
  content: ' · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·';
  color: #ccc;
  letter-spacing: 0;
  white-space: nowrap;
}

.receipt-row-value {
  white-space: nowrap;
  color: #333;
}

.receipt-row-discount .receipt-row-value {
  color: #777;
}

/* Grand Total / Refund Total - Prominent display */
.receipt-grand-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 2px solid #222;
}

.receipt-grand-total-label {
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 1px;
  color: #111;
}

.receipt-grand-total-value {
  font-size: 16px;
  font-weight: bold;
  color: #111;
}

.receipt-refund-total .receipt-grand-total-value {
  color: #b45309;
}

/* Payment / Refund Method - Subtle, beneath total */
.receipt-payment {
  margin-top: 12px;
  padding-top: 10px;
}

.receipt-payment-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #666;
}

.receipt-payment-method {
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* Return Reason */
.receipt-reason {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #ddd;
  font-size: 10px;
}

.reason-label {
  color: #888;
  margin-right: 4px;
}

.reason-value {
  color: #555;
}

/* ==========================================================================
   FOOTER - Centered message and barcode
   ========================================================================== */

.receipt-footer {
  text-align: center;
  padding-top: 20px;
}

.receipt-footer-message {
  font-size: 11px;
  font-weight: 500;
  white-space: pre-wrap;
  color: #444;
  margin-bottom: 14px;
  line-height: 1.4;
}

.receipt-barcode {
  font-family: 'Libre Barcode 39', 'Courier New', monospace;
  font-size: 28px;
  letter-spacing: 2px;
  color: #000;
}

/* ==========================================================================
   PRINT STYLES
   ========================================================================== */

@media print {
  .receipt-template {
    width: 80mm;
    max-width: none;
    padding: 8px;
    margin: 0;
    box-shadow: none;
  }

  .receipt-template.receipt-return {
    border-left: 4px solid #b45309;
  }

  .receipt-return-banner,
  .receipt-items,
  .receipt-original-ref {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: 80mm auto;
    margin: 0;
  }
}
</style>
