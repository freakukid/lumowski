<template>
  <div class="log-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <NuxtLink to="/log" class="back-link" aria-label="Back to activity log">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Activity Log</span>
        </NuxtLink>

        <!-- Undo Button (visible only for undoable logs that haven't been undone) -->
        <button
          v-if="canUndoLog"
          class="undo-button"
          :disabled="isUndoing || isCheckingConflicts"
          aria-label="Undo this action"
          @click="openUndoModal"
        >
          <svg v-if="isCheckingConflicts" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <span>{{ isCheckingConflicts ? 'Checking...' : 'Undo' }}</span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !currentLog" class="loading-state" aria-busy="true" aria-label="Loading">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading log entry...</p>
      </div>

      <!-- Log Details -->
      <div v-else-if="currentLog" :class="{ 'log-undone': currentLog.undoneAt }">
        <!-- Header Content -->
        <div class="header-content">
          <!-- Header Icon -->
          <div :class="['header-icon', headerIconClass, { 'header-icon-undone': currentLog.undoneAt }]">
            <!-- Plus icon for ITEM_CREATED -->
            <svg v-if="currentLog.action === 'ITEM_CREATED'" class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
            </svg>
            <!-- Edit/pencil icon for ITEM_UPDATED -->
            <svg v-else-if="currentLog.action === 'ITEM_UPDATED'" class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <!-- Trash icon for ITEM_DELETED -->
            <svg v-else-if="currentLog.action === 'ITEM_DELETED'" class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <!-- Grid/layout icon for SCHEMA_UPDATED -->
            <svg v-else-if="currentLog.action === 'SCHEMA_UPDATED'" class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>

          <div class="header-text">
            <div class="title-row">
              <h1 class="page-title">{{ logTitle }}</h1>
              <LogActionBadge :action="currentLog.action" />
              <span v-if="currentLog.undoneAt" class="undone-badge">Undone</span>
            </div>
            <p class="page-subtitle">{{ formatDate(currentLog.createdAt) }}</p>
          </div>
        </div>

        <!-- Details Card -->
        <div class="details-card">
          <div class="card-header">
            <div class="card-header-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span class="card-header-text">Log Details</span>
          </div>

          <dl class="details-list">
            <!-- Summary -->
            <div class="detail-row">
              <dt class="detail-label">Summary</dt>
              <dd class="detail-value">{{ logSummary }}</dd>
            </div>

            <!-- User -->
            <div class="detail-row">
              <dt class="detail-label">User</dt>
              <dd class="detail-value">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
                    <span class="text-xs font-medium text-primary-600">
                      {{ currentLog.user?.name?.charAt(0)?.toUpperCase() || '' }}
                    </span>
                  </div>
                  <span>{{ currentLog.user.name }}</span>
                </div>
              </dd>
            </div>

            <!-- Time -->
            <div class="detail-row">
              <dt class="detail-label">Time</dt>
              <dd class="detail-value">{{ formatDate(currentLog.createdAt) }}</dd>
            </div>

            <!-- Item Link (for item-related actions) -->
            <div v-if="currentLog.itemId && currentLog.action !== 'ITEM_DELETED'" class="detail-row">
              <dt class="detail-label">Item</dt>
              <dd class="detail-value">
                <NuxtLink :to="`/inventory/${currentLog.itemId}`" class="item-link">
                  {{ currentLog.itemName || 'View Item' }}
                </NuxtLink>
              </dd>
            </div>

            <!-- Undone information -->
            <template v-if="currentLog.undoneAt">
              <div class="detail-row undone-detail">
                <dt class="detail-label">Undone At</dt>
                <dd class="detail-value">{{ formatDate(currentLog.undoneAt) }}</dd>
              </div>

              <div v-if="currentLog.undoneBy" class="detail-row undone-detail">
                <dt class="detail-label">Undone By</dt>
                <dd class="detail-value">{{ currentLog.undoneBy.name }}</dd>
              </div>
            </template>
          </dl>
        </div>

        <!-- Changes Section (for ITEM_UPDATED) -->
        <div v-if="currentLog.action === 'ITEM_UPDATED' && currentLog.changes && (currentLog.changes as LogChange[]).length > 0" class="changes-card">
          <div class="card-header">
            <div class="card-header-icon changes-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span class="card-header-text">Field Changes</span>
          </div>

          <div class="changes-content">
            <LogDiffView :changes="currentLog.changes as LogChange[]" />
          </div>
        </div>

        <!-- Schema Changes Section (for SCHEMA_UPDATED) -->
        <div v-if="currentLog.action === 'SCHEMA_UPDATED' && currentLog.schemaChanges && (currentLog.schemaChanges as SchemaChange[]).length > 0" class="changes-card schema-changes-card">
          <div class="card-header">
            <div class="card-header-icon schema-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <span class="card-header-text">Schema Changes</span>
          </div>

          <div class="schema-changes-content">
            <div
              v-for="(change, idx) in (currentLog.schemaChanges as SchemaChange[])"
              :key="idx"
              class="schema-change-item"
            >
              <span
                class="schema-change-badge"
                :class="{
                  'schema-change-added': change.type === 'added',
                  'schema-change-removed': change.type === 'removed',
                  'schema-change-modified': change.type === 'modified',
                }"
              >
                {{ change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~' }}
              </span>
              <div>
                <span class="schema-column-name">{{ change.columnName }}</span>
                <span v-if="change.details" class="schema-change-details">({{ change.details }})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Deleted Item Snapshot Section (for ITEM_DELETED) -->
        <div v-if="currentLog.action === 'ITEM_DELETED' && currentLog.snapshot" class="changes-card snapshot-card">
          <div class="card-header">
            <div class="card-header-icon snapshot-icon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
            <span class="card-header-text">Deleted Item Data</span>
          </div>

          <div class="snapshot-content">
            <LogDeletedItemSnapshot :data="(currentLog.snapshot as { data: Record<string, unknown> }).data" />
          </div>
        </div>

        <!-- Undo Info Banner (for undone logs) -->
        <div v-if="currentLog.undoneAt" class="undo-info-banner">
          <div class="undo-info-header">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span class="undo-info-title">This action was undone</span>
          </div>
          <p class="undo-info-text">
            By {{ currentLog.undoneBy?.name || 'Unknown' }} on {{ formatDate(currentLog.undoneAt) }}
          </p>
        </div>
      </div>

      <!-- Not Found -->
      <div v-else class="empty-state">
        <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 class="text-xl font-bold mb-2">Log Entry Not Found</h2>
        <p class="mb-4">The log entry you're looking for doesn't exist or has been deleted.</p>
        <NuxtLink to="/log" class="back-btn">Back to Activity Log</NuxtLink>
      </div>
    </div>

    <!-- Undo Confirmation Modal -->
    <LogUndoModal
      v-if="currentLog"
      :is-open="showUndoModal"
      :log="currentLog"
      :loading="isUndoing"
      :conflicts="undoConflicts"
      :has-conflicts="hasUndoConflicts"
      @close="closeUndoModal"
      @confirm="handleUndo"
    />
  </div>
</template>

<script setup lang="ts">
import type { InventoryLog, LogChange, SchemaChange, ConflictField } from '~/types/log'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { loading, fetchLog, undoLog, checkUndoConflicts } = useLog()
const { getLogSummary, formatDate, canUndo } = useLogHelpers()

// Current log state
const currentLog = ref<InventoryLog | null>(null)

// Undo modal state
const showUndoModal = ref(false)
const isUndoing = ref(false)
const isCheckingConflicts = ref(false)

// Conflict state
const undoConflicts = ref<ConflictField[]>([])
const hasUndoConflicts = ref(false)

/**
 * Computed: can the current log be undone
 */
const canUndoLog = computed(() => {
  return currentLog.value && canUndo(currentLog.value)
})

/**
 * Generates a human-readable title based on log action
 */
const logTitle = computed(() => {
  if (!currentLog.value) return 'Log Entry'
  switch (currentLog.value.action) {
    case 'ITEM_CREATED':
      return 'Item Created'
    case 'ITEM_UPDATED':
      return 'Item Updated'
    case 'ITEM_DELETED':
      return 'Item Deleted'
    case 'SCHEMA_UPDATED':
      return 'Schema Updated'
    default:
      return 'Log Entry'
  }
})

/**
 * Get the log summary for display
 */
const logSummary = computed(() => {
  if (!currentLog.value) return ''
  return getLogSummary(
    currentLog.value.action,
    currentLog.value.itemName,
    currentLog.value.changes as LogChange[] | null,
    currentLog.value.schemaChanges as SchemaChange[] | null
  )
})

/**
 * Header icon class based on action type
 */
const headerIconClass = computed(() => {
  if (!currentLog.value) return ''
  switch (currentLog.value.action) {
    case 'ITEM_CREATED':
      return 'header-icon-green'
    case 'ITEM_UPDATED':
      return 'header-icon-blue'
    case 'ITEM_DELETED':
      return 'header-icon-red'
    case 'SCHEMA_UPDATED':
      return 'header-icon-purple'
    default:
      return ''
  }
})

/**
 * Fetch log on mount
 */
onMounted(async () => {
  const id = route.params.id as string
  const log = await fetchLog(id)
  if (log) {
    currentLog.value = log
  }
})

/**
 * Opens the undo modal after checking for conflicts
 */
async function openUndoModal() {
  if (!currentLog.value) return

  // Reset conflict state
  undoConflicts.value = []
  hasUndoConflicts.value = false
  isCheckingConflicts.value = true

  // Check for conflicts before showing the modal
  const conflictResult = await checkUndoConflicts(currentLog.value.id)

  isCheckingConflicts.value = false

  if (conflictResult) {
    undoConflicts.value = conflictResult.conflicts
    hasUndoConflicts.value = conflictResult.hasConflicts
  }

  // Show the modal regardless of conflicts
  showUndoModal.value = true
}

/**
 * Closes the undo modal and resets conflict state
 */
function closeUndoModal() {
  showUndoModal.value = false
  undoConflicts.value = []
  hasUndoConflicts.value = false
}

/**
 * Handles the undo action after user confirms
 */
async function handleUndo() {
  if (!currentLog.value) return

  isUndoing.value = true
  const result = await undoLog(currentLog.value.id)

  if (result && result.success) {
    showUndoModal.value = false
    // Reset conflict state
    undoConflicts.value = []
    hasUndoConflicts.value = false
    // Keep isUndoing true while refreshing the log to show undone state
    const updatedLog = await fetchLog(currentLog.value.id)
    if (updatedLog) {
      currentLog.value = updatedLog
    }
    isUndoing.value = false
  } else {
    isUndoing.value = false
    const errorMessage = result?.message || 'Failed to undo action. Please try again.'
    console.error('Failed to undo action:', errorMessage)
    alert(errorMessage)
  }
}
</script>

<style scoped>
.log-page {
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

/* Header Content */
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

.header-icon-green {
  background: linear-gradient(135deg, rgb(var(--color-accent-500)), rgb(var(--color-accent-600)));
  box-shadow: 0 4px 12px rgba(var(--color-accent-500), 0.3);
}

.header-icon-blue {
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  box-shadow: 0 4px 12px rgba(var(--color-primary-500), 0.3);
}

.header-icon-red {
  background: linear-gradient(135deg, rgb(var(--color-error-500)), rgb(var(--color-error-600)));
  box-shadow: 0 4px 12px rgba(var(--color-error-500), 0.3);
}

.header-icon-purple {
  background: linear-gradient(135deg, rgb(var(--color-primary-400)), rgb(var(--color-primary-500)));
  box-shadow: 0 4px 12px rgba(var(--color-primary-500), 0.3);
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

/* Loading State */
.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

/* Details Card */
.details-card {
  @apply p-5 md:p-6 rounded-2xl mb-6;
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
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.card-header-text {
  @apply text-base font-semibold;
  color: rgb(var(--color-surface-700));
}

.details-list {
  @apply divide-y;
  border-color: rgba(var(--color-surface-200), 0.6);
}

.detail-row {
  @apply py-3 flex flex-col md:grid md:grid-cols-3 md:gap-4 gap-1;
}

.detail-row:first-child {
  @apply pt-0;
}

.detail-row:last-child {
  @apply pb-0;
}

.detail-label {
  @apply text-xs md:text-sm font-semibold;
  color: rgb(var(--color-surface-500));
}

.detail-value {
  @apply text-sm md:col-span-2;
  color: rgb(var(--color-surface-900));
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

/* Changes Card */
.changes-card {
  @apply p-5 md:p-6 rounded-2xl mb-6;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 4px 20px rgba(var(--color-surface-900), 0.04);
}

.changes-icon {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-500));
}

.changes-content {
  @apply bg-surface-50 dark:bg-surface-200/50 rounded-lg p-4;
}

/* Schema Changes */
.schema-changes-card .card-header-icon {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-500));
}

.schema-icon {
  background: rgba(var(--color-primary-500), 0.1) !important;
  color: rgb(var(--color-primary-500)) !important;
}

.schema-changes-content {
  @apply space-y-2;
}

.schema-change-item {
  @apply flex items-start gap-2 text-sm;
}

.schema-change-badge {
  @apply inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium;
}

.schema-change-added {
  background: rgba(var(--color-success-500), 0.15);
  color: rgb(var(--color-success-700));
}

.schema-change-removed {
  background: rgba(var(--color-error-500), 0.15);
  color: rgb(var(--color-error-700));
}

.schema-change-modified {
  background: rgba(var(--color-primary-500), 0.15);
  color: rgb(var(--color-primary-700));
}

.schema-column-name {
  @apply font-medium;
  color: rgb(var(--color-surface-900));
}

.schema-change-details {
  @apply ml-1;
  color: rgb(var(--color-surface-500));
}

/* Snapshot Card */
.snapshot-card .card-header-icon {
  background: rgba(var(--color-error-500), 0.1);
  color: rgb(var(--color-error-500));
}

.snapshot-icon {
  background: rgba(var(--color-error-500), 0.1) !important;
  color: rgb(var(--color-error-500)) !important;
}

.snapshot-content {
  @apply rounded-lg overflow-hidden;
}

/* Undo Info Banner */
.undo-info-banner {
  @apply p-4 rounded-2xl;
  background: rgba(var(--color-warning-500), 0.1);
  border: 1px solid rgba(var(--color-warning-500), 0.3);
}

.undo-info-header {
  @apply flex items-center gap-2;
  color: rgb(var(--color-warning-700));
}

.undo-info-title {
  @apply font-medium;
}

.undo-info-text {
  @apply text-sm mt-1;
  color: rgb(var(--color-warning-800));
}

/* Empty State */
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

/* Undo Button */
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

/* Undone Badge */
.undone-badge {
  @apply px-2.5 py-1 text-xs font-semibold rounded-full;
  background: rgba(var(--color-surface-400), 0.15);
  color: rgb(var(--color-surface-500));
}

/* Undone Log Styling */
.log-undone .header-icon-undone {
  background: linear-gradient(135deg, rgb(var(--color-surface-400)), rgb(var(--color-surface-500))) !important;
  box-shadow: 0 4px 12px rgba(var(--color-surface-400), 0.3) !important;
}

.undone-detail .detail-label,
.undone-detail .detail-value {
  color: rgb(var(--color-surface-500));
}

</style>
