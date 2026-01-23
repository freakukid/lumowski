<template>
  <NuxtLink
    :to="`/log/${log.id}`"
    class="block rounded-lg shadow-sm border border-surface-200 p-4 hover:shadow-md transition-shadow"
    style="background: rgb(var(--color-surface-50));"
    :class="{ 'opacity-60': log.undoneAt }"
  >
    <!-- Header: Action + Time -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <LogActionBadge :action="log.action" />
      <span class="text-xs text-surface-500" :title="formatDate(log.createdAt)">
        {{ getRelativeTime(log.createdAt) }}
      </span>
    </div>

    <!-- Summary -->
    <p class="text-sm text-surface-900 mb-3">
      {{ getLogSummary(log.action, log.itemName, log.changes as LogChange[] | null, log.schemaChanges as SchemaChange[] | null) }}
    </p>

    <!-- Changes preview (for updates) -->
    <div v-if="log.action === 'ITEM_UPDATED' && log.changes && (log.changes as LogChange[]).length > 0" class="mb-3">
      <LogDiffView :changes="(log.changes as LogChange[]).slice(0, 2)" />
      <span v-if="(log.changes as LogChange[]).length > 2" class="text-xs text-surface-500">
        +{{ (log.changes as LogChange[]).length - 2 }} more changes
      </span>
    </div>

    <!-- Footer: User + Undo -->
    <div class="flex items-center justify-between pt-3 border-t border-surface-200">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
          <span class="text-xs font-medium text-primary-600">
            {{ log.user.name.charAt(0).toUpperCase() }}
          </span>
        </div>
        <span class="text-sm text-surface-700">{{ log.user.name }}</span>
      </div>

      <button
        v-if="canUndo(log)"
        class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors"
        style="background: rgba(var(--color-warning-500), 0.15); color: rgb(var(--color-warning-700));"
        @click.prevent="$emit('undo', log)"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
        Undo
      </button>
    </div>

    <!-- Undone indicator -->
    <div v-if="log.undoneAt" class="mt-2 pt-2 border-t border-surface-200">
      <span class="text-xs" style="color: rgb(var(--color-warning-600));">
        Undone by {{ log.undoneBy?.name || 'Unknown' }} on {{ formatDate(log.undoneAt) }}
      </span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { InventoryLog, LogChange, SchemaChange } from '~/types/log'

interface Props {
  log: InventoryLog
}

interface Emits {
  (e: 'undo', log: InventoryLog): void
}

defineProps<Props>()
defineEmits<Emits>()

const { getActionLabel, getActionColors, getLogSummary, formatDate, getRelativeTime, canUndo } = useLogHelpers()
</script>
