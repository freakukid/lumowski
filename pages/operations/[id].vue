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

        <!-- Header Action Buttons -->
        <div class="header-actions">
          <!-- Receipt Action Button - visible only for non-undone SALE operations -->
          <button
            v-if="showReceiptActions"
            class="receipt-action-btn"
            :disabled="isReceiptProcessing"
            aria-label="Receipt options"
            @click="showReceiptModal = true"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="btn-label">Receipt</span>
          </button>

          <!-- Process Return Button (visible only for non-undone SALE operations) -->
          <NuxtLink
            v-if="showProcessReturnButton"
            :to="`/returns?saleId=${currentOperation?.id}`"
            class="return-action-btn"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="btn-label">Return</span>
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
          <div :class="['header-icon', headerIconClass, { 'header-icon-undone': currentOperation.undoneAt }]">
            <!-- Receiving icon -->
            <svg v-if="currentOperation.type === 'RECEIVING'" class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 11v4m0 0l-2-2m2 2l2-2" />
            </svg>
            <!-- Sale icon -->
            <svg v-else-if="currentOperation.type === 'SALE'" class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <!-- Return icon -->
            <svg v-else-if="currentOperation.type === 'RETURN'" class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

        <!-- SALE OPERATION LAYOUT -->
        <template v-if="isSaleOperation">
          <!-- Financial Summary Card -->
          <div :class="['summary-card', 'summary-card-sale', { 'summary-card-undone': currentOperation.undoneAt }]">
            <div class="stats-grid">
              <!-- Subtotal -->
              <div class="stat-item">
                <span class="stat-label">Subtotal</span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ formatCurrency(currentOperation.subtotal ?? 0) }}
                </span>
              </div>

              <!-- Discount -->
              <div class="stat-item">
                <span class="stat-label">Discount</span>
                <span :class="['stat-value', 'discount-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ (currentOperation.totalDiscount ?? 0) > 0 ? '-' : '' }}{{ formatCurrency(currentOperation.totalDiscount ?? 0) }}
                </span>
              </div>

              <!-- Tax -->
              <div class="stat-item">
                <span class="stat-label">
                  {{ currentOperation.taxName || 'Tax' }}
                  <span v-if="currentOperation.taxRate" class="tax-rate">({{ currentOperation.taxRate }}%)</span>
                </span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ formatCurrency(currentOperation.taxAmount ?? 0) }}
                </span>
              </div>

              <!-- Items count -->
              <div class="stat-item">
                <span class="stat-label">Items</span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ currentOperation.items.length }}
                </span>
              </div>
            </div>

            <!-- Grand Total Bar -->
            <div :class="['total-bar', 'total-bar-sale', { 'total-bar-undone': currentOperation.undoneAt }]">
              <span class="total-label">Grand Total</span>
              <span :class="['total-value', { 'value-undone': currentOperation.undoneAt }]">
                <template v-if="currentOperation.undoneAt">
                  <s>{{ formatCurrency(currentOperation.grandTotal ?? 0) }}</s>
                </template>
                <template v-else>
                  {{ formatCurrency(currentOperation.grandTotal ?? 0) }}
                </template>
              </span>
            </div>
          </div>

          <!-- Details and Payment Cards Grid -->
          <div class="cards-grid">
            <!-- Operation Details Card (reusable component) -->
            <OperationsOperationDetailsCard :operation="currentOperation" />

            <!-- Payment Details Card -->
            <div class="secondary-card">
              <div class="card-header">
                <div class="card-header-icon payment-icon">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <span class="card-header-text">Payment Details</span>
              </div>

              <div class="payment-content">
                <!-- Split Payments -->
                <template v-if="hasSplitPayments">
                  <div class="split-payments-list">
                    <div
                      v-for="(payment, index) in currentOperation.payments"
                      :key="index"
                      class="split-payment-entry"
                    >
                      <div class="split-payment-header">
                        <span :class="['payment-method-badge', getPaymentMethodClass(payment.method)]">
                          <component :is="getPaymentIconComponent(payment.method)" class="w-3.5 h-3.5" />
                          <span>{{ formatPaymentMethod(payment.method) }}</span>
                          <span v-if="payment.method === 'CARD' && payment.cardType" class="card-type-label">
                            ({{ payment.cardType }})
                          </span>
                        </span>
                        <span class="split-payment-amount">{{ formatCurrency(payment.amount) }}</span>
                      </div>
                      <div v-if="payment.method === 'CHECK' && payment.checkNumber" class="payment-detail-line">
                        Check #{{ payment.checkNumber }}
                      </div>
                      <div v-if="payment.method === 'CASH' && payment.cashTendered" class="payment-detail-line">
                        Tendered: {{ formatCurrency(payment.cashTendered) }}
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Single Payment -->
                <template v-else-if="currentOperation.paymentMethod">
                  <div class="single-payment">
                    <span :class="['payment-method-badge', 'payment-method-badge-lg', getPaymentMethodClass(currentOperation.paymentMethod)]">
                      <component :is="getPaymentIconComponent(currentOperation.paymentMethod)" class="w-4 h-4" />
                      <span>{{ formatPaymentMethod(currentOperation.paymentMethod) }}</span>
                    </span>

                    <!-- Card Type for CARD payments -->
                    <div v-if="currentOperation.paymentMethod === 'CARD' && currentOperation.cardType" class="payment-info-row">
                      <span class="payment-info-label">Card Type</span>
                      <span class="payment-info-value">{{ currentOperation.cardType }}</span>
                    </div>

                    <!-- Check Number for CHECK payments -->
                    <div v-if="currentOperation.paymentMethod === 'CHECK' && currentOperation.checkNumber" class="payment-info-row">
                      <span class="payment-info-label">Check Number</span>
                      <span class="payment-info-value">#{{ currentOperation.checkNumber }}</span>
                    </div>

                    <!-- Cash details for CASH payments -->
                    <template v-if="currentOperation.paymentMethod === 'CASH'">
                      <div v-if="currentOperation.cashTendered" class="payment-info-row">
                        <span class="payment-info-label">Cash Tendered</span>
                        <span class="payment-info-value">{{ formatCurrency(currentOperation.cashTendered) }}</span>
                      </div>
                      <div v-if="currentOperation.changeGiven" class="payment-info-row change-row">
                        <span class="payment-info-label">Change Given</span>
                        <span class="payment-info-value change-value">{{ formatCurrency(currentOperation.changeGiven) }}</span>
                      </div>
                    </template>
                  </div>
                </template>

                <!-- No Payment Info -->
                <template v-else>
                  <p class="no-payment-info">No payment information recorded</p>
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- RECEIVING OPERATION LAYOUT -->
        <template v-else>
          <!-- Receiving Summary Card -->
          <div :class="['summary-card', 'summary-card-receiving', { 'summary-card-undone': currentOperation.undoneAt }]">
            <div class="stats-grid">
              <!-- Total Quantity -->
              <div class="stat-item">
                <span class="stat-label">Total Qty</span>
                <span :class="['stat-value', 'qty-accent', { 'value-undone': currentOperation.undoneAt }]">
                  <template v-if="currentOperation.undoneAt">
                    <s>+{{ currentOperation.totalQty }}</s>
                  </template>
                  <template v-else>
                    +{{ currentOperation.totalQty }}
                  </template>
                </span>
              </div>

              <!-- Items Count -->
              <div class="stat-item">
                <span class="stat-label">Items</span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ currentOperation.items.length }}
                </span>
              </div>

              <!-- Avg Cost/Item -->
              <div class="stat-item">
                <span class="stat-label">Avg Cost/Item</span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ costMetrics.avgCost !== null ? formatCurrency(costMetrics.avgCost) : '-' }}
                </span>
              </div>

              <!-- Items with Cost -->
              <div class="stat-item">
                <span class="stat-label">Items with Cost</span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ costMetrics.itemsWithCostCount }} of {{ currentOperation.items.length }}
                </span>
              </div>
            </div>

            <!-- Total Cost Bar (only if cost data exists) -->
            <div v-if="costMetrics.totalCost !== null" :class="['total-bar', 'total-bar-receiving', { 'total-bar-undone': currentOperation.undoneAt }]">
              <span class="total-label">Total Cost</span>
              <span :class="['total-value', { 'value-undone': currentOperation.undoneAt }]">
                <template v-if="currentOperation.undoneAt">
                  <s>{{ formatCurrency(costMetrics.totalCost) }}</s>
                </template>
                <template v-else>
                  {{ formatCurrency(costMetrics.totalCost) }}
                </template>
              </span>
            </div>
          </div>

          <!-- Details and Supplier Cards Grid -->
          <div class="cards-grid">
            <!-- Operation Details Card (reusable component) -->
            <OperationsOperationDetailsCard :operation="currentOperation" />

            <!-- Supplier Card -->
            <div class="secondary-card">
              <div class="card-header">
                <div class="card-header-icon supplier-icon">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                  </svg>
                </div>
                <span class="card-header-text">Supplier Info</span>
              </div>

              <div class="supplier-content">
                <!-- Supplier Name Badge -->
                <div class="supplier-name-section">
                  <span v-if="currentOperation.supplier" class="supplier-name-badge">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>{{ currentOperation.supplier }}</span>
                  </span>
                  <span v-else class="no-supplier-text">No supplier specified</span>
                </div>

                <!-- Cost Summary Section (only if cost data exists) -->
                <template v-if="costMetrics.itemsWithCostCount > 0">
                  <div class="cost-summary-section">
                    <h4 class="cost-summary-title">Cost Summary</h4>

                    <div class="cost-summary-row">
                      <span class="cost-summary-label">Items with Cost</span>
                      <span class="cost-summary-value">{{ costMetrics.itemsWithCostCount }} of {{ currentOperation.items.length }}</span>
                    </div>

                    <div v-if="costMetrics.costRange" class="cost-summary-row">
                      <span class="cost-summary-label">Cost Range</span>
                      <span class="cost-summary-value">
                        <template v-if="costMetrics.costRange.isSame">
                          {{ formatCurrency(costMetrics.costRange.min) }}
                        </template>
                        <template v-else>
                          {{ formatCurrency(costMetrics.costRange.min) }} - {{ formatCurrency(costMetrics.costRange.max) }}
                        </template>
                      </span>
                    </div>
                  </div>
                </template>

                <!-- No Cost Data Message -->
                <template v-else>
                  <div class="no-cost-data">
                    <p class="no-cost-text">No cost information recorded for this receiving.</p>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- RETURN OPERATION LAYOUT -->
        <template v-if="isReturnOperation">
          <!-- Refund Summary Card -->
          <div :class="['summary-card', 'summary-card-return', { 'summary-card-undone': currentOperation.undoneAt }]">
            <div class="stats-grid">
              <!-- Subtotal -->
              <div class="stat-item">
                <span class="stat-label">Subtotal</span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ formatCurrency(currentOperation.subtotal ?? totalRefundAmount) }}
                </span>
              </div>

              <!-- Tax -->
              <div class="stat-item">
                <span class="stat-label">
                  {{ currentOperation.taxName || 'Tax' }}
                  <span v-if="currentOperation.taxRate" class="tax-rate">({{ currentOperation.taxRate }}%)</span>
                </span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ formatCurrency(currentOperation.taxAmount ?? 0) }}
                </span>
              </div>

              <!-- Items Count -->
              <div class="stat-item">
                <span class="stat-label">Items</span>
                <span :class="['stat-value', { 'value-undone': currentOperation.undoneAt }]">
                  {{ currentOperation.items.length }}
                </span>
              </div>

              <!-- Refund Method -->
              <div class="stat-item">
                <span class="stat-label">Refund Method</span>
                <span :class="['stat-value', 'stat-value-sm', { 'value-undone': currentOperation.undoneAt }]">
                  {{ refundMethodDisplay }}
                </span>
              </div>
            </div>

            <!-- Total Refund Bar -->
            <div :class="['total-bar', 'total-bar-return', { 'total-bar-undone': currentOperation.undoneAt }]">
              <span class="total-label">Total Refund</span>
              <span :class="['total-value', { 'value-undone': currentOperation.undoneAt }]">
                <template v-if="currentOperation.undoneAt">
                  <s>-{{ formatCurrency(currentOperation.grandTotal ?? totalRefundAmount) }}</s>
                </template>
                <template v-else>
                  -{{ formatCurrency(currentOperation.grandTotal ?? totalRefundAmount) }}
                </template>
              </span>
            </div>
          </div>

          <!-- Details and Original Sale Cards Grid -->
          <div class="cards-grid">
            <!-- Operation Details Card -->
            <OperationsOperationDetailsCard :operation="currentOperation" />

            <!-- Original Sale Reference Card -->
            <div class="secondary-card">
              <div class="card-header">
                <div class="card-header-icon original-sale-icon">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span class="card-header-text">Original Sale</span>
              </div>

              <div class="original-sale-content">
                <NuxtLink
                  v-if="currentOperation.originalSaleId"
                  :to="`/operations/${currentOperation.originalSaleId}`"
                  class="original-sale-link"
                >
                  <span class="original-sale-ref">#{{ currentOperation.originalSaleId.slice(0, 8).toUpperCase() }}</span>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </NuxtLink>
                <span v-else class="no-original-sale">Original sale not found</span>

                <!-- Return Reason -->
                <div v-if="currentOperation.returnReason" class="return-reason-section">
                  <span class="return-reason-label">Reason</span>
                  <span class="return-reason-value">{{ currentOperation.returnReason }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Items Section (shared layout, different columns) -->
        <div class="items-section">
          <div class="section-header">
            <h2 class="section-title">{{ isReturnOperation ? 'Returned Items' : 'Items' }}</h2>
          </div>

          <!-- Desktop Table -->
          <div class="hidden sm:block">
            <div class="items-table-container">
              <table class="items-table">
                <thead>
                  <tr>
                    <th class="table-header">Item</th>
                    <th class="table-header text-center">Qty</th>
                    <template v-if="isSaleOperation">
                      <th class="table-header text-right">Unit Price</th>
                      <th class="table-header text-center">Discount</th>
                      <th class="table-header text-right">Line Total</th>
                    </template>
                    <template v-else-if="isReturnOperation">
                      <th class="table-header text-center">Condition</th>
                      <th class="table-header text-right">Refund</th>
                    </template>
                    <template v-else>
                      <th class="table-header text-center">Stock Change</th>
                      <th v-if="costMetrics.hasCostInfo" class="table-header text-right">Cost Info</th>
                    </template>
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
                      <span :class="['qty-badge', getQtyBadgeClass]">
                        {{ getQtyPrefix }}{{ item.quantity }}
                      </span>
                    </td>

                    <!-- Sale columns -->
                    <template v-if="isSaleOperation">
                      <td class="table-cell text-right">
                        <span class="price-value">{{ formatCurrency((item as SaleOperationItem).pricePerItem || 0) }}</span>
                      </td>
                      <td class="table-cell text-center">
                        <span v-if="(item as SaleOperationItem).discount" class="item-discount-badge">
                          -{{ (item as SaleOperationItem).discountType === 'percent' ? (item as SaleOperationItem).discount + '%' : formatCurrency((item as SaleOperationItem).discount!) }}
                        </span>
                        <span v-else class="empty-text">-</span>
                      </td>
                      <td class="table-cell text-right">
                        <span class="line-total">{{ formatCurrency((item as SaleOperationItem).lineTotal || 0) }}</span>
                      </td>
                    </template>

                    <!-- Return columns -->
                    <template v-else-if="isReturnOperation">
                      <td class="table-cell text-center">
                        <span :class="['condition-badge', `condition-badge-${(item as ReturnOperationItem).condition}`]">
                          {{ formatCondition((item as ReturnOperationItem).condition) }}
                        </span>
                      </td>
                      <td class="table-cell text-right">
                        <span class="refund-amount">-{{ formatCurrency((item as ReturnOperationItem).refundAmount || 0) }}</span>
                      </td>
                    </template>

                    <!-- Receiving columns -->
                    <template v-else>
                      <td class="table-cell text-center">
                        <span class="stock-change">{{ item.previousQty }} &rarr; {{ item.newQty }}</span>
                      </td>
                      <td v-if="costMetrics.hasCostInfo" class="table-cell text-right">
                        <div v-if="item.costPerItem !== undefined" class="cost-info">
                          <span class="cost-per-item">{{ formatCurrency(item.costPerItem) }}/unit</span>
                          <span v-if="item.previousCost !== undefined && item.newCost !== undefined" class="cost-change">
                            {{ formatCurrency(item.previousCost) }} &rarr; {{ formatCurrency(item.newCost) }} avg
                          </span>
                        </div>
                        <span v-else class="empty-text">-</span>
                      </td>
                    </template>
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
                <span :class="['qty-badge', getQtyBadgeClass]">
                  {{ getQtyPrefix }}{{ item.quantity }}
                </span>
              </div>
              <div class="item-card-content">
                <!-- Sale-specific fields -->
                <template v-if="isSaleOperation">
                  <div class="item-card-field">
                    <span class="field-label">Unit Price</span>
                    <span class="field-value">{{ formatCurrency((item as SaleOperationItem).pricePerItem || 0) }}</span>
                  </div>
                  <div v-if="(item as SaleOperationItem).discount" class="item-card-field">
                    <span class="field-label">Discount</span>
                    <span class="item-discount-badge">
                      -{{ (item as SaleOperationItem).discountType === 'percent' ? (item as SaleOperationItem).discount + '%' : formatCurrency((item as SaleOperationItem).discount!) }}
                    </span>
                  </div>
                  <div class="item-card-field">
                    <span class="field-label">Line Total</span>
                    <span class="line-total">{{ formatCurrency((item as SaleOperationItem).lineTotal || 0) }}</span>
                  </div>
                </template>

                <!-- Return-specific fields -->
                <template v-else-if="isReturnOperation">
                  <div class="item-card-field">
                    <span class="field-label">Condition</span>
                    <span :class="['condition-badge', `condition-badge-${(item as ReturnOperationItem).condition}`]">
                      {{ formatCondition((item as ReturnOperationItem).condition) }}
                    </span>
                  </div>
                  <div class="item-card-field">
                    <span class="field-label">Refund</span>
                    <span class="refund-amount">-{{ formatCurrency((item as ReturnOperationItem).refundAmount || 0) }}</span>
                  </div>
                </template>

                <!-- Receiving-specific fields -->
                <template v-else>
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
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Returns Section (only for SALE operations) -->
        <div v-if="isSaleOperation" class="returns-section">
          <div class="section-header">
            <div class="section-header-content">
              <h2 class="section-title">Returns</h2>
              <span :class="['return-status-badge', `return-status-${returnStatus.variant}`]">
                {{ returnStatus.text }}
              </span>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="isLoadingReturns" class="returns-loading">
            <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading returns...</span>
          </div>

          <!-- No Returns -->
          <div v-else-if="returnsHistory.length === 0" class="returns-empty">
            <p>No returns have been processed for this sale.</p>
          </div>

          <!-- Returns List -->
          <div v-else class="returns-list">
            <!-- Summary Stats -->
            <div v-if="returnsSummary && returnsSummary.activeReturns > 0" class="returns-summary">
              <div class="returns-summary-stat">
                <span class="returns-summary-label">Total Refunded</span>
                <span class="returns-summary-value returns-summary-refund">-{{ formatCurrency(returnsSummary.totalRefunded) }}</span>
              </div>
              <div class="returns-summary-stat">
                <span class="returns-summary-label">Qty Returned</span>
                <span class="returns-summary-value">{{ returnsSummary.totalReturnedQty }}</span>
              </div>
              <div class="returns-summary-stat">
                <span class="returns-summary-label">Returns</span>
                <span class="returns-summary-value">{{ returnsSummary.activeReturns }}</span>
              </div>
            </div>

            <!-- Returns List Items -->
            <div class="returns-list-items">
              <NuxtLink
                v-for="returnOp in returnsHistory"
                :key="returnOp.id"
                :to="`/operations/${returnOp.id}`"
                :class="['return-item', { 'return-item-undone': returnOp.undoneAt }]"
              >
                <div class="return-item-main">
                  <div class="return-item-icon">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div class="return-item-info">
                    <span class="return-item-ref">#{{ returnOp.id.slice(0, 8).toUpperCase() }}</span>
                    <span class="return-item-date">{{ formatDate(returnOp.date) }}</span>
                  </div>
                </div>
                <div class="return-item-right">
                  <span v-if="returnOp.undoneAt" class="return-item-undone-badge">Undone</span>
                  <span :class="['return-item-amount', { 'return-item-amount-undone': returnOp.undoneAt }]">
                    <template v-if="returnOp.undoneAt"><s>-{{ formatCurrency(returnOp.grandTotal ?? 0) }}</s></template>
                    <template v-else>-{{ formatCurrency(returnOp.grandTotal ?? 0) }}</template>
                  </span>
                  <svg class="return-item-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </NuxtLink>
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

    <!-- Receipt Actions Modal (for reprinting/emailing) -->
    <ReceiptActionsModal
      v-model="showReceiptModal"
      :operation="currentOperation"
      :settings="businessSettings"
      :business-name="businessName"
    />

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
          Are you sure you want to undo this {{ isSaleOperation ? 'sale' : 'receiving' }} operation? This will revert the following inventory changes:
        </p>

        <!-- Changes List -->
        <div v-if="currentOperation" class="changes-list">
          <div v-for="item in currentOperation.items" :key="item.itemId" class="change-item">
            <span class="change-item-name">{{ item.itemName }}</span>
            <span :class="['change-item-qty', isSaleOperation ? 'change-item-qty-add' : '']">
              {{ isSaleOperation ? '+' : '-' }}{{ item.quantity }} units
            </span>
          </div>
        </div>

        <!-- Cost Warning -->
        <p v-if="costMetrics.hasCostInfo" class="cost-warning">
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
import { getPaymentIcon } from '~/components/icons/PaymentIcons'
import type { Operation, SaleOperationItem, ReturnOperationItem, PaymentMethod, RefundMethod } from '~/types/operation'
import type { BusinessSettings } from '~/types/business'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const authStore = useAuthStore()
const { currentOperation, isLoading, fetchOperation, undoOperation } = useOperations()
const { onOperationUndone, offOperationUndone } = useSocket()
const { formatCurrency } = useCurrency()
const { formatDate } = useDate()
const { isPrinting, isSendingEmail } = useReceipt()
const { formatRefundMethod, formatCondition } = useReturnFormatting()
const { formatPaymentMethod: formatPaymentMethodBase, PAYMENT_METHOD_LABELS } = usePaymentFormatting()

// ============================================
// STATE
// ============================================

const showUndoModal = ref(false)
const isUndoing = ref(false)
const showReceiptModal = ref(false)
const businessSettings = ref<BusinessSettings | null>(null)

// Returns history state (for SALE operations)
const returnsHistory = ref<Operation[]>([])
const returnsSummary = ref<{
  totalReturns: number
  activeReturns: number
  undoneReturns: number
  totalReturnedQty: number
  totalRefunded: number
} | null>(null)
const isLoadingReturns = ref(false)

// ============================================
// COMPUTED PROPERTIES
// ============================================

/** Whether the current operation is a SALE type */
const isSaleOperation = computed(() => currentOperation.value?.type === 'SALE')

/** Whether the current operation is a RETURN type */
const isReturnOperation = computed(() => currentOperation.value?.type === 'RETURN')

/** Whether the current operation is a RECEIVING type */
const isReceivingOperation = computed(() => currentOperation.value?.type === 'RECEIVING')

/** Whether the current user can undo this operation */
const canUndo = computed(() => {
  return authStore.isOwner && currentOperation.value && !currentOperation.value.undoneAt
})

/** Show receipt actions only for non-undone SALE and RETURN operations */
const showReceiptActions = computed(() => {
  const type = currentOperation.value?.type
  return (type === 'SALE' || type === 'RETURN') && !currentOperation.value?.undoneAt
})

/** Show "Process Return" button for non-undone SALE operations */
const showProcessReturnButton = computed(() => {
  return isSaleOperation.value && !currentOperation.value?.undoneAt
})

/**
 * Return status for SALE operations.
 * Determines the badge text and style based on return history.
 */
const returnStatus = computed(() => {
  if (!returnsSummary.value || returnsSummary.value.activeReturns === 0) {
    return { text: 'No Returns', variant: 'none' as const }
  }

  // Check if sale is fully returned by comparing total sold qty with returned qty
  const totalSoldQty = currentOperation.value?.totalQty ?? 0
  const totalReturnedQty = returnsSummary.value.totalReturnedQty

  if (totalReturnedQty >= totalSoldQty) {
    return { text: 'Fully Returned', variant: 'full' as const }
  }

  return { text: 'Partially Returned', variant: 'partial' as const }
})

/** Whether any receipt operation is in progress */
const isReceiptProcessing = computed(() => isPrinting.value || isSendingEmail.value)

/** Business name from auth store */
const businessName = computed(() => authStore.businessName || 'Business')

/** Whether operation has split payments */
const hasSplitPayments = computed(() => {
  return currentOperation.value?.payments && currentOperation.value.payments.length > 0
})

/**
 * Consolidated cost metrics for receiving operations.
 * Calculates all cost-related values in a single pass to avoid redundant iterations.
 */
const costMetrics = computed(() => {
  const defaultMetrics = {
    totalCost: null as number | null,
    avgCost: null as number | null,
    itemsWithCostCount: 0,
    hasCostInfo: false,
    costRange: null as { min: number; max: number; isSame: boolean } | null,
  }

  if (!currentOperation.value) return defaultMetrics

  const items = currentOperation.value.items
  let totalCost = 0
  let totalQtyWithCost = 0
  let hasAnyCost = false
  let minCost = Infinity
  let maxCost = -Infinity
  let itemsWithCost = 0

  // Single pass through items to calculate all cost metrics
  for (const item of items) {
    if (item.costPerItem !== undefined) {
      hasAnyCost = true
      itemsWithCost++
      totalCost += item.costPerItem * item.quantity
      totalQtyWithCost += item.quantity

      if (item.costPerItem < minCost) minCost = item.costPerItem
      if (item.costPerItem > maxCost) maxCost = item.costPerItem
    }
  }

  return {
    totalCost: hasAnyCost ? totalCost : null,
    avgCost: totalQtyWithCost > 0 ? totalCost / totalQtyWithCost : null,
    itemsWithCostCount: itemsWithCost,
    hasCostInfo: hasAnyCost,
    costRange: hasAnyCost
      ? { min: minCost, max: maxCost, isSame: minCost === maxCost }
      : null,
  }
})

/** Human-readable title based on operation type */
const operationTitle = computed(() => {
  if (!currentOperation.value) return 'Operation'
  switch (currentOperation.value.type) {
    case 'RECEIVING':
      return 'Receiving Operation'
    case 'SALE':
      return 'Sale Operation'
    case 'RETURN':
      return 'Return Operation'
    default:
      return 'Operation'
  }
})

/** CSS class for the header icon based on operation type */
const headerIconClass = computed(() => {
  if (isSaleOperation.value) return 'header-icon-sale'
  if (isReturnOperation.value) return 'header-icon-return'
  return 'header-icon-receiving'
})

/**
 * Total refund amount for RETURN operations.
 */
const totalRefundAmount = computed(() => {
  if (!isReturnOperation.value || !currentOperation.value) return 0
  return (currentOperation.value.items as ReturnOperationItem[]).reduce(
    (sum, item) => sum + (item.refundAmount || 0),
    0
  )
})

/**
 * Formatted refund method for display.
 */
const refundMethodDisplay = computed(() => {
  const method = currentOperation.value?.refundMethod as RefundMethod | null
  return formatRefundMethod(method, currentOperation.value?.cardType)
})

/**
 * CSS class for qty badge based on operation type.
 */
const getQtyBadgeClass = computed(() => {
  if (isSaleOperation.value) return 'qty-badge-sale'
  if (isReturnOperation.value) return 'qty-badge-return'
  return 'qty-badge-receiving'
})

/**
 * Prefix for qty display based on operation type.
 */
const getQtyPrefix = computed(() => {
  if (isSaleOperation.value) return '-'
  if (isReturnOperation.value) return ''
  return '+'
})

// ============================================
// PAYMENT FORMATTING UTILITIES
// ============================================

/** Payment method badge CSS classes */
const PAYMENT_METHOD_CLASSES: Record<PaymentMethod | string, string> = {
  CASH: 'payment-badge-cash',
  CARD: 'payment-badge-card',
  CHECK: 'payment-badge-check',
  OTHER: 'payment-badge-other',
}

function formatPaymentMethod(method: PaymentMethod | string | null): string {
  if (!method) return '-'
  return formatPaymentMethodBase(method) || method
}

function getPaymentMethodClass(method: PaymentMethod | null): string {
  return method ? (PAYMENT_METHOD_CLASSES[method] || 'payment-badge-other') : 'payment-badge-other'
}

function getPaymentIconComponent(method: PaymentMethod | null) {
  return getPaymentIcon(method)
}

// ============================================
// SOCKET EVENT HANDLERS
// ============================================

/**
 * Handles real-time operation:undone events from socket.
 * Updates the current operation if it matches the undone operation.
 */
function handleOperationUndone(operation: Operation) {
  if (currentOperation.value && currentOperation.value.id === operation.id) {
    currentOperation.value = operation
  }
}

// ============================================
// LIFECYCLE & DATA FETCHING
// ============================================

/**
 * Fetches return history for a SALE operation.
 * Updates returnsHistory and returnsSummary state.
 */
async function fetchReturnsHistory(saleId: string): Promise<void> {
  isLoadingReturns.value = true
  try {
    const response = await $fetch<{
      saleId: string
      returns: Operation[]
      summary: {
        totalReturns: number
        activeReturns: number
        undoneReturns: number
        totalReturnedQty: number
        totalRefunded: number
      }
    }>(`/api/operations/${saleId}/returns`, {
      headers: {
        Authorization: `Bearer ${authStore.accessToken}`,
      },
    })
    returnsHistory.value = response.returns
    returnsSummary.value = response.summary
  } catch (error) {
    console.warn('Failed to fetch returns history:', error)
    returnsHistory.value = []
    returnsSummary.value = null
  } finally {
    isLoadingReturns.value = false
  }
}

onMounted(async () => {
  const id = route.params.id as string
  await fetchOperation(id)

  const operationType = currentOperation.value?.type

  // Fetch business settings for receipt generation (needed for SALE and RETURN operations)
  if (operationType === 'SALE' || operationType === 'RETURN') {
    try {
      businessSettings.value = await $fetch<BusinessSettings>('/api/business/settings', {
        headers: {
          Authorization: `Bearer ${authStore.accessToken}`,
        },
      })
    } catch {
      // If settings fetch fails, continue with defaults
      console.warn('Failed to fetch business settings for receipt')
    }
  }

  // Fetch returns history for SALE operations
  if (operationType === 'SALE') {
    await fetchReturnsHistory(id)
  }

  // Subscribe to real-time operation:undone events
  onOperationUndone(handleOperationUndone)
})

onUnmounted(() => {
  offOperationUndone(handleOperationUndone)
})

// ============================================
// USER ACTIONS
// ============================================

async function handleUndo() {
  if (!currentOperation.value) return

  isUndoing.value = true
  const result = await undoOperation(currentOperation.value.id)

  if (result.success) {
    showUndoModal.value = false
  } else {
    console.error('Failed to undo operation:', result.error)
    alert(result.error || 'Failed to undo operation')
  }

  isUndoing.value = false
}
</script>

<style scoped>
/* ===================================
   PAGE LAYOUT
   =================================== */
.operation-page {
  @apply min-h-screen py-8 px-4;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-4xl mx-auto;
}

.page-header {
  @apply flex items-center justify-between mb-6;
}

.back-link {
  @apply min-h-[44px] inline-flex items-center gap-2 px-2 -ml-2 text-sm font-medium transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

/* ===================================
   HEADER CONTENT
   =================================== */
.header-content {
  @apply flex items-start gap-4 mb-6;
}

.header-icon {
  @apply flex items-center justify-center flex-shrink-0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  color: white;
}

@media (min-width: 768px) {
  .header-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }
}

.header-icon-sale {
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 12px rgba(var(--color-primary-500), 0.3);
}

.header-icon-receiving {
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-600)));
  box-shadow: 0 4px 12px rgba(var(--color-accent-500), 0.3);
}

.header-icon-return {
  background: linear-gradient(135deg, rgb(var(--color-warning-500)), rgb(var(--color-warning-600)));
  box-shadow: 0 4px 12px rgba(var(--color-warning-500), 0.3);
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

/* ===================================
   LOADING STATE
   =================================== */
.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

/* ===================================
   SUMMARY CARDS (Shared between SALE and RECEIVING)
   =================================== */
.summary-card {
  @apply p-5 md:p-6 rounded-2xl mb-6;
}

.summary-card-sale {
  background: rgba(var(--color-primary-500), 0.04);
  border: 1px solid rgba(var(--color-primary-500), 0.12);
}

.summary-card-receiving {
  background: rgba(var(--color-accent-500), 0.04);
  border: 1px solid rgba(var(--color-accent-500), 0.12);
}

.summary-card-return {
  background: rgba(var(--color-warning-500), 0.04);
  border: 1px solid rgba(var(--color-warning-500), 0.12);
}

.summary-card-undone {
  background: rgba(var(--color-surface-200), 0.3);
  border-color: rgba(var(--color-surface-300), 0.5);
}

/* Stats Grid (shared) */
.stats-grid {
  @apply grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4;
}

.stats-grid-3 {
  @apply grid-cols-3 sm:grid-cols-3;
}

.stat-item {
  @apply flex flex-col items-center p-3 rounded-xl text-center;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.5);
}

.stat-label {
  @apply text-xs font-medium mb-1;
  color: rgb(var(--color-surface-500));
}

.tax-rate {
  @apply ml-0.5;
  color: rgb(var(--color-surface-400));
}

.stat-value {
  @apply text-lg font-bold;
  color: rgb(var(--color-surface-800));
}

.stat-value-sm {
  @apply text-base;
}

.discount-value {
  color: rgb(var(--color-accent-600));
}

.qty-accent {
  color: rgb(var(--color-accent-600));
}

.value-undone {
  color: rgb(var(--color-surface-500)) !important;
  text-decoration: line-through;
}

/* Total Bar (shared) */
.total-bar {
  @apply flex items-center justify-between p-4 rounded-xl;
  border-width: 2px;
}

.total-bar-sale {
  background: linear-gradient(135deg, rgba(var(--color-primary-500), 0.1), rgba(var(--color-primary-600), 0.15));
  border-color: rgba(var(--color-primary-500), 0.2);
}

.total-bar-sale .total-label {
  color: rgb(var(--color-primary-700));
}

.total-bar-sale .total-value {
  color: rgb(var(--color-primary-600));
}

.total-bar-receiving {
  background: linear-gradient(135deg, rgba(var(--color-accent-500), 0.1), rgba(var(--color-accent-600), 0.15));
  border-color: rgba(var(--color-accent-500), 0.2);
}

.total-bar-receiving .total-label {
  color: rgb(var(--color-accent-700));
}

.total-bar-receiving .total-value {
  color: rgb(var(--color-accent-600));
}

.total-bar-return {
  background: linear-gradient(135deg, rgba(var(--color-warning-500), 0.1), rgba(var(--color-warning-600), 0.15));
  border-color: rgba(var(--color-warning-500), 0.2);
}

.total-bar-return .total-label {
  color: rgb(var(--color-warning-700));
}

.total-bar-return .total-value {
  color: rgb(var(--color-warning-600));
}

.total-bar-undone {
  background: rgba(var(--color-surface-200), 0.4);
  border-color: rgba(var(--color-surface-300), 0.5);
}

.total-bar-undone .total-label,
.total-bar-undone .total-value {
  color: rgb(var(--color-surface-500));
}

.total-label {
  @apply text-sm font-semibold;
}

.total-value {
  @apply text-xl md:text-2xl font-bold;
}

/* ===================================
   CARDS GRID (Details + Payment/Supplier)
   =================================== */
.cards-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6;
}

/* Secondary Card (Payment/Supplier) */
.secondary-card {
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

.card-header-text {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}

.payment-icon {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.supplier-icon {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

/* ===================================
   PAYMENT CARD STYLES
   =================================== */
.payment-content {
  @apply space-y-4;
}

.payment-method-badge {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg;
}

.payment-method-badge-lg {
  @apply px-3 py-1.5 text-sm;
}

.payment-badge-cash {
  background: rgba(16, 185, 129, 0.1);
  color: rgb(5, 150, 105);
}

.payment-badge-card {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.payment-badge-check {
  background: rgba(245, 158, 11, 0.1);
  color: rgb(217, 119, 6);
}

.payment-badge-other {
  background: rgba(var(--color-surface-500), 0.1);
  color: rgb(var(--color-surface-600));
}

.card-type-label {
  @apply ml-1 font-normal;
}

/* Split Payments */
.split-payments-list {
  @apply space-y-3;
}

.split-payment-entry {
  @apply p-3 rounded-lg;
  background: rgba(var(--color-surface-100), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.6);
}

.split-payment-header {
  @apply flex items-center justify-between gap-3;
}

.split-payment-amount {
  @apply text-sm font-bold;
  color: rgb(var(--color-surface-800));
}

.payment-detail-line {
  @apply text-xs mt-2;
  color: rgb(var(--color-surface-500));
}

/* Single Payment */
.single-payment {
  @apply space-y-3;
}

.payment-info-row {
  @apply flex items-center justify-between py-2 px-3 rounded-lg;
  background: rgba(var(--color-surface-100), 0.6);
}

.payment-info-label {
  @apply text-xs font-medium;
  color: rgb(var(--color-surface-500));
}

.payment-info-value {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.change-row {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
}

.change-value {
  color: rgb(5, 150, 105);
}

.no-payment-info {
  @apply text-sm text-center py-4;
  color: rgb(var(--color-surface-400));
}

/* ===================================
   SUPPLIER CARD STYLES
   =================================== */
.supplier-content {
  @apply space-y-4;
}

.supplier-name-section {
  @apply py-2;
}

.supplier-name-badge {
  @apply inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg;
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-700));
}

.no-supplier-text {
  @apply text-sm italic;
  color: rgb(var(--color-surface-400));
}

.cost-summary-section {
  @apply pt-3;
  border-top: 1px solid rgba(var(--color-surface-200), 0.8);
}

.cost-summary-title {
  @apply text-xs font-semibold uppercase tracking-wider mb-3;
  color: rgb(var(--color-surface-500));
}

.cost-summary-row {
  @apply flex items-center justify-between py-2 px-3 rounded-lg mb-2;
  background: rgba(var(--color-surface-100), 0.6);
}

.cost-summary-row:last-child {
  @apply mb-0;
}

.cost-summary-label {
  @apply text-xs font-medium;
  color: rgb(var(--color-surface-500));
}

.cost-summary-value {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.no-cost-data {
  @apply py-3 text-center;
}

.no-cost-text {
  @apply text-sm;
  color: rgb(var(--color-surface-400));
}

/* ===================================
   ITEMS SECTION
   =================================== */
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
}

.qty-badge-receiving {
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.qty-badge-sale {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.qty-badge-return {
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
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

/* Price and discount styling */
.price-value {
  @apply font-semibold;
  color: rgb(var(--color-surface-700));
}

.item-discount-badge {
  @apply px-2 py-0.5 text-xs font-semibold rounded;
  background: rgba(var(--color-accent-500), 0.1);
  color: rgb(var(--color-accent-600));
}

.line-total {
  @apply font-bold;
  color: rgb(var(--color-primary-600));
}

/* Return-specific styles */
.refund-amount {
  @apply font-bold;
  color: rgb(var(--color-warning-600));
}

.condition-badge {
  @apply px-2.5 py-1 text-xs font-semibold rounded-lg;
}

.condition-badge-resellable {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.condition-badge-damaged,
.condition-badge-defective {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

/* Original Sale Card */
.original-sale-icon {
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.original-sale-content {
  @apply space-y-4;
}

.original-sale-link {
  @apply inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-colors;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-700));
}

.original-sale-link:hover {
  background: rgba(var(--color-warning-500), 0.2);
}

.original-sale-ref {
  @apply text-sm;
}

.no-original-sale {
  @apply text-sm italic;
  color: rgb(var(--color-surface-400));
}

.return-reason-section {
  @apply pt-3;
  border-top: 1px solid rgba(var(--color-surface-200), 0.8);
}

.return-reason-label {
  @apply block text-xs font-medium uppercase tracking-wide mb-1;
  color: rgb(var(--color-surface-500));
}

.return-reason-value {
  @apply block text-sm;
  color: rgb(var(--color-surface-700));
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

/* ===================================
   EMPTY STATE
   =================================== */
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

/* ===================================
   HEADER ACTIONS & BUTTONS
   =================================== */
.header-actions {
  @apply flex items-center gap-2;
}

.receipt-action-btn {
  @apply min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
  border: 1px solid rgba(var(--color-primary-500), 0.2);
}

.receipt-action-btn:hover:not(:disabled) {
  background: rgba(var(--color-primary-500), 0.2);
  border-color: rgba(var(--color-primary-500), 0.3);
}

.receipt-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .receipt-action-btn .btn-label,
  .return-action-btn .btn-label {
    @apply sr-only;
  }
}

.return-action-btn {
  @apply min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
  border: 1px solid rgba(var(--color-warning-500), 0.2);
}

.return-action-btn:hover {
  background: rgba(var(--color-warning-500), 0.2);
  border-color: rgba(var(--color-warning-500), 0.3);
}

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

/* ===================================
   UNDONE STATES
   =================================== */
.undone-badge {
  @apply px-2.5 py-1 text-xs font-semibold rounded-full;
  background: rgba(var(--color-surface-400), 0.15);
  color: rgb(var(--color-surface-500));
}

.operation-undone .header-icon-undone {
  background: linear-gradient(135deg, rgb(var(--color-surface-400)), rgb(var(--color-surface-500)));
  box-shadow: 0 4px 12px rgba(var(--color-surface-400), 0.3);
}

/* ===================================
   UNDO MODAL STYLES
   =================================== */
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

.change-item-qty-add {
  color: rgb(var(--color-accent-600));
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

/* ===================================
   RETURNS SECTION
   =================================== */
.returns-section {
  @apply mt-6 rounded-2xl overflow-hidden;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.returns-section .section-header {
  @apply px-5 py-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.8);
}

.returns-section .section-header-content {
  @apply flex items-center justify-between gap-3;
}

.returns-section .section-title {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}

.return-status-badge {
  @apply px-2.5 py-1 text-xs font-semibold rounded-full;
}

.return-status-none {
  background: rgba(var(--color-surface-400), 0.1);
  color: rgb(var(--color-surface-500));
}

.return-status-partial {
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.return-status-full {
  background: rgba(var(--color-warning-500), 0.15);
  color: rgb(var(--color-warning-700));
}

.returns-loading {
  @apply flex items-center justify-center gap-2 py-8 text-sm;
  color: rgb(var(--color-surface-400));
}

.returns-empty {
  @apply py-8 text-center text-sm;
  color: rgb(var(--color-surface-400));
}

.returns-list {
  @apply p-4;
}

.returns-summary {
  @apply flex items-center justify-center gap-6 mb-4 pb-4;
  border-bottom: 1px solid rgba(var(--color-surface-200), 0.6);
}

.returns-summary-stat {
  @apply flex flex-col items-center text-center;
}

.returns-summary-label {
  @apply text-xs font-medium mb-1;
  color: rgb(var(--color-surface-500));
}

.returns-summary-value {
  @apply text-sm font-bold;
  color: rgb(var(--color-surface-700));
}

.returns-summary-refund {
  color: rgb(var(--color-warning-600));
}

.returns-list-items {
  @apply space-y-2;
}

.return-item {
  @apply flex items-center justify-between p-3 rounded-xl transition-colors;
  background: rgba(var(--color-surface-50), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.6);
}

.return-item:hover {
  background: rgba(var(--color-warning-500), 0.05);
  border-color: rgba(var(--color-warning-500), 0.2);
}

.return-item-undone {
  opacity: 0.6;
}

.return-item-main {
  @apply flex items-center gap-3;
}

.return-item-icon {
  @apply flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0;
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.return-item-info {
  @apply flex flex-col;
}

.return-item-ref {
  @apply text-sm font-semibold;
  color: rgb(var(--color-surface-700));
}

.return-item-date {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.return-item-right {
  @apply flex items-center gap-3;
}

.return-item-undone-badge {
  @apply px-2 py-0.5 text-xs font-medium rounded;
  background: rgba(var(--color-surface-400), 0.1);
  color: rgb(var(--color-surface-500));
}

.return-item-amount {
  @apply text-sm font-bold;
  color: rgb(var(--color-warning-600));
}

.return-item-amount-undone {
  color: rgb(var(--color-surface-500));
}

.return-item-arrow {
  @apply w-4 h-4 flex-shrink-0;
  color: rgb(var(--color-surface-400));
}
</style>
