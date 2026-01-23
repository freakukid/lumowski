<template>
  <div class="space-y-2">
    <div
      v-for="change in changes"
      :key="change.field"
      class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm"
    >
      <span class="font-medium text-surface-700 min-w-0 shrink-0">{{ change.fieldName }}:</span>
      <div class="flex items-center gap-2 min-w-0 flex-wrap">
        <span class="inline-flex items-center px-2 py-0.5 rounded line-through" style="background: rgba(var(--color-error-500), 0.1); color: rgb(var(--color-error-600));">
          {{ formatValue(change.oldValue) }}
        </span>
        <svg class="w-4 h-4 text-surface-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <span class="inline-flex items-center px-2 py-0.5 rounded" style="background: rgba(var(--color-success-500), 0.1); color: rgb(var(--color-success-600));">
          {{ formatValue(change.newValue) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LogChange } from '~/types/log'

interface Props {
  changes: LogChange[]
}

defineProps<Props>()

const { formatValue } = useLogHelpers()
</script>
