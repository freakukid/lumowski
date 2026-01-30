<template>
  <div class="cashier-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <NuxtLink to="/operations" class="back-link">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          <span>Back to Operations</span>
        </NuxtLink>

        <div class="header-content">
          <!-- Header Icon -->
          <div class="header-icon">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>

          <div class="header-text">
            <h1 class="page-title">Cashier</h1>
            <p class="page-subtitle">Process a new sale</p>
          </div>

          <!-- Header Actions -->
          <div class="header-actions">
            <!-- Held Sales Badge -->
            <ClientOnly>
              <CashierHeldSalesBadge
                :count="parkedSalesCount"
                @click="showHeldSalesModal = true"
              />
            </ClientOnly>

            <!-- Settings shortcut - shown to all roles -->
            <ClientOnly>
              <button
                type="button"
                class="settings-shortcut-btn"
                :class="{ 'settings-shortcut-btn--disabled': !isOwner }"
                :aria-label="isOwner ? 'Business Settings' : 'Settings (Owner only)'"
                :title="isOwner ? 'Business Settings' : 'Settings (Owner only)'"
                @click="handleSettingsClick"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Loading Schema -->
      <div v-if="isSchemaLoading" class="loading-state">
        <UiSpinner size="lg" />
        <p>Loading...</p>
      </div>

      <template v-else>
        <!-- Setup Reminder: Quantity Column -->
        <CashierSetupReminder
          v-if="showQuantityReminder"
          title="Quantity column required."
          message="To use the cashier, add a column with the &quot;Quantity&quot; role in your schema settings."
        />

        <!-- Setup Reminder: Price Column -->
        <CashierSetupReminder
          v-else-if="showPriceReminder"
          title="Price column required."
          message="To use the cashier, add a column with the &quot;Price&quot; role in your schema settings."
        />

        <!-- Form Content -->
        <div :class="['form-content-wrapper', { disabled: showQuantityReminder || showPriceReminder }]">
          <!-- Error Message -->
          <div v-if="errorMessage" class="error-message">
            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{{ errorMessage }}</span>
          </div>

            <!-- Top Row: Select Items + Selected Items (two columns on desktop) -->
          <div class="top-row-layout">
            <!-- Left Column: Item Selector -->
            <div class="form-section">
              <div class="section-header">
                <div class="section-icon">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <span class="section-title">Select Items</span>
              </div>

              <CashierItemSelector
                v-model="selectedItemIds"
                ref="itemSelectorRef"
                :columns="columns"
                :barcode-enabled="!!barcodeColumn"
                :is-barcode-loading="isBarcodeLoading"
                :barcode-error="barcodeError"
                @barcode-submit="handleBarcodeSubmit"
                @camera-click="showBarcodeScanner = true"
                @clear-barcode-error="handleClearBarcodeError"
              />
            </div>

            <!-- Right Column: Selected Items -->
            <div class="form-section selected-items-column">
              <div class="section-header">
                <div class="section-icon sale-icon">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <span class="section-title">Selected Items</span>
                <span v-if="selectedItems.length > 0" class="section-count">{{ selectedItems.length }} items</span>
              </div>

              <!-- Empty State -->
              <div v-if="selectedItems.length === 0" class="empty-cart-state">
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p>No items selected</p>
                <p class="empty-cart-hint">Select items from the left to add them to this sale</p>
              </div>

              <!-- Item Cards -->
              <div v-else class="selected-items-list">
                <CashierSaleItemCard
                  v-for="item in selectedItems"
                  :key="item.id"
                  :item="item"
                  :quantity="itemQuantities[item.id] || 1"
                  :columns="columns"
                  :discount="itemDiscounts[item.id]"
                  :discount-type="itemDiscountTypes[item.id] || 'percent'"
                  @update:quantity="updateItemQuantity(item.id, $event)"
                  @update:discount="updateItemDiscount(item.id, $event)"
                  @update:discount-type="updateItemDiscountType(item.id, $event)"
                  @remove="removeItem(item.id)"
                />
              </div>
            </div>
          </div>

          <!-- Sale Details Section (full width) -->
          <div class="sale-details-section">
            <div class="section-header">
              <div class="section-icon">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <span class="section-title">Sale Details</span>
            </div>

            <div class="sale-details-form">
              <!-- Date -->
              <div class="form-group sale-details-date">
                <label for="sale-date" class="form-label">
                  Date <span class="required">*</span>
                </label>
                <UiDatePicker
                  id="sale-date"
                  v-model="formData.date"
                  placeholder="Select date"
                  :required="true"
                  :clearable="false"
                />
              </div>

              <!-- Notes -->
              <div class="form-group sale-details-notes">
                <label for="notes" class="form-label">Notes</label>
                <textarea
                  id="notes"
                  v-model="formData.notes"
                  rows="2"
                  placeholder="Additional notes..."
                  class="input textarea"
                ></textarea>
              </div>

              <!-- Payment Method -->
              <div class="form-group sale-details-payment">
                <label class="form-label">
                  Payment Method <span class="required">*</span>
                </label>
                <CashierSplitPaymentContainer
                  v-model="paymentMode"
                  :grand-total="grandTotal"
                  :single-payment="singlePayment"
                  :payments="splitPayments"
                  :show-card-type-error="showCardTypeError"
                  @update:single-payment="updateSinglePayment"
                  @update:payments="updateSplitPayments"
                />
              </div>
            </div>
          </div>

          <!-- Summary and Submit -->
          <div class="summary-section">
            <div class="summary-main">
              <div class="summary-details">
                <div class="summary-row">
                  <span class="summary-label">Items</span>
                  <span class="summary-value">{{ selectedItems.length }}</span>
                </div>
                <div class="summary-row">
                  <span class="summary-label">Subtotal</span>
                  <span class="summary-value">{{ formatCurrency(subtotal) }}</span>
                </div>
                <div v-if="totalDiscount > 0" class="summary-row discount-row">
                  <span class="summary-label">Discount</span>
                  <span class="summary-value discount">-{{ formatCurrency(totalDiscount) }}</span>
                </div>
                <!-- Tax Row - shown when tax rate > 0 -->
                <div v-if="taxRate > 0" class="summary-row">
                  <span class="summary-label">{{ taxDisplayLabel }}</span>
                  <span class="summary-value" style="color: rgb(var(--color-surface-700))">{{ formatCurrency(taxAmount) }}</span>
                </div>
                <div class="summary-row total-row">
                  <span class="summary-label">Total</span>
                  <span class="summary-value total">{{ formatCurrency(grandTotal) }}</span>
                </div>
              </div>

              <div class="form-actions">
                <!-- Hold Sale Button -->
                <button
                  v-if="selectedItemIds.length > 0"
                  type="button"
                  class="btn btn-ghost"
                  :disabled="isSubmitting"
                  @click="handleHoldSale"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Hold</span>
                </button>

                <NuxtLink to="/operations" class="btn btn-secondary">
                  Cancel
                </NuxtLink>
                <button
                  type="button"
                  :disabled="!canSubmit || isSubmitting"
                  class="btn btn-primary"
                  @click="handleSubmit"
                >
                  <UiSpinner v-if="isSubmitting" />
                  <span>{{ isSubmitting ? 'Processing...' : 'Complete Sale' }}</span>
                </button>
              </div>
            </div>

            <!-- Insufficient Cash Warning -->
            <Transition name="fade">
              <div v-if="hasInsufficientCash" class="insufficient-cash-warning">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>Cash tendered is less than the total amount due</span>
              </div>
            </Transition>
          </div>
        </div>
      </template>
    </div>

    <!-- Receipt Options Modal -->
    <ReceiptOptionsModal
      v-model="showReceiptModal"
      :operation="completedOperation"
      :settings="businessSettings"
      :business-name="authStore.businessName || 'Business'"
      @complete="handleReceiptComplete"
    />

    <!-- Held Sales Modal -->
    <CashierHeldSalesModal
      v-model="showHeldSalesModal"
      :sales="parkedSales"
      @retrieve="handleRetrieveSale"
      @delete="handleDeleteSale"
    />

    <!-- Replace Confirmation Modal -->
    <UiModal
      v-model="showReplaceConfirm"
      title="Replace Current Sale?"
      size="sm"
    >
      <p class="replace-confirm-text">
        Your current cart has <strong>{{ selectedItemIds.length }}</strong>
        {{ selectedItemIds.length === 1 ? 'item' : 'items' }}.
        Replace with the held sale?
      </p>
      <template #footer>
        <UiButton variant="secondary" @click="showReplaceConfirm = false">
          Cancel
        </UiButton>
        <UiButton variant="primary" @click="confirmReplaceSale">
          Replace
        </UiButton>
      </template>
    </UiModal>

    <!-- Settings Permission Modal (for non-owners) -->
    <UiModal
      v-model="showSettingsPermissionModal"
      title="Settings Access"
      size="sm"
    >
      <div class="settings-permission-content">
        <p>Only business owners can change cashier settings.</p>
        <p>Please contact your business owner to request changes.</p>
      </div>
      <template #footer>
        <UiButton variant="primary" @click="showSettingsPermissionModal = false">
          OK
        </UiButton>
      </template>
    </UiModal>

    <!-- Barcode Scanner Modal -->
    <CashierBarcodeScannerModal
      v-model="showBarcodeScanner"
      :torch-available="hasTorchSupport"
      @scan="handleBarcodeScan"
      @permission-denied="handleScannerPermissionDenied"
      @error="handleScannerError"
    />

    <!-- Zero Stock Alert Modal -->
    <CashierZeroStockAlertModal
      v-model="showZeroStockModal"
      :item-name="zeroStockItem?.name || ''"
      :item-id="zeroStockItem?.id || ''"
      :can-update-inventory="canManageInventory"
      :loading="isZeroStockUpdating"
      @update-and-add="handleZeroStockUpdateAndAdd"
      @cancel="handleZeroStockCancel"
    />
  </div>
</template>

<script setup lang="ts">
import type { DynamicInventoryItem, ColumnDefinition } from '~/types/schema'
import type { Operation, PaymentMethod, CardType, SplitPaymentEntry, SinglePaymentData } from '~/types/operation'
import type { BusinessSettings } from '~/types/business'
import type { ParkedSale, ParkedSaleInput } from '~/types/parked-sale'
import { useParkedSales } from '~/composables/useParkedSales'
import { useBarcode, playSuccessBeep } from '~/composables/useBarcode'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const authStore = useAuthStore()
const { fetchSchema, isLoading: isSchemaLoading } = useSchema()
const { items, sortedColumns: columns, updateItem } = useInventory()
const { isLoading: isSubmitting, createSale } = useSale()

// Initialize socket connection for real-time inventory updates
// This ensures stock quantities update when other users make changes
useSocket()

// Parked/held sales composable
const {
  parkedSales,
  parkedSalesCount,
  parkSale,
  retrieveSale,
  deleteSale,
  loadParkedSales,
} = useParkedSales()

// Business settings for tax calculation
const businessSettings = ref<BusinessSettings | null>(null)

/**
 * Check if current user is the business owner.
 */
const isOwner = computed(() => authStore.isOwner)

/**
 * Check if current user can manage inventory (OWNER or BOSS roles).
 * Used for determining if user can quick-update stock from zero.
 */
const canManageInventory = computed(() => authStore.canManageInventory)

// Form state
const selectedItemIds = ref<string[]>([])
const itemQuantities = ref<Record<string, number>>({})
const itemDiscounts = ref<Record<string, number | undefined>>({})
const itemDiscountTypes = ref<Record<string, 'percent' | 'fixed'>>({})

// Payment state
const paymentMode = ref<'single' | 'split'>('single')
const singlePayment = ref<SinglePaymentData>({
  method: 'CASH',
  cardType: undefined,
  checkNumber: undefined,
  cashTendered: undefined,
})
const splitPayments = ref<SplitPaymentEntry[]>([])

const formData = ref({
  date: getTodayDate(),
  notes: '',
})
const errorMessage = ref('')
const showCardTypeError = ref(false)

// Receipt modal state
const showReceiptModal = ref(false)
const completedOperation = ref<Operation | null>(null)

// Held sales modal state
const showHeldSalesModal = ref(false)
const showReplaceConfirm = ref(false)
const pendingRetrieveSaleId = ref<string | null>(null)

// Settings permission modal state (for non-owners)
const showSettingsPermissionModal = ref(false)

// Barcode input state
const barcodeError = ref('')
const isBarcodeLoading = ref(false)
const itemSelectorRef = ref<{ focus: () => void; clear: () => void; showSuccess: () => void; showError: () => void } | null>(null)

// Barcode scanner modal state
const showBarcodeScanner = ref(false)
const hasTorchSupport = ref(false)

// Zero stock modal state
const showZeroStockModal = ref(false)
const zeroStockItem = ref<{ id: string; name: string } | null>(null)
const isZeroStockUpdating = ref(false)

/**
 * Gets today's date in YYYY-MM-DD format for the date input default value.
 */
function getTodayDate(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

/**
 * Quantity column definition (required for sale operations).
 */
const quantityColumn = computed(() => columns.value.find((c) => c.role === 'quantity'))

/**
 * Price column definition (required for sale operations).
 */
const priceColumn = computed(() => columns.value.find((c) => c.role === 'price'))

/**
 * Barcode column definition (optional, enables barcode scanning).
 */
const barcodeColumn = computed(() => columns.value.find((c) => c.role === 'barcode'))

/**
 * Whether to show the quantity column reminder notice.
 */
const showQuantityReminder = computed(() => !isSchemaLoading.value && !quantityColumn.value)

/**
 * Whether to show the price column reminder notice.
 */
const showPriceReminder = computed(() => !isSchemaLoading.value && quantityColumn.value && !priceColumn.value)

/**
 * Computed array of selected inventory items.
 */
const selectedItems = computed<DynamicInventoryItem[]>(() => {
  return items.value.filter((item) => selectedItemIds.value.includes(item.id))
})

/**
 * Use shared composables for item display and currency formatting.
 */
const { formatCurrency } = useCurrency()
const { getItemName, getItemPrice, getItemQuantity } = useItemDisplay(columns)

/**
 * Calculates subtotal (sum of price * quantity for all items, before discounts).
 */
const subtotal = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    const price = getItemPrice(item)
    const qty = itemQuantities.value[item.id] || 1
    return sum + price * qty
  }, 0)
})

/**
 * Calculates total discount amount across all items.
 */
const totalDiscount = computed(() => {
  return selectedItems.value.reduce((sum, item) => {
    const price = getItemPrice(item)
    const qty = itemQuantities.value[item.id] || 1
    const discount = itemDiscounts.value[item.id]
    const discountType = itemDiscountTypes.value[item.id] || 'percent'

    if (!discount || discount <= 0) return sum

    const grossTotal = price * qty
    if (discountType === 'percent') {
      return sum + grossTotal * (discount / 100)
    } else {
      return sum + discount
    }
  }, 0)
})

/**
 * Tax rate from business settings (e.g., 8.25 for 8.25%).
 */
const taxRate = computed(() => businessSettings.value?.taxRate ?? 0)

/**
 * Tax name from business settings (e.g., "Sales Tax").
 */
const taxName = computed(() => businessSettings.value?.taxName ?? 'Tax')

/**
 * Display label for tax row: "Sales Tax (8.25%)" or just "Tax" if rate is 0.
 */
const taxDisplayLabel = computed(() => {
  if (taxRate.value > 0) {
    return `${taxName.value} (${taxRate.value}%)`
  }
  return taxName.value
})

/**
 * Taxable amount: subtotal minus discounts.
 */
const taxableAmount = computed(() => {
  return Math.max(0, subtotal.value - totalDiscount.value)
})

/**
 * Calculated tax amount based on taxable amount and tax rate.
 */
const taxAmount = computed(() => {
  return taxableAmount.value * (taxRate.value / 100)
})

/**
 * Calculates grand total (subtotal - discount + tax).
 */
const grandTotal = computed(() => {
  return Math.max(0, subtotal.value - totalDiscount.value + taxAmount.value)
})


/**
 * Calculates a relative epsilon for floating point comparison.
 * Uses a minimum of 0.01 (1 cent) or 0.01% of the total, whichever is larger.
 * This prevents floating point precision issues when comparing monetary values.
 */
function getComparisonEpsilon(): number {
  return Math.max(0.01, grandTotal.value * 0.0001)
}

/**
 * Calculate total paid from split payments.
 */
const splitPaymentTotal = computed(() => {
  return splitPayments.value.reduce((sum, p) => sum + p.amount, 0)
})

/**
 * Calculate remaining balance for split payments.
 */
const splitPaymentRemainingBalance = computed(() => {
  return grandTotal.value - splitPaymentTotal.value
})

/**
 * Check if split payments are valid (total equals or exceeds grand total).
 */
const isSplitPaymentValid = computed(() => {
  if (splitPayments.value.length === 0) return false

  // Check that all CARD payments have card type selected
  for (const payment of splitPayments.value) {
    if (payment.method === 'CARD' && !payment.cardType) {
      return false
    }
  }

  // Payment is valid if remaining balance is zero or negative (meaning paid or overpaid)
  // Use epsilon for floating point comparison to handle rounding errors
  return splitPaymentRemainingBalance.value <= getComparisonEpsilon()
})

/**
 * Determines if cash payment has insufficient funds.
 * Returns true when payment method is CASH and tendered amount is less than grand total.
 * Used to show a warning to the user (does not block submission).
 */
const hasInsufficientCash = computed(() => {
  if (paymentMode.value !== 'single') return false
  if (singlePayment.value.method !== 'CASH') return false
  if (singlePayment.value.cashTendered === undefined) return false
  if (singlePayment.value.cashTendered === 0) return false
  return singlePayment.value.cashTendered < grandTotal.value - getComparisonEpsilon()
})

/**
 * Determines if the form can be submitted.
 */
const canSubmit = computed(() => {
  if (selectedItems.value.length === 0) return false
  if (!formData.value.date) return false

  // Payment validation based on mode
  if (paymentMode.value === 'single') {
    if (!singlePayment.value.method) return false
    // Card type is required when payment method is CARD
    if (singlePayment.value.method === 'CARD' && !singlePayment.value.cardType) {
      return false
    }
    // Prevent submission when cash tendered is less than total
    if (hasInsufficientCash.value) {
      return false
    }
  } else {
    // Split payment mode - must have valid total
    if (!isSplitPaymentValid.value) return false
  }

  // Check that all quantities are valid (not exceeding stock)
  for (const item of selectedItems.value) {
    const qty = itemQuantities.value[item.id] || 1
    const stock = getItemQuantity(item)
    if (qty > stock) return false
  }

  return true
})

/**
 * Reset card type error when payment method changes away from CARD.
 * Clear cash tendered when payment method changes away from CASH.
 */
watch(
  () => singlePayment.value.method,
  (newMethod, oldMethod) => {
    if (newMethod !== 'CARD') {
      showCardTypeError.value = false
    }
    // Clear cashTendered when switching away from CASH
    if (oldMethod === 'CASH' && newMethod !== 'CASH') {
      singlePayment.value.cashTendered = undefined
    }
  }
)

/**
 * Reset card type error when payment mode changes.
 */
watch(paymentMode, () => {
  showCardTypeError.value = false
})

/**
 * Initialize quantity to 1 when item is selected and clean up on removal.
 */
watch(selectedItemIds, (newIds, oldIds) => {
  // Find newly added items
  const addedIds = newIds.filter((id) => !oldIds?.includes(id))
  addedIds.forEach((id) => {
    if (!itemQuantities.value[id]) {
      itemQuantities.value[id] = 1
    }
    if (!itemDiscountTypes.value[id]) {
      itemDiscountTypes.value[id] = 'percent'
    }
  })

  // Clean up data for removed items
  const removedIds = oldIds?.filter((id) => !newIds.includes(id)) || []
  removedIds.forEach((id) => {
    delete itemQuantities.value[id]
    delete itemDiscounts.value[id]
    delete itemDiscountTypes.value[id]
  })
})

/**
 * Updates the quantity for a specific item.
 */
function updateItemQuantity(itemId: string, quantity: number): void {
  itemQuantities.value[itemId] = quantity
}

/**
 * Updates the discount for a specific item.
 */
function updateItemDiscount(itemId: string, discount: number | undefined): void {
  itemDiscounts.value[itemId] = discount
}

/**
 * Updates the discount type for a specific item.
 */
function updateItemDiscountType(itemId: string, discountType: 'percent' | 'fixed'): void {
  itemDiscountTypes.value[itemId] = discountType
}

/**
 * Removes an item from the selection.
 */
function removeItem(itemId: string): void {
  selectedItemIds.value = selectedItemIds.value.filter((id) => id !== itemId)
}

/**
 * Updates single payment data from the container component.
 */
function updateSinglePayment(data: SinglePaymentData): void {
  singlePayment.value = data
}

/**
 * Updates split payments array from the container component.
 */
function updateSplitPayments(payments: SplitPaymentEntry[]): void {
  splitPayments.value = payments
}

/**
 * Builds payment data for single payment mode.
 * Includes cardType for CARD payments and checkNumber for CHECK payments.
 */
function buildSinglePaymentData(): Record<string, unknown> {
  return {
    paymentMethod: singlePayment.value.method,
    ...(singlePayment.value.method === 'CARD' && singlePayment.value.cardType
      ? { cardType: singlePayment.value.cardType }
      : {}),
    ...(singlePayment.value.method === 'CHECK' && singlePayment.value.checkNumber
      ? { checkNumber: singlePayment.value.checkNumber }
      : {}),
  }
}

/**
 * Builds payment data for split payment mode.
 * Maps each payment entry to include method-specific fields.
 */
function buildSplitPaymentData(): Record<string, unknown> {
  return {
    payments: splitPayments.value.map((p) => ({
      method: p.method,
      amount: p.amount,
      ...(p.method === 'CARD' && p.cardType ? { cardType: p.cardType } : {}),
      ...(p.method === 'CHECK' && p.checkNumber ? { checkNumber: p.checkNumber } : {}),
      ...(p.method === 'CASH' && p.cashTendered !== undefined
        ? { cashTendered: p.cashTendered }
        : {}),
    })),
  }
}

/**
 * Handles form submission.
 */
async function handleSubmit(): Promise<void> {
  errorMessage.value = ''

  // Validate based on payment mode
  if (paymentMode.value === 'single') {
    // Validate card type if CARD is selected
    if (singlePayment.value.method === 'CARD' && !singlePayment.value.cardType) {
      showCardTypeError.value = true
      errorMessage.value = 'Please select a card type'
      return
    }
  } else {
    // Validate split payments
    if (!isSplitPaymentValid.value) {
      // Check if any CARD payment is missing card type
      const missingCardType = splitPayments.value.some(
        (p) => p.method === 'CARD' && !p.cardType
      )
      if (missingCardType) {
        showCardTypeError.value = true
        errorMessage.value = 'Please select a card type for all card payments'
        return
      }
      // Check if payment total is insufficient (remaining balance is positive)
      if (splitPaymentRemainingBalance.value > getComparisonEpsilon()) {
        errorMessage.value = 'Payment total must equal or exceed the sale total'
        return
      }
    }
  }

  showCardTypeError.value = false

  const saleItems = selectedItems.value.map((item) => ({
    itemId: item.id,
    quantity: itemQuantities.value[item.id] || 1,
    ...(itemDiscounts.value[item.id] !== undefined && itemDiscounts.value[item.id]! > 0
      ? {
          discount: itemDiscounts.value[item.id],
          discountType: itemDiscountTypes.value[item.id] || 'percent',
        }
      : {}),
  }))

  const paymentData = paymentMode.value === 'single'
    ? buildSinglePaymentData()
    : buildSplitPaymentData()

  // Build cash payment details for single payment mode
  const cashDetails = paymentMode.value === 'single' && singlePayment.value.method === 'CASH' && singlePayment.value.cashTendered !== undefined
    ? {
        cashTendered: singlePayment.value.cashTendered,
        changeGiven: Math.max(0, singlePayment.value.cashTendered - grandTotal.value),
      }
    : {}

  const result = await createSale({
    date: formData.value.date,
    notes: formData.value.notes || undefined,
    items: saleItems,
    // Financial totals for receipt reprinting
    subtotal: subtotal.value,
    totalDiscount: totalDiscount.value,
    taxRate: taxRate.value,
    taxName: taxDisplayLabel.value,
    taxAmount: taxAmount.value,
    grandTotal: grandTotal.value,
    // Cash payment details
    ...cashDetails,
    ...paymentData,
  } as Parameters<typeof createSale>[0])

  if (result.success && result.data) {
    // Store the completed operation and show receipt modal
    completedOperation.value = result.data
    showReceiptModal.value = true
  } else {
    errorMessage.value = result.error || 'Failed to create sale'
  }
}

/**
 * Handles completion of the receipt flow (print, email, or skip).
 * Clears the cart and stays on the cashier page for the next order.
 * Note: Stock quantities are updated in real-time via socket connection.
 */
function handleReceiptComplete() {
  showReceiptModal.value = false
  completedOperation.value = null
  clearCart()
}

/**
 * Handles settings button click.
 * Navigates to settings for owners, shows permission modal for non-owners.
 */
function handleSettingsClick(): void {
  if (isOwner.value) {
    router.push('/business?tab=settings')
  } else {
    showSettingsPermissionModal.value = true
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode Functions
// ─────────────────────────────────────────────────────────────────────────────

const { lookupBarcode, createScannerDetector, triggerHapticFeedback } = useBarcode()

/**
 * Handles barcode submission from manual entry or scanner.
 * Looks up the item by barcode and adds it to the cart.
 * Includes debouncing via isBarcodeLoading check to prevent duplicate lookups.
 *
 * If the item has zero stock, shows a modal prompting the user to update
 * the quantity (if they have permission) or informing them to ask someone.
 */
async function handleBarcodeSubmit(barcode: string): Promise<void> {
  // Early return if empty barcode or already processing a lookup (debouncing)
  if (!barcode.trim() || isBarcodeLoading.value) return

  barcodeError.value = ''
  isBarcodeLoading.value = true

  try {
    const result = await lookupBarcode(barcode)

    if (result.found && result.item) {
      // Check if item has zero stock
      const itemStock = getItemQuantity(result.item)

      if (itemStock <= 0) {
        // Show zero stock modal instead of adding to cart
        zeroStockItem.value = {
          id: result.item.id,
          name: getItemName(result.item),
        }
        showZeroStockModal.value = true
        // Give warning feedback since item can't be added directly
        triggerHapticFeedback('error')
        return
      }

      // Check if item already in cart
      if (selectedItemIds.value.includes(result.item.id)) {
        // Increment quantity
        const currentQty = itemQuantities.value[result.item.id] || 1
        itemQuantities.value[result.item.id] = currentQty + 1
      } else {
        // Add to cart with quantity 1
        selectedItemIds.value = [...selectedItemIds.value, result.item.id]
        itemQuantities.value[result.item.id] = 1
        itemDiscountTypes.value[result.item.id] = 'percent'
      }

      // Success feedback: haptic vibration and audio beep
      triggerHapticFeedback('success')
      playSuccessBeep()
      itemSelectorRef.value?.showSuccess()
    } else {
      // Not found
      barcodeError.value = result.error || 'Item not found'
      triggerHapticFeedback('error')
      itemSelectorRef.value?.showError()
    }
  } catch (err) {
    barcodeError.value = 'Failed to lookup barcode'
    triggerHapticFeedback('error')
    itemSelectorRef.value?.showError()
  } finally {
    isBarcodeLoading.value = false
  }
}

/**
 * Clears the barcode error message.
 */
function handleClearBarcodeError(): void {
  barcodeError.value = ''
}

/**
 * Handles barcode scan from the camera scanner modal.
 * Processes the barcode through the standard submit handler.
 */
function handleBarcodeScan(barcode: string): void {
  handleBarcodeSubmit(barcode)
}

/**
 * Handles camera permission denied from scanner modal.
 * Shows an appropriate error message to the user.
 */
function handleScannerPermissionDenied(): void {
  barcodeError.value = 'Camera access denied. Please allow camera in your browser settings.'
}

/**
 * Handles scanner errors from the modal.
 * Displays the error message to the user.
 */
function handleScannerError(error: Error): void {
  barcodeError.value = error.message || 'Camera error occurred'
}

// ─────────────────────────────────────────────────────────────────────────────
// Zero Stock Handling Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the "Update & Add" action from the zero stock modal.
 * Updates the item's quantity to 1 in the database and adds it to the cart.
 * Preserves all existing item data fields while only updating the quantity.
 */
async function handleZeroStockUpdateAndAdd(itemId: string): Promise<void> {
  if (!zeroStockItem.value || !quantityColumn.value) return

  isZeroStockUpdating.value = true

  try {
    // Find the existing item to preserve all its data
    const existingItem = items.value.find(item => item.id === itemId)
    if (!existingItem) {
      barcodeError.value = 'Item not found in inventory'
      triggerHapticFeedback('error')
      return
    }

    // Merge existing data with the quantity update to preserve all other fields
    // The API replaces the entire data object, so we must send complete data
    const updateData: Record<string, unknown> = {
      ...existingItem.data,
      [quantityColumn.value.id]: 1,
    }

    const result = await updateItem(itemId, updateData)

    if (result.success) {
      // Add item to cart
      if (!selectedItemIds.value.includes(itemId)) {
        selectedItemIds.value = [...selectedItemIds.value, itemId]
        itemQuantities.value[itemId] = 1
        itemDiscountTypes.value[itemId] = 'percent'
      }

      // Success feedback
      triggerHapticFeedback('success')
      playSuccessBeep()
      itemSelectorRef.value?.showSuccess()

      // Close modal and reset state
      showZeroStockModal.value = false
      zeroStockItem.value = null
    } else {
      // Show error message
      barcodeError.value = result.error || 'Failed to update inventory'
      triggerHapticFeedback('error')
    }
  } catch {
    barcodeError.value = 'Failed to update inventory'
    triggerHapticFeedback('error')
  } finally {
    isZeroStockUpdating.value = false
  }
}

/**
 * Handles cancel action from the zero stock modal.
 * Resets the zero stock state without making any changes.
 */
function handleZeroStockCancel(): void {
  showZeroStockModal.value = false
  zeroStockItem.value = null
}

// ─────────────────────────────────────────────────────────────────────────────
// Hold Sale Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parks the current sale and clears the cart.
 */
function handleHoldSale(): void {
  // Calculate total quantity inline (sum of quantities for all selected items)
  const totalItems = selectedItems.value.reduce(
    (sum, item) => sum + (itemQuantities.value[item.id] || 1),
    0
  )

  const saleInput: ParkedSaleInput = {
    items: selectedItems.value.map(item => ({
      itemId: item.id,
      itemName: getItemName(item),
      quantity: itemQuantities.value[item.id] || 1,
      pricePerItem: getItemPrice(item),
      discount: itemDiscounts.value[item.id],
      discountType: itemDiscountTypes.value[item.id],
    })),
    paymentMode: paymentMode.value,
    singlePayment: paymentMode.value === 'single' ? {
      method: singlePayment.value.method,
      cardType: singlePayment.value.cardType,
      checkNumber: singlePayment.value.checkNumber,
      cashTendered: singlePayment.value.cashTendered,
    } : null,
    splitPayments: paymentMode.value === 'split' ? [...splitPayments.value] : [],
    date: formData.value.date,
    notes: formData.value.notes,
    totalItems,
    grandTotal: grandTotal.value,
  }

  const result = parkSale(saleInput)
  if (result.success) {
    clearCart()
  } else {
    errorMessage.value = result.error || 'Failed to hold sale'
  }
}

/**
 * Clears the current cart state.
 */
function clearCart(): void {
  selectedItemIds.value = []
  itemQuantities.value = {}
  itemDiscounts.value = {}
  itemDiscountTypes.value = {}
  paymentMode.value = 'single'
  // Reset single payment to defaults
  singlePayment.value = {
    method: 'CASH',
    cardType: undefined,
    checkNumber: undefined,
    cashTendered: undefined,
  }
  splitPayments.value = []
  formData.value.notes = ''
}

/**
 * Handles retrieve request - checks if cart has items first.
 */
function handleRetrieveSale(saleId: string): void {
  if (selectedItemIds.value.length > 0) {
    pendingRetrieveSaleId.value = saleId
    showReplaceConfirm.value = true
  } else {
    doRetrieveSale(saleId)
  }
}

/**
 * Confirms replacement and retrieves the sale.
 */
function confirmReplaceSale(): void {
  if (pendingRetrieveSaleId.value) {
    doRetrieveSale(pendingRetrieveSaleId.value)
    pendingRetrieveSaleId.value = null
  }
  showReplaceConfirm.value = false
}

/**
 * Actually retrieves a held sale into the cart.
 */
function doRetrieveSale(saleId: string): void {
  const sale = retrieveSale(saleId)
  if (!sale) return

  // Clear current cart first
  clearCart()

  // Restore items (validate they still exist in inventory)
  const validItemIds: string[] = []
  sale.items.forEach(item => {
    const exists = items.value.some(inv => inv.id === item.itemId)
    if (exists) {
      validItemIds.push(item.itemId)
      itemQuantities.value[item.itemId] = item.quantity
      if (item.discount !== undefined) {
        itemDiscounts.value[item.itemId] = item.discount
        itemDiscountTypes.value[item.itemId] = item.discountType || 'percent'
      }
    }
  })
  selectedItemIds.value = validItemIds

  // Restore payment
  paymentMode.value = sale.paymentMode
  if (sale.singlePayment) {
    singlePayment.value = {
      method: sale.singlePayment.method,
      cardType: sale.singlePayment.cardType,
      checkNumber: sale.singlePayment.checkNumber,
      cashTendered: sale.singlePayment.cashTendered,
    }
  }
  if (sale.splitPayments.length > 0) {
    splitPayments.value = [...sale.splitPayments]
  }

  // Restore form data
  formData.value.notes = sale.notes
  if (sale.date) {
    formData.value.date = sale.date
  }

  showHeldSalesModal.value = false

  // Warn if some items were unavailable
  if (validItemIds.length < sale.items.length) {
    const unavailableCount = sale.items.length - validItemIds.length
    errorMessage.value = `${unavailableCount} item${unavailableCount === 1 ? ' is' : 's are'} no longer available and ${unavailableCount === 1 ? 'was' : 'were'} removed from the sale.`
  }
}

/**
 * Deletes a held sale.
 */
function handleDeleteSale(saleId: string): void {
  deleteSale(saleId)
}

// Fetch data on mount
onMounted(async () => {
  const { initAuth } = useAuth()
  const { preloadLibraries } = useReceipt()

  // Preload receipt libraries in background (non-blocking)
  preloadLibraries()

  // Ensure auth is initialized before making API calls
  // This prevents 400 errors on direct page load when tokens aren't loaded yet
  await initAuth()

  // Load any previously parked sales from localStorage
  loadParkedSales()

  // Fetch business settings for tax calculation
  try {
    businessSettings.value = await $fetch<BusinessSettings>('/api/business/settings', {
      headers: {
        Authorization: `Bearer ${authStore.accessToken}`,
      },
    })
  } catch {
    // If settings fetch fails, continue with defaults (no tax)
    // This is expected for new businesses without settings
  }

  await fetchSchema()
  // Note: Item fetching is now handled by ItemSelector via useVirtualWindow composable
  // which provides memory-efficient infinite scrolling with on-demand loading

  // Auto-focus item selector input if barcode column exists
  nextTick(() => {
    if (barcodeColumn.value) {
      itemSelectorRef.value?.focus()
    }
  })
})

// Track scanner detector cleanup function
let cleanupScanner: (() => void) | null = null

// Setup USB scanner detector when barcode column exists
watch(barcodeColumn, (newColumn, oldColumn) => {
  // Clean up existing detector if any
  if (cleanupScanner) {
    cleanupScanner()
    cleanupScanner = null
  }

  // Set up new detector if barcode column exists
  if (newColumn) {
    cleanupScanner = createScannerDetector((barcode) => {
      handleBarcodeSubmit(barcode)
    })
  }
}, { immediate: true })

// Cleanup scanner detector on unmount
onUnmounted(() => {
  if (cleanupScanner) {
    cleanupScanner()
    cleanupScanner = null
  }
})
</script>

<style scoped>
.cashier-page {
  @apply min-h-screen py-8 px-4 relative;
  background: rgb(var(--color-surface-50));
  overflow-x: hidden;
}

.page-container {
  @apply max-w-5xl mx-auto relative z-10;
  width: 100%;
  min-width: 0;
}

.page-header {
  @apply mb-8 space-y-4;
}

.back-link {
  @apply min-h-[44px] inline-flex items-center gap-2 px-2 -ml-2 text-sm font-medium mb-4 transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

.header-content {
  @apply flex items-center gap-4;
}

.header-icon {
  @apply flex items-center justify-center flex-shrink-0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  color: white;
  box-shadow: 0 4px 12px rgba(var(--color-primary-500), 0.3);
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

.header-actions {
  @apply flex items-center gap-2 ml-auto;
}

.settings-shortcut-btn {
  @apply flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl transition-all;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.settings-shortcut-btn:hover {
  background: rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-700));
}

.settings-shortcut-btn:focus-visible {
  @apply outline-none;
  box-shadow: var(--focus-ring);
}

.settings-shortcut-btn--disabled {
  @apply opacity-50 cursor-default;
}

.settings-shortcut-btn--disabled:hover {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-500));
}

.page-title {
  @apply text-2xl md:text-3xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

.error-message {
  @apply flex items-center gap-2 p-4 rounded-xl mb-6 text-sm;
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
  border: 1px solid rgba(var(--color-error-500), 0.2);
}

/* Top Row Layout: Select Items + Selected Items */
.top-row-layout {
  @apply grid gap-6 mb-6;
}

@media (min-width: 768px) {
  .top-row-layout {
    @apply grid-cols-2;
    grid-template-rows: 1fr;
    align-items: stretch;
  }
}

.form-section {
  @apply p-5 md:p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  min-width: 0;
  width: 100%;
  /* Enable flex children to fill remaining height */
  display: flex;
  flex-direction: column;
}

/* Desktop: Both columns have identical height constraints */
@media (min-width: 768px) {
  .top-row-layout > .form-section {
    min-height: 400px;
    max-height: calc(100vh - 400px);
    overflow: hidden;
  }
}

.selected-items-list {
  @apply space-y-3 overflow-y-auto flex-1;
  /* Subtle scrollbar styling */
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--color-surface-400), 0.5) transparent;
}

.selected-items-list::-webkit-scrollbar {
  width: 6px;
}

.selected-items-list::-webkit-scrollbar-track {
  background: transparent;
}

.selected-items-list::-webkit-scrollbar-thumb {
  background-color: rgba(var(--color-surface-400), 0.5);
  border-radius: 3px;
}

.selected-items-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(var(--color-surface-500), 0.5);
}

/* Empty Cart State */
.empty-cart-state {
  @apply flex flex-col items-center justify-center text-center py-8 flex-1;
  color: rgb(var(--color-surface-400));
}

.empty-cart-state svg {
  @apply mb-3;
  opacity: 0.5;
}

.empty-cart-state p {
  @apply text-sm;
}

.empty-cart-state .empty-cart-hint {
  @apply mt-1 text-xs;
  color: rgb(var(--color-surface-400));
  opacity: 0.8;
}

/* Sale Details Section (full width) */
.sale-details-section {
  @apply p-5 md:p-6 rounded-2xl mb-6;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.sale-details-form {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  grid-template-areas:
    "date"
    "payment"
    "notes";
}

.sale-details-date { grid-area: date; }
.sale-details-payment { grid-area: payment; }
.sale-details-notes { grid-area: notes; }

@media (min-width: 768px) {
  .sale-details-form {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      "date    payment"
      "notes   payment";
  }

  /* Left column wrapper to keep Date and Notes close together */
  .sale-details-date,
  .sale-details-notes {
    align-self: start;
  }

  .sale-details-payment {
    align-self: stretch;
  }
}

@media (max-width: 767px) {
  .form-section {
    @apply p-4;
  }
}

.section-header {
  @apply flex items-center gap-3 mb-4 pb-3;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.section-icon {
  @apply flex items-center justify-center w-9 h-9 rounded-lg;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.section-icon.sale-icon {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.section-title {
  @apply font-semibold flex-1;
  color: rgb(var(--color-surface-700));
}

.section-count {
  @apply text-sm px-2 py-0.5 rounded-full;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.form-group {
  @apply flex flex-col gap-1.5;
}

.form-label {
  @apply text-sm font-medium;
  color: rgb(var(--color-surface-700));
}

.required {
  color: rgb(var(--color-error-500));
}

.textarea {
  @apply resize-none;
}


/* Summary Section */
.summary-section {
  @apply flex flex-col gap-4 p-5 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.summary-main {
  @apply flex flex-col md:flex-row items-stretch md:items-end justify-between gap-6;
}

.summary-details {
  @apply flex flex-col gap-2 w-full;
}

@media (min-width: 768px) {
  .summary-details {
    @apply flex-1;
    min-width: 280px;
    max-width: 400px;
  }
}

.summary-row {
  @apply flex justify-between items-center gap-4;
}

.summary-label {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.summary-value {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.summary-value.discount {
  color: rgb(var(--color-accent-500));
}

.summary-row.discount-row {
  @apply py-1;
}

.summary-row.total-row {
  @apply pt-2 mt-2;
  border-top: 1px solid rgba(var(--color-surface-300), 0.5);
}

.summary-row.total-row .summary-label {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}

.summary-value.total {
  @apply text-2xl;
  color: rgb(var(--color-primary-600));
}

/* Insufficient Cash Warning */
.insufficient-cash-warning {
  @apply flex items-center gap-2 p-3 rounded-lg text-sm font-medium w-full;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-700));
  border: 1px solid rgba(var(--color-warning-500), 0.3);
}

.form-actions {
  @apply flex flex-wrap gap-3 flex-shrink-0 w-full;
}

/* Stack buttons vertically on very small screens */
@media (max-width: 479px) {
  .form-actions {
    @apply flex-col;
  }

  .form-actions .btn {
    @apply w-full justify-center;
  }
}

/* Wrap to multiple rows on small-medium screens */
@media (min-width: 480px) and (max-width: 767px) {
  .form-actions {
    @apply justify-end;
  }
}

@media (min-width: 768px) {
  .form-actions {
    @apply ml-auto w-auto;
  }
}

.btn {
  @apply px-5 min-h-[44px] flex items-center justify-center gap-2 rounded-xl font-semibold transition-all;
}

.btn-secondary {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.btn-secondary:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.btn-primary {
  color: white;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 15px rgba(var(--color-primary-500), 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(var(--color-primary-500), 0.4);
}

.btn-primary:disabled {
  @apply opacity-50 cursor-not-allowed;
  transform: none;
}

.btn-ghost {
  @apply gap-2;
  background: transparent;
  color: rgb(var(--color-surface-600));
  border: 1px solid rgba(var(--color-surface-300), 0.5);
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.btn-ghost:disabled {
  @apply opacity-50 cursor-not-allowed;
}

/* Form Disabled State */
.form-content-wrapper {
  position: relative;
  transition: opacity 200ms ease-in-out;
}

.form-content-wrapper.disabled {
  @apply opacity-50 pointer-events-none select-none;
}

.form-content-wrapper.disabled .error-message {
  @apply opacity-60;
}

.form-content-wrapper.disabled .top-row-layout,
.form-content-wrapper.disabled .sale-details-section,
.form-content-wrapper.disabled .summary-section {
  @apply opacity-75 cursor-not-allowed;
}

.form-content-wrapper.disabled input,
.form-content-wrapper.disabled textarea,
.form-content-wrapper.disabled select,
.form-content-wrapper.disabled button {
  @apply cursor-not-allowed;
}

.form-content-wrapper.disabled * {
  pointer-events: none !important;
}

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 150ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Replace Confirmation Modal */
.replace-confirm-text {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

.replace-confirm-text strong {
  color: rgb(var(--color-surface-800));
}

/* Settings Permission Modal */
.settings-permission-content {
  @apply space-y-3;
}

.settings-permission-content p {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

.settings-permission-content p:first-child {
  @apply font-medium;
  color: rgb(var(--color-surface-700));
}
</style>
