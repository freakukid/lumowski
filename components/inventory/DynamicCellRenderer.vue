<template>
  <span :class="cellClass">
    <!-- Text -->
    <template v-if="column.type === 'text'">{{ displayValue }}</template>

    <!-- Number -->
    <template v-else-if="column.type === 'number'">
      <span v-if="column.role === 'quantity'" :class="quantityClass">
        {{ displayValue }}
      </span>
      <span v-else>{{ displayValue }}</span>
    </template>

    <!-- Currency -->
    <template v-else-if="column.type === 'currency'">
      {{ formatCurrency(value) }}
    </template>

    <!-- Date -->
    <template v-else-if="column.type === 'date'">
      {{ formatDate(value) }}
    </template>

    <!-- Select -->
    <template v-else-if="column.type === 'select'">
      <span class="select-badge">{{ displayValue }}</span>
    </template>

    <!-- Fallback -->
    <template v-else>{{ displayValue }}</template>
  </span>
</template>

<script setup lang="ts">
import type { ColumnDefinition } from '~/types/schema'

const props = defineProps<{
  value: unknown
  column: ColumnDefinition
  isLowStock?: boolean
}>()

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined || props.value === '') {
    return '-'
  }
  if (props.column.type === 'number') {
    return Number(props.value).toLocaleString()
  }
  return String(props.value)
})

const formatCurrency = (val: unknown) => {
  if (val === null || val === undefined || val === '') return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(val))
}

const formatDate = (val: unknown) => {
  if (!val) return '-'
  const date = new Date(String(val))
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const cellClass = computed(() => {
  return ''
})

const quantityClass = computed(() => {
  if (props.column.role === 'quantity') {
    if (props.isLowStock) {
      return 'quantity-badge quantity-low'
    }
    return 'quantity-badge quantity-ok'
  }
  return ''
})
</script>

<style scoped>
.quantity-badge {
  @apply px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full;
}

.quantity-low {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-600));
}

.quantity-ok {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.select-badge {
  @apply px-2 py-0.5 text-xs font-medium rounded;
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}
</style>
