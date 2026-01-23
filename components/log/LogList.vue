<template>
  <div class="space-y-4">
    <!-- Filters -->
    <LogFilters
      :filters="filters"
      :users="users"
      @update:filters="handleFilterChange"
    />

    <!-- Initial loading state (before first fetch completes) -->
    <div v-if="!hasInitiallyLoaded" class="flex items-center justify-center py-12">
      <svg class="w-8 h-8 text-primary-500 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <!-- Empty state (only shown after load confirms no logs) -->
    <LogEmptyState
      v-else-if="logs.length === 0"
      :title="hasActiveFilters ? 'No matching results' : 'No activity yet'"
      :message="hasActiveFilters ? 'Try adjusting your filters to see more results.' : 'Activity logs will appear here as you create, update, and delete inventory items.'"
    />

    <!-- Grouped card view (all screen sizes) -->
    <div v-else class="space-y-4">
      <div v-for="group in groupedLogs" :key="group.dateKey">
        <!-- Date separator -->
        <div class="flex items-center gap-3 py-4">
          <span class="text-sm font-semibold text-surface-500 whitespace-nowrap">
            {{ group.displayDate }}
          </span>
          <div class="flex-1 h-px bg-surface-200"></div>
        </div>

        <!-- Cards for this day -->
        <div class="space-y-3 mt-2">
          <LogEntryCard
            v-for="log in group.logs"
            :key="log.id"
            :log="log"
            @undo="openUndoModal"
          />
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-between py-4">
      <p class="text-sm text-surface-500">
        Showing {{ (pagination.page - 1) * pagination.limit + 1 }} to {{ Math.min(pagination.page * pagination.limit, pagination.total) }} of {{ pagination.total }} entries
      </p>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1.5 text-sm font-medium text-surface-700 bg-white dark:bg-surface-100 border border-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="pagination.page <= 1 || loading"
          @click="goToPage(pagination.page - 1)"
        >
          Previous
        </button>
        <span class="text-sm text-surface-500">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </span>
        <button
          class="px-3 py-1.5 text-sm font-medium text-surface-700 bg-white dark:bg-surface-100 border border-surface-300 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="pagination.page >= pagination.totalPages || loading"
          @click="goToPage(pagination.page + 1)"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Undo Modal -->
    <LogUndoModal
      v-if="undoLog"
      :is-open="undoModalOpen"
      :log="undoLog"
      :loading="undoLoading"
      :conflicts="undoConflicts"
      :has-conflicts="hasUndoConflicts"
      @close="closeUndoModal"
      @confirm="confirmUndo"
    />
  </div>
</template>

<script setup lang="ts">
import type { InventoryLog, LogFilters, Pagination, ConflictField } from '~/types/log'
import { groupLogsByDate } from '~/composables/useLogHelpers'

interface Props {
  logs: InventoryLog[]
  loading?: boolean
  hasInitiallyLoaded?: boolean
  pagination?: Pagination | null
  users?: { id: string; name: string }[]
}

interface Emits {
  (e: 'filter', filters: LogFilters): void
  (e: 'page', page: number): void
  (e: 'undo', log: InventoryLog): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  hasInitiallyLoaded: false,
  pagination: null,
  users: () => [],
})
const emit = defineEmits<Emits>()

const { checkUndoConflicts } = useLog()

// Group logs by date for display
const groupedLogs = computed(() => groupLogsByDate(props.logs))

// Filters state
const filters = reactive<LogFilters>({})

const hasActiveFilters = computed(() => {
  return !!(filters.action || filters.userId || filters.startDate || filters.endDate || filters.search)
})

function handleFilterChange(newFilters: LogFilters) {
  Object.assign(filters, newFilters)
  emit('filter', { ...filters })
}

function goToPage(page: number) {
  emit('page', page)
}

// Undo modal state
const undoModalOpen = ref(false)
const undoLog = ref<InventoryLog | null>(null)
const undoLoading = ref(false)
const isCheckingConflicts = ref(false)

// Conflict state
const undoConflicts = ref<ConflictField[]>([])
const hasUndoConflicts = ref(false)

/**
 * Opens the undo modal after checking for conflicts.
 * This ensures users are warned if the item has been modified since the log was created.
 */
async function openUndoModal(log: InventoryLog) {
  undoLog.value = log

  // Reset conflict state
  undoConflicts.value = []
  hasUndoConflicts.value = false
  isCheckingConflicts.value = true

  // Check for conflicts before showing the modal
  const conflictResult = await checkUndoConflicts(log.id)

  isCheckingConflicts.value = false

  if (conflictResult) {
    undoConflicts.value = conflictResult.conflicts
    hasUndoConflicts.value = conflictResult.hasConflicts
  }

  // Show the modal regardless of conflicts
  undoModalOpen.value = true
}

function closeUndoModal() {
  undoModalOpen.value = false
  setTimeout(() => {
    undoLog.value = null
    undoLoading.value = false
    // Reset conflict state
    undoConflicts.value = []
    hasUndoConflicts.value = false
  }, 200)
}

async function confirmUndo() {
  if (!undoLog.value) return

  undoLoading.value = true
  emit('undo', undoLog.value)
}

// Expose method to close undo modal from parent
defineExpose({
  closeUndoModal,
})
</script>
