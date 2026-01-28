<template>
  <div class="cart-panel">
    <!-- Cart Header -->
    <div class="cart-header">
      <h2 class="cart-title">
        CART
        <span class="cart-count">({{ items.length }} items)</span>
      </h2>
      <button
        v-if="items.length > 0"
        class="clear-btn"
        @click="emit('clear-cart')"
      >
        Clear
      </button>
    </div>

    <!-- Cart Items List -->
    <div class="cart-items-list" role="region" aria-label="Items in cart" aria-live="polite">
      <div v-if="items.length === 0" class="cart-empty">
        <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p>Your cart is empty</p>
      </div>

      <div
        v-for="item in items"
        :key="item.productId"
        class="cart-item"
      >
        <div class="cart-item-header">
          <span class="cart-item-name">{{ getProductName(item.productId) }}</span>
          <button
            class="cart-item-remove"
            :aria-label="'Remove ' + getProductName(item.productId) + ' from cart'"
            @click="emit('remove-item', item.productId)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="cart-item-row">
          <div class="qty-controls">
            <span class="qty-label">Qty:</span>
            <button
              class="qty-btn"
              :aria-label="'Decrease quantity for ' + getProductName(item.productId)"
              :disabled="item.quantity <= 1"
              @click="emit('update-quantity', item.productId, item.quantity - 1)"
            >-</button>
            <input
              type="number"
              :value="item.quantity"
              min="1"
              :max="getProduct(item.productId)?.stock || 999"
              :aria-label="'Quantity for ' + getProductName(item.productId)"
              class="qty-input"
              @change="emit('update-quantity', item.productId, parseInt(($event.target as HTMLInputElement).value) || 1)"
            />
            <button
              class="qty-btn"
              :aria-label="'Increase quantity for ' + getProductName(item.productId)"
              :disabled="item.quantity >= (getProduct(item.productId)?.stock || 999)"
              @click="emit('update-quantity', item.productId, item.quantity + 1)"
            >+</button>
          </div>
          <span class="cart-item-total">{{ formatCurrency(getLineTotal(item)) }}</span>
        </div>

        <div class="cart-item-discount">
          <span class="discount-label">Discount:</span>
          <input
            type="number"
            :value="item.discount || ''"
            min="0"
            :max="item.discountType === 'percent' ? 100 : undefined"
            step="0.01"
            placeholder="0"
            class="discount-input"
            @input="emit('update-discount', item.productId, ($event.target as HTMLInputElement).value ? parseFloat(($event.target as HTMLInputElement).value) : undefined)"
          />
          <button
            :class="['discount-type-btn', { active: item.discountType === 'percent' }]"
            :aria-label="'Toggle discount type: currently ' + (item.discountType === 'percent' ? 'percentage' : 'fixed amount')"
            :aria-pressed="item.discountType === 'percent'"
            @click="emit('update-discount-type', item.productId, item.discountType === 'percent' ? 'fixed' : 'percent')"
          >
            {{ item.discountType === 'percent' ? '%' : '$' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Sale Details Form -->
    <div class="sale-details">
      <h3 class="sale-details-title">SALE DETAILS</h3>

      <div class="form-group">
        <label class="form-label">Date</label>
        <input
          type="date"
          :value="formData.date"
          class="form-input"
          @input="updateFormField('date', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-group">
        <label class="form-label">Payment</label>
        <div class="payment-btns">
          <button
            :class="['payment-btn', { active: formData.paymentMethod === 'CASH' }]"
            @click="updateFormField('paymentMethod', 'CASH')"
          >Cash</button>
          <button
            :class="['payment-btn', { active: formData.paymentMethod === 'CARD' }]"
            @click="updateFormField('paymentMethod', 'CARD')"
          >Card</button>
          <button
            :class="['payment-btn', { active: formData.paymentMethod === 'OTHER' }]"
            @click="updateFormField('paymentMethod', 'OTHER')"
          >Other</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Customer</label>
        <input
          type="text"
          :value="formData.customer"
          placeholder="Optional"
          class="form-input"
          @input="updateFormField('customer', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="form-group">
        <label class="form-label">Receipt #</label>
        <input
          type="text"
          :value="formData.receipt"
          placeholder="Auto-generated"
          class="form-input"
          @input="updateFormField('receipt', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Summary -->
    <div class="cart-summary" role="region" aria-label="Cart summary">
      <h3 class="summary-title">SUMMARY</h3>
      <div class="summary-row">
        <span>Subtotal:</span>
        <span aria-label="Subtotal amount">{{ formatCurrency(subtotal) }}</span>
      </div>
      <div v-if="totalDiscount > 0" class="summary-row discount">
        <span>Discount:</span>
        <span aria-label="Discount amount">-{{ formatCurrency(totalDiscount) }}</span>
      </div>
      <div class="summary-row total">
        <span>TOTAL:</span>
        <span role="status" aria-label="Total amount">{{ formatCurrency(grandTotal) }}</span>
      </div>
    </div>

    <!-- Complete Sale Button -->
    <button
      class="complete-btn"
      :disabled="items.length === 0"
      @click="emit('submit')"
    >
      <span>COMPLETE SALE</span>
      <kbd v-if="!isMobile">F12</kbd>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * CartPanel Component
 *
 * Displays the shopping cart with line items, sale details form, and checkout summary.
 * Supports quantity adjustments, discounts, and various payment methods.
 */

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
  image?: string
}

interface CartItem {
  productId: string
  quantity: number
  discount?: number
  discountType: 'percent' | 'fixed'
}

interface FormData {
  date: string
  paymentMethod: 'CASH' | 'CARD' | 'OTHER'
  customer: string
  receipt: string
}

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  items: CartItem[]
  products: Product[]
  formData: FormData
  subtotal: number
  totalDiscount: number
  grandTotal: number
  isMobile?: boolean
}>()

const emit = defineEmits<{
  'update-quantity': [productId: string, quantity: number]
  'update-discount': [productId: string, discount: number | undefined]
  'update-discount-type': [productId: string, discountType: 'percent' | 'fixed']
  'remove-item': [productId: string]
  'clear-cart': []
  'update:form-data': [formData: FormData]
  'submit': []
}>()

// ============================================================================
// Methods
// ============================================================================

/**
 * Formats a number as USD currency.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

/**
 * Get a product by ID.
 */
function getProduct(productId: string): Product | undefined {
  return props.products.find(p => p.id === productId)
}

/**
 * Get a product's name by ID.
 */
function getProductName(productId: string): string {
  return getProduct(productId)?.name || 'Unknown'
}

/**
 * Calculate line total for a cart item (after discount).
 */
function getLineTotal(item: CartItem): number {
  const product = getProduct(item.productId)
  if (!product) return 0

  const gross = product.price * item.quantity
  if (!item.discount) return gross

  if (item.discountType === 'percent') {
    return gross * (1 - item.discount / 100)
  } else {
    return Math.max(0, gross - item.discount)
  }
}

/**
 * Update a form field and emit the updated form data.
 */
function updateFormField(field: keyof FormData, value: string): void {
  emit('update:form-data', { ...props.formData, [field]: value })
}
</script>

<style scoped>
/* ============================================================================
   Cart Panel
   ============================================================================ */

.cart-panel {
  @apply h-full flex flex-col p-4 overflow-y-auto;
}

.cart-header {
  @apply flex items-center justify-between mb-4;
}

.cart-title {
  @apply text-sm font-bold uppercase tracking-wide;
  color: rgb(var(--color-surface-700));
}

.cart-count {
  @apply font-normal;
  color: rgb(var(--color-surface-500));
}

.clear-btn {
  @apply px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors;
  color: rgb(var(--color-error-600));
  background: rgba(var(--color-error-500), 0.1);
}

.clear-btn:hover {
  background: rgba(var(--color-error-500), 0.2);
}

/* Cart Items List */
.cart-items-list {
  @apply flex-1 overflow-y-auto space-y-2 mb-4;
  max-height: 280px;
}

.cart-empty {
  @apply py-8 text-center text-sm;
  color: rgb(var(--color-surface-400));
}

.cart-item {
  @apply p-3 rounded-xl;
  background: rgba(var(--color-surface-100), 0.7);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.cart-item-header {
  @apply flex items-center justify-between mb-2;
}

.cart-item-name {
  @apply text-sm font-semibold truncate flex-1 pr-2;
  color: rgb(var(--color-surface-900));
}

.cart-item-remove {
  @apply p-1.5 rounded-lg transition-colors;
  color: rgb(var(--color-surface-400));
}

.cart-item-remove:hover {
  color: rgb(var(--color-error-500));
  background: rgba(var(--color-error-500), 0.1);
}

.cart-item-row {
  @apply flex items-center justify-between gap-2 mb-2;
}

.qty-controls {
  @apply flex items-center gap-1;
}

.qty-label {
  @apply text-xs mr-1;
  color: rgb(var(--color-surface-500));
}

.qty-btn {
  @apply flex items-center justify-center rounded text-sm font-bold transition-colors;
  min-width: 32px;
  min-height: 32px;
  width: 32px;
  height: 32px;
  background: rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-600));
}

.qty-btn:hover:not(:disabled) {
  background: rgba(var(--color-surface-300), 0.8);
}

.qty-btn:disabled {
  @apply opacity-40 cursor-not-allowed;
}

.qty-input {
  @apply w-12 h-7 text-center text-sm font-semibold rounded;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.cart-item-total {
  @apply text-sm font-bold;
  color: rgb(var(--color-accent-500));
}

.cart-item-discount {
  @apply flex items-center gap-2;
}

.discount-label {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.discount-input {
  @apply w-16 h-7 text-center text-xs rounded;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.discount-type-btn {
  @apply text-xs font-bold rounded transition-colors;
  min-width: 32px;
  min-height: 32px;
  width: 32px;
  height: 32px;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-600));
}

.discount-type-btn.active {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

/* Sale Details */
.sale-details {
  @apply mb-4 p-3 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.sale-details-title {
  @apply text-xs font-bold uppercase tracking-wide mb-3;
  color: rgb(var(--color-surface-500));
}

.form-group {
  @apply mb-3;
}

.form-group:last-child {
  @apply mb-0;
}

.form-label {
  @apply block text-xs font-medium mb-1;
  color: rgb(var(--color-surface-600));
}

.form-input {
  @apply w-full px-3 py-2 text-sm rounded-lg;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.form-input:focus {
  @apply outline-none;
  border-color: rgb(var(--color-primary-500));
  box-shadow: var(--focus-ring-sm);
}

.payment-btns {
  @apply flex gap-1;
}

.payment-btn {
  @apply flex-1 py-2 text-xs font-semibold rounded-lg transition-all;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-600));
}

.payment-btn:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.payment-btn.active {
  background: rgba(var(--color-primary-500), 0.08);
  border-color: rgb(var(--color-primary-500));
  color: rgb(var(--color-primary-600));
}

/* Cart Summary */
.cart-summary {
  @apply mb-4 p-3 rounded-xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.summary-title {
  @apply text-xs font-bold uppercase tracking-wide mb-2;
  color: rgb(var(--color-surface-500));
}

.summary-row {
  @apply flex justify-between text-sm py-1;
  color: rgb(var(--color-surface-600));
}

.summary-row.discount span:last-child {
  color: rgb(var(--color-accent-500));
}

.summary-row.total {
  @apply pt-2 mt-2 font-bold;
  border-top: 1px solid rgba(var(--color-surface-300), 0.6);
  color: rgb(var(--color-surface-900));
}

.summary-row.total span:last-child {
  @apply text-lg;
  color: rgb(var(--color-primary-600));
}

/* Complete Button */
.complete-btn {
  @apply w-full flex items-center justify-center gap-3 py-4 rounded-xl text-white font-bold text-base transition-all;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.complete-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

.complete-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
  transform: none;
}

.complete-btn kbd {
  @apply px-2 py-0.5 text-xs font-mono rounded opacity-70;
  background: rgba(255, 255, 255, 0.2);
}

/* ============================================================================
   Number Input Spinner Removal
   ============================================================================ */

input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>
