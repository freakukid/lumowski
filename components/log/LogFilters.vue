<template>
  <div class="bg-white dark:bg-surface-100 rounded-lg shadow-sm border border-surface-200 p-4">
    <div class="flex flex-col gap-4">
      <!-- Search -->
      <div class="w-full">
        <label class="block text-sm font-medium text-surface-700 mb-1">Search</label>
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="localFilters.search"
            type="text"
            placeholder="Search by item name or user..."
            class="input pl-9"
            @input="debouncedEmit"
          />
        </div>
      </div>

      <!-- Action and User filters -->
      <div class="flex flex-col lg:flex-row gap-4">
        <!-- Action filter -->
        <div class="flex-1 min-w-0">
          <label class="block text-sm font-medium text-surface-700 mb-1">Action</label>
          <UiSelect
            v-model="localFilters.action"
            :options="actionOptions"
            placeholder="All actions"
            @update:model-value="emitFilters"
          />
        </div>

        <!-- User filter -->
        <div class="flex-1 min-w-0">
          <label class="block text-sm font-medium text-surface-700 mb-1">User</label>
          <UiSelect
            v-model="localFilters.userId"
            :options="userOptions"
            :placeholder="users.length === 0 ? 'Loading users...' : 'All users'"
            :disabled="users.length === 0"
            @update:model-value="emitFilters"
          />
        </div>
      </div>

      <!-- Date range -->
      <div class="flex flex-col lg:flex-row gap-4">
        <div class="flex-1 min-w-0">
          <label class="block text-sm font-medium text-surface-700 mb-1">From</label>
          <UiDatePicker
            v-model="localFilters.startDate"
            placeholder="Start date"
            :max="localFilters.endDate || undefined"
            clearable
            @update:model-value="emitFilters"
          />
        </div>
        <div class="flex-1 min-w-0">
          <label class="block text-sm font-medium text-surface-700 mb-1">To</label>
          <UiDatePicker
            v-model="localFilters.endDate"
            placeholder="End date"
            :min="localFilters.startDate || undefined"
            clearable
            @update:model-value="emitFilters"
          />
        </div>
      </div>
    </div>

    <!-- Active filters & clear button -->
    <div v-if="hasActiveFilters" class="mt-3 flex items-center gap-2 flex-wrap">
      <span class="text-sm text-surface-500">Active filters:</span>
      <button
        v-if="localFilters.action"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
        @click="clearFilter('action')"
      >
        {{ getActionLabel(localFilters.action as LogAction) }}
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button
        v-if="localFilters.userId"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
        @click="clearFilter('userId')"
      >
        {{ users.find(u => u.id === localFilters.userId)?.name || 'User' }}
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button
        v-if="localFilters.startDate || localFilters.endDate"
        class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400"
        @click="clearDateFilters"
      >
        Date range
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button
        class="text-xs text-surface-500 hover:text-surface-700 underline ml-2"
        @click="clearAllFilters"
      >
        Clear all
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LogAction, LogFilters } from '~/types/log'

interface Props {
  filters: LogFilters
  users?: { id: string; name: string }[]
}

interface Emits {
  (e: 'update:filters', filters: LogFilters): void
}

const props = withDefaults(defineProps<Props>(), {
  users: () => [],
})
const emit = defineEmits<Emits>()

const { getActionLabel } = useLogHelpers()

// Use a separate reactive object that uses empty strings for select fields
// so they properly bind to <option value=""> default options
const localFilters = reactive({
  action: props.filters.action ?? '',
  userId: props.filters.userId ?? '',
  startDate: props.filters.startDate ?? '',
  endDate: props.filters.endDate ?? '',
  search: props.filters.search ?? '',
})

// Options for UiSelect components
const actionOptions = [
  { value: 'ITEM_CREATED', label: 'Created' },
  { value: 'ITEM_UPDATED', label: 'Updated' },
  { value: 'ITEM_DELETED', label: 'Deleted' },
  { value: 'SCHEMA_UPDATED', label: 'Schema Changed' },
]

const userOptions = computed(() =>
  props.users.map(user => ({ value: user.id, label: user.name }))
)

// Sync with props - convert undefined to empty strings for select binding
watch(() => props.filters, (newFilters) => {
  localFilters.action = newFilters.action ?? ''
  localFilters.userId = newFilters.userId ?? ''
  localFilters.startDate = newFilters.startDate ?? ''
  localFilters.endDate = newFilters.endDate ?? ''
  localFilters.search = newFilters.search ?? ''
}, { deep: true })

const hasActiveFilters = computed(() => {
  return !!(localFilters.action || localFilters.userId || localFilters.startDate || localFilters.endDate || localFilters.search)
})

function emitFilters() {
  // Convert empty strings back to undefined for the parent component
  emit('update:filters', {
    action: localFilters.action || undefined,
    userId: localFilters.userId || undefined,
    startDate: localFilters.startDate || undefined,
    endDate: localFilters.endDate || undefined,
    search: localFilters.search || undefined,
  } as LogFilters)
}

// Debounced emit for search input
let debounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedEmit() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    emitFilters()
  }, 300)
}

function clearFilter(key: keyof LogFilters) {
  localFilters[key] = ''
  emitFilters()
}

function clearDateFilters() {
  localFilters.startDate = ''
  localFilters.endDate = ''
  emitFilters()
}

function clearAllFilters() {
  localFilters.action = ''
  localFilters.userId = ''
  localFilters.startDate = ''
  localFilters.endDate = ''
  localFilters.search = ''
  emitFilters()
}
</script>
