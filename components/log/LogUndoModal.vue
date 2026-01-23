<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="$emit('close')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="$emit('close')" />

        <!-- Modal -->
        <div class="relative w-full max-w-md rounded-xl shadow-xl" style="background: rgb(var(--color-surface-50))">
          <!-- Header - Conflict Warning Mode -->
          <template v-if="hasConflicts">
            <div class="flex items-center gap-3 p-4 border-b border-surface-200">
              <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: rgba(var(--color-error-500), 0.1);">
                <svg class="w-5 h-5" style="color: rgb(var(--color-error-500));" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg font-semibold text-surface-900">Values Have Changed Since This Update</h2>
              </div>
            </div>
          </template>

          <!-- Header - Normal Mode -->
          <template v-else>
            <div class="flex items-center gap-3 p-4 border-b border-surface-200">
              <div class="w-10 h-10 rounded-full flex items-center justify-center" style="background: rgba(var(--color-warning-500), 0.1);">
                <svg class="w-5 h-5" style="color: rgb(var(--color-warning-500));" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
              <div>
                <h2 class="text-lg font-semibold text-surface-900">{{ log.action === 'ITEM_DELETED' ? 'Restore Deleted Item?' : 'Revert This Change?' }}</h2>
              </div>
            </div>
          </template>

          <!-- Content -->
          <div class="p-4">
            <!-- Conflict Warning Content -->
            <template v-if="hasConflicts && conflicts && conflicts.length > 0">
              <p class="text-surface-700 mb-4">
                The item has been modified after this update. Reverting will overwrite the current values.
              </p>

              <!-- Conflict Table -->
              <div class="bg-surface-50 border border-surface-200 rounded-lg overflow-hidden mb-4">
                <!-- Table Header -->
                <div class="grid grid-cols-3 bg-surface-100/60">
                  <div class="px-3 py-2 text-xs font-semibold text-surface-500 uppercase tracking-wide">Field</div>
                  <div class="px-3 py-2 text-xs font-semibold text-surface-500 uppercase tracking-wide">Current Value</div>
                  <div class="will-become-header px-3 py-2 text-xs font-semibold uppercase tracking-wide border-l-2">Will Revert To</div>
                </div>

                <!-- Table Rows -->
                <div
                  v-for="conflict in conflicts"
                  :key="conflict.fieldId"
                  class="grid grid-cols-3 border-t border-surface-200"
                >
                  <div class="px-3 py-2.5 text-sm font-medium text-surface-700">{{ conflict.fieldName }}</div>
                  <div class="px-3 py-2.5 text-sm text-surface-600">{{ formatValue(conflict.currentValue) }}</div>
                  <div class="will-become-cell px-3 py-2.5 text-sm border-l-2">{{ formatValue(conflict.willBecomeValue) }}</div>
                </div>
              </div>

              <!-- Info text below table -->
              <p class="text-sm text-surface-600 mb-4">
                The current values shown above will be replaced. The original update entry will be marked as undone.
              </p>
            </template>

            <!-- Normal Confirmation Content -->
            <template v-else>
              <p class="text-surface-700 mb-4 whitespace-pre-line">{{ log.action === 'ITEM_DELETED'
                ? 'This will restore the item to its state before deletion.\n\nThe deletion entry in your activity log will be marked as undone.'
                : 'This will revert the item to its previous values.\n\nThe update entry in your activity log will be marked as undone.' }}</p>
            </template>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 p-4 border-t border-surface-200">
            <button
              class="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-200 rounded-lg transition-colors"
              :disabled="loading"
              @click="$emit('close')"
            >
              {{ hasConflicts ? 'Keep Current Values' : 'Cancel' }}
            </button>

            <!-- Danger button for conflicts -->
            <button
              v-if="hasConflicts"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style="background: rgb(var(--color-error-600));"
              onmouseover="this.style.background='rgb(var(--color-error-700))'"
              onmouseout="this.style.background='rgb(var(--color-error-600))'"
              :disabled="loading"
              @click="$emit('confirm')"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {{ loading ? 'Reverting...' : 'Overwrite and Revert' }}
            </button>

            <!-- Normal button without conflicts -->
            <button
              v-else
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style="background: rgb(var(--color-warning-600));"
              onmouseover="this.style.background='rgb(var(--color-warning-700))'"
              onmouseout="this.style.background='rgb(var(--color-warning-600))'"
              :disabled="loading"
              @click="$emit('confirm')"
            >
              <svg v-if="loading" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              {{ loading ? (log.action === 'ITEM_DELETED' ? 'Restoring...' : 'Reverting...') : (log.action === 'ITEM_DELETED' ? 'Restore Item' : 'Revert Change') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { InventoryLog, LogChange, SchemaChange, ConflictField } from '~/types/log'

interface Props {
  isOpen: boolean
  log: InventoryLog
  loading?: boolean
  conflicts?: ConflictField[]
  hasConflicts?: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'confirm'): void
}

withDefaults(defineProps<Props>(), {
  loading: false,
  conflicts: () => [],
  hasConflicts: false,
})
defineEmits<Emits>()

const { getActionLabel, getActionColors, getLogSummary, getRelativeTime, formatValue } = useLogHelpers()
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}

/*
 * Warning/Danger styling using CSS variables for theme support.
 * This approach avoids specificity issues with :global() selectors in scoped styles.
 * Light theme values are defined as defaults, dark theme overrides in separate block.
 */

/* Light theme defaults (CSS variable definitions) */
.will-become-header,
.will-become-cell,
.warning-callout {
  --warning-bg: rgb(254 242 242 / 0.5);
  --warning-bg-solid: rgb(254 242 242);
  --warning-border: rgb(254 202 202);
  --warning-text: rgb(220 38 38);
  --warning-text-dark: rgb(185 28 28);
}

/* Conflict table "Will Become" column */
.will-become-header {
  background-color: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}

.will-become-cell {
  background-color: var(--warning-bg);
  border-color: var(--warning-border);
  color: var(--warning-text);
}

/* Warning callout */
.warning-callout {
  background-color: var(--warning-bg-solid);
  border-color: var(--warning-border);
}

.warning-callout-icon {
  color: var(--warning-text);
}

.warning-callout-text {
  color: var(--warning-text-dark);
}
</style>

<!--
  Unscoped styles for dark theme CSS variable overrides.
  These must be unscoped to properly target html[data-theme] with correct specificity.
-->
<style>
html[data-theme="midnight"] .will-become-header,
html[data-theme="midnight"] .will-become-cell,
html[data-theme="midnight"] .warning-callout {
  --warning-bg: rgb(127 29 29 / 0.2);
  --warning-bg-solid: rgb(127 29 29 / 0.2);
  --warning-border: rgb(127 29 29 / 0.4);
  --warning-text: rgb(252 165 165);
  --warning-text-dark: rgb(252 165 165);
}
</style>
