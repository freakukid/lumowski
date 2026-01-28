<template>
  <div class="refund-method-selector">
    <label class="selector-label">Refund Method</label>

    <!-- Method Options -->
    <div class="refund-method-options">
      <button
        type="button"
        :class="['refund-method-option', { 'active': modelValue === 'CASH' }]"
        @click="$emit('update:modelValue', 'CASH')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span class="refund-method-label">Cash</span>
      </button>

      <button
        type="button"
        :class="['refund-method-option', { 'active': modelValue === 'CARD' }]"
        @click="$emit('update:modelValue', 'CARD')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span class="refund-method-label">Card</span>
      </button>

      <button
        type="button"
        :class="['refund-method-option', { 'active': modelValue === 'ORIGINAL_METHOD' }]"
        @click="$emit('update:modelValue', 'ORIGINAL_METHOD')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span class="refund-method-label">{{ originalMethodLabel }}</span>
      </button>
    </div>

    <!-- Card Type Sub-selector -->
    <Transition name="slide-fade">
      <div v-if="modelValue === 'CARD'" class="card-type-section">
        <label class="card-type-label">Card Type</label>
        <div class="card-type-options">
          <button
            v-for="type in cardTypes"
            :key="type.value"
            type="button"
            :class="['card-type-option', { 'active': cardType === type.value }]"
            @click="$emit('update:cardType', type.value)"
          >
            {{ type.label }}
          </button>
        </div>
        <p v-if="showCardTypeError" class="card-type-error">
          Please select a card type
        </p>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { PaymentMethod, CardType, RefundMethod } from '~/types/operation'
import { CARD_TYPES } from '~/composables/usePaymentFormatting'

interface Props {
  /** Currently selected refund method */
  modelValue: RefundMethod
  /** Original payment method from the sale */
  originalMethod: PaymentMethod | null
  /** Original card type (if applicable) */
  originalCardType?: CardType | null
  /** Selected card type for CARD refunds */
  cardType?: CardType
  /** Show validation error for missing card type */
  showCardTypeError?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showCardTypeError: false,
})

defineEmits<{
  'update:modelValue': [value: RefundMethod]
  'update:cardType': [value: CardType | undefined]
}>()

// Use the centralized card types configuration
const cardTypes = CARD_TYPES

/**
 * Label for the "Original Method" option.
 */
const originalMethodLabel = computed(() => {
  if (!props.originalMethod) return 'Original'

  switch (props.originalMethod) {
    case 'CASH':
      return 'Original (Cash)'
    case 'CARD':
      return props.originalCardType
        ? `Original (${props.originalCardType})`
        : 'Original (Card)'
    case 'CHECK':
      return 'Original (Check)'
    default:
      return 'Original'
  }
})
</script>

<style scoped>
.refund-method-selector {
  @apply w-full;
}

.selector-label {
  @apply text-sm font-medium mb-2 block;
  color: rgb(var(--color-surface-700));
}

.refund-method-options {
  @apply grid grid-cols-3 gap-2;
}

.refund-method-option {
  @apply flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all min-h-[44px];
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-500));
}

.refund-method-option:hover {
  background: rgba(var(--color-surface-200), 0.5);
  border-color: rgba(var(--color-surface-300), 0.8);
  color: rgb(var(--color-surface-600));
}

.refund-method-option.active {
  background: rgba(var(--color-warning-500), 0.08);
  border-color: rgb(var(--color-warning-500));
  color: rgb(var(--color-warning-600));
}

.refund-method-label {
  @apply text-xs font-semibold text-center;
}

/* Card type sub-selector */
.card-type-section {
  @apply mt-3 p-3 rounded-xl;
  background: rgba(var(--color-surface-50), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.6);
}

.card-type-label {
  @apply text-xs font-medium mb-2 block;
  color: rgb(var(--color-surface-500));
}

.card-type-options {
  @apply grid grid-cols-2 gap-2;
}

@media (min-width: 640px) {
  .card-type-options {
    @apply flex flex-nowrap;
  }

  .card-type-option {
    @apply flex-1;
  }
}

.card-type-option {
  @apply flex items-center justify-center py-2.5 px-3 rounded-lg transition-all min-h-[44px] text-sm font-medium;
  background: rgba(var(--color-surface-100), 0.5);
  border: 2px solid rgba(var(--color-surface-200), 0.8);
  color: rgb(var(--color-surface-500));
}

.card-type-option:hover {
  background: rgba(var(--color-surface-200), 0.5);
  border-color: rgba(var(--color-surface-300), 0.8);
  color: rgb(var(--color-surface-600));
}

.card-type-option.active {
  background: rgba(var(--color-warning-500), 0.08);
  border-color: rgb(var(--color-warning-500));
  color: rgb(var(--color-warning-600));
}

.card-type-error {
  @apply mt-2 text-xs;
  color: rgb(var(--color-error-500));
}

/* Slide-fade transition */
.slide-fade-enter-active {
  transition: all 200ms ease-out;
}

.slide-fade-leave-active {
  transition: all 150ms ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
