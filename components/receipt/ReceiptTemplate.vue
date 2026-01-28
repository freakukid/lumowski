<template>
  <div class="receipt-template" ref="receiptRef">
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

    <!-- Customer (only if present, shown separately) -->
    <div v-if="operation?.customer" class="receipt-customer">
      <span class="receipt-customer-label">Customer</span>
      <span class="receipt-customer-value">{{ operation.customer }}</span>
    </div>

    <!-- Items Section -->
    <div class="receipt-items">
      <div class="receipt-items-header">
        <span>ITEMS</span>
        <span>{{ receiptItems.length }}</span>
      </div>

      <div
        v-for="(item, index) in receiptItems"
        :key="index"
        class="receipt-item"
      >
        <div class="receipt-item-row">
          <span class="receipt-item-name">{{ item.name }}</span>
          <span class="receipt-item-total">{{ formatCurrency(item.total) }}</span>
        </div>
        <div class="receipt-item-details">
          {{ item.quantity }} x {{ formatCurrency(item.unitPrice) }}
          <span v-if="item.discount && item.discount > 0" class="receipt-item-discount">
            ({{ formatDiscount(item.discount, item.discountType) }})
          </span>
        </div>
      </div>
    </div>

    <!-- Summary Section (Totals + Payment combined) -->
    <div class="receipt-summary">
      <!-- Subtotal row -->
      <div class="receipt-row">
        <span class="receipt-row-label">Subtotal</span>
        <span class="receipt-row-dots" aria-hidden="true"></span>
        <span class="receipt-row-value">{{ formatCurrency(subtotal) }}</span>
      </div>

      <!-- Discount row (if applicable) -->
      <div v-if="totalDiscount > 0" class="receipt-row receipt-row-discount">
        <span class="receipt-row-label">Discount</span>
        <span class="receipt-row-dots" aria-hidden="true"></span>
        <span class="receipt-row-value">-{{ formatCurrency(totalDiscount) }}</span>
      </div>

      <!-- Tax row (if applicable) -->
      <div v-if="taxAmount > 0" class="receipt-row">
        <span class="receipt-row-label">{{ taxLabel }}</span>
        <span class="receipt-row-dots" aria-hidden="true"></span>
        <span class="receipt-row-value">{{ formatCurrency(taxAmount) }}</span>
      </div>

      <!-- Grand Total -->
      <div class="receipt-grand-total">
        <span class="receipt-grand-total-label">TOTAL</span>
        <span class="receipt-grand-total-value">{{ formatCurrency(grandTotal) }}</span>
      </div>

      <!-- Payment Method(s) -->
      <div class="receipt-payment">
        <template v-if="hasMultiplePayments">
          <div
            v-for="(payment, index) in payments"
            :key="index"
            class="receipt-payment-row"
          >
            <span class="receipt-payment-method">{{ formatPaymentMethod(payment.method, payment.cardType) }}</span>
            <span class="receipt-payment-amount">{{ formatCurrency(payment.amount) }}</span>
          </div>
        </template>
        <template v-else>
          <div class="receipt-payment-row">
            <span class="receipt-payment-method">Paid via {{ formatPaymentMethod(operation?.paymentMethod, operation?.cardType) }}</span>
          </div>
        </template>
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
import type { Operation, SaleOperationItem, StoredPaymentEntry, PaymentMethod, CardType } from '~/types/operation'
import type { BusinessSettings } from '~/types/business'
import type { ReceiptItem } from '~/types/receipt'

interface Props {
  /** The completed sale operation */
  operation: Operation | null
  /** Business settings for tax and receipt customization */
  settings: BusinessSettings | null
  /** Business name (fallback if not available from operation) */
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
 * Formats a discount value for display.
 */
function formatDiscount(discount: number, discountType?: 'percent' | 'fixed'): string {
  if (discountType === 'percent') {
    return `-${discount}%`
  }
  return `-${formatCurrency(discount)}`
}

/**
 * Formats a payment method for display.
 */
function formatPaymentMethod(method?: PaymentMethod | string | null, cardType?: CardType | string | null): string {
  if (!method) return 'N/A'

  switch (method) {
    case 'CASH':
      return 'Cash'
    case 'CARD':
      return cardType ? `Card (${cardType})` : 'Card'
    case 'CHECK':
      return 'Check'
    case 'OTHER':
      return 'Other'
    default:
      return method
  }
}

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
 * Computed reference number (short ID or custom reference).
 */
const referenceNumber = computed(() => {
  if (props.operation?.reference) {
    return props.operation.reference
  }
  return props.operation?.id?.slice(0, 8).toUpperCase() || ''
})

/**
 * Computed receipt items with calculated totals.
 */
const receiptItems = computed<ReceiptItem[]>(() => {
  if (!props.operation?.items) return []

  return (props.operation.items as SaleOperationItem[]).map((item) => ({
    name: item.itemName,
    quantity: item.quantity,
    unitPrice: item.pricePerItem,
    discount: item.discount,
    discountType: item.discountType,
    total: item.lineTotal,
  }))
})

/**
 * Computed subtotal (sum of line totals before tax).
 */
const subtotal = computed(() => {
  return receiptItems.value.reduce((sum, item) => sum + item.total, 0)
})

/**
 * Computed total discount amount.
 */
const totalDiscount = computed(() => {
  return receiptItems.value.reduce((sum, item) => {
    if (!item.discount || item.discount <= 0) return sum

    const grossTotal = item.quantity * item.unitPrice
    const discountAmount = grossTotal - item.total
    return sum + discountAmount
  }, 0)
})

/**
 * Tax rate from settings.
 */
const taxRate = computed(() => props.settings?.taxRate ?? 0)

/**
 * Tax name from settings.
 */
const taxName = computed(() => props.settings?.taxName ?? 'Tax')

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
  return subtotal.value * (taxRate.value / 100)
})

/**
 * Computed grand total including tax.
 */
const grandTotal = computed(() => {
  return subtotal.value + taxAmount.value
})

/**
 * Check if operation has multiple payments.
 */
const hasMultiplePayments = computed(() => {
  return props.operation?.payments && props.operation.payments.length > 0
})

/**
 * Payments array for split payments.
 */
const payments = computed<StoredPaymentEntry[]>(() => {
  return props.operation?.payments || []
})
</script>

<style scoped>
/* ==========================================================================
   RECEIPT TEMPLATE - Clean, Minimal Design
   Uses whitespace, typography, and subtle backgrounds instead of lines
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

/* ==========================================================================
   HEADER - Centered business info with integrated meta
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
  margin-bottom: 24px;
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
   CUSTOMER - Optional, subtle display
   ========================================================================== */

.receipt-customer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 8px 10px;
  background: #f8f8f8;
  font-size: 11px;
}

.receipt-customer-label {
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.5px;
  color: #888;
}

.receipt-customer-value {
  font-weight: 600;
  color: #333;
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

/* Subtle separator between items (not a full line) */
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

.receipt-item-details {
  font-size: 10px;
  color: #666;
  margin-top: 3px;
}

.receipt-item-discount {
  color: #888;
  font-style: italic;
  margin-left: 4px;
}

/* ==========================================================================
   SUMMARY - Totals with dot leaders + payment
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
  /* Dots character will be inserted via ::before */
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

/* Grand Total - Prominent display */
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

/* Payment - Subtle, beneath total */
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

.receipt-payment-amount {
  font-weight: 500;
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

  /* Ensure backgrounds print */
  .receipt-items,
  .receipt-customer {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: 80mm auto;
    margin: 0;
  }
}
</style>
