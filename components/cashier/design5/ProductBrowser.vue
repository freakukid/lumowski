<template>
  <div class="product-browser">
    <!-- Search Bar -->
    <div class="browser-search">
      <div class="search-wrapper">
        <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="search"
          :value="searchQuery"
          placeholder="Search items..."
          class="search-input"
          @input="emit('update:search-query', ($event.target as HTMLInputElement).value)"
        />
        <kbd v-if="showKeyboardHints && !searchQuery" class="search-hint">/</kbd>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="category-tabs">
      <button
        v-for="category in categories"
        :key="category"
        :class="['category-tab', { active: selectedCategory === category }]"
        @click="emit('update:selected-category', category)"
      >
        {{ category }}
      </button>
    </div>

    <!-- Product Grid -->
    <div class="product-grid">
      <div v-if="products.length === 0" class="empty-state">
        <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p>No products found</p>
      </div>

      <div
        v-for="(product, index) in products"
        :key="product.id"
        :class="['product-card', { 'in-cart': isInCart(product.id), 'out-of-stock': isOutOfStock(product) }]"
      >
        <!-- Keyboard Hint Badge -->
        <div v-if="showKeyboardHints && index < 9" class="keyboard-hint-badge">
          {{ index + 1 }}
        </div>

        <!-- In Cart Badge -->
        <div v-if="isInCart(product.id)" class="in-cart-badge">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <!-- Product Image Placeholder -->
        <div class="product-image">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>

        <!-- Product Info -->
        <div class="product-info">
          <h3 class="product-name">{{ product.name }}</h3>
          <div class="product-meta">
            <span :class="['product-stock', { 'low': isLowStock(product), 'out': isOutOfStock(product) }]">
              {{ isOutOfStock(product) ? 'Out of stock' : `Stock: ${product.stock}` }}
            </span>
          </div>
          <p class="product-price">{{ formatCurrency(product.price) }}</p>
        </div>

        <!-- Add Button -->
        <button
          class="add-btn"
          :disabled="isOutOfStock(product)"
          @click.stop="emit('add-item', product.id)"
        >
          <svg v-if="!isInCart(product.id)" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ isInCart(product.id) ? 'Add More' : 'Add' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ProductBrowser Component
 *
 * Displays a searchable, filterable grid of products that can be added to the cart.
 * Supports keyboard shortcuts for power users.
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

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  products: Product[]
  cartItemIds: string[]
  searchQuery: string
  selectedCategory: string
  categories: string[]
  showKeyboardHints?: boolean
}>()

const emit = defineEmits<{
  'update:search-query': [value: string]
  'update:selected-category': [value: string]
  'add-item': [productId: string]
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
 * Check if a product is in the cart.
 */
function isInCart(productId: string): boolean {
  return props.cartItemIds.includes(productId)
}

/**
 * Check if a product has low stock (5 or fewer).
 */
function isLowStock(product: Product): boolean {
  return product.stock > 0 && product.stock <= 5
}

/**
 * Check if a product is out of stock.
 */
function isOutOfStock(product: Product): boolean {
  return product.stock <= 0
}
</script>

<style scoped>
/* ============================================================================
   Product Browser
   ============================================================================ */

.product-browser {
  @apply h-full flex flex-col p-4;
}

.browser-search {
  @apply mb-4;
}

.search-wrapper {
  @apply relative;
}

.search-icon {
  @apply absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none;
  color: rgb(var(--color-surface-400));
}

.search-input {
  @apply w-full pl-11 pr-12 min-h-[44px] rounded-xl text-sm font-medium outline-none transition-all;
  background: rgba(var(--color-surface-50), 0.8);
  border: 2px solid rgba(var(--color-surface-300), 0.5);
  color: rgb(var(--color-surface-900));
}

.search-input::placeholder {
  color: rgb(var(--color-surface-400));
}

.search-input:focus {
  border-color: rgb(var(--color-primary-500));
  background: rgb(var(--color-surface-50));
  box-shadow: var(--focus-ring);
}

.search-hint {
  @apply absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-xs font-mono rounded;
  background: rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-500));
}

/* Category Tabs */
.category-tabs {
  @apply flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1;
  scrollbar-width: none;
}

.category-tabs::-webkit-scrollbar {
  display: none;
}

.category-tab {
  @apply px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all min-h-[40px];
  background: rgba(var(--color-surface-100), 0.5);
  color: rgb(var(--color-surface-600));
  border: 1px solid transparent;
}

.category-tab:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.category-tab.active {
  background: rgba(var(--color-primary-500), 0.08);
  color: rgb(var(--color-primary-600));
  border-color: rgba(var(--color-primary-500), 0.3);
}

/* Product Grid */
.product-grid {
  @apply flex-1 overflow-y-auto grid gap-3;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  align-content: start;
}

@media (min-width: 1280px) {
  .product-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

.empty-state {
  @apply col-span-full py-12 text-center;
  color: rgb(var(--color-surface-400));
}

/* Product Card */
.product-card {
  @apply relative flex flex-col p-3 rounded-xl transition-all;
  background: rgba(var(--color-surface-100), 0.7);
  border: 2px solid transparent;
}

.product-card:hover {
  background: rgba(var(--color-surface-200), 0.5);
}

.product-card.in-cart {
  background: rgba(var(--color-primary-500), 0.06);
  border-color: rgba(var(--color-primary-500), 0.2);
}

.product-card.out-of-stock {
  @apply opacity-60;
}

.keyboard-hint-badge {
  @apply absolute top-2 left-2 w-5 h-5 flex items-center justify-center text-xs font-bold rounded;
  background: rgba(var(--color-surface-900), 0.8);
  color: white;
}

.in-cart-badge {
  @apply absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full;
  background: rgb(var(--color-success-500));
  color: white;
}

.product-image {
  @apply flex items-center justify-center h-16 mb-2 rounded-lg;
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-400));
}

.product-info {
  @apply flex-1 mb-2;
}

.product-name {
  @apply text-sm font-semibold truncate mb-1;
  color: rgb(var(--color-surface-900));
}

.product-meta {
  @apply mb-1;
}

.product-stock {
  @apply text-xs;
  color: rgb(var(--color-surface-500));
}

.product-stock.low {
  color: rgb(var(--color-warning-600));
}

.product-stock.out {
  color: rgb(var(--color-error-500));
}

.product-price {
  @apply text-base font-bold;
  color: rgb(var(--color-primary-600));
}

.add-btn {
  @apply flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px];
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.add-btn:hover:not(:disabled) {
  background: rgba(var(--color-primary-500), 0.2);
}

.add-btn:disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>
