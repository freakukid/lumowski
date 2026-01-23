<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
    :class="[colors.bg, colors.text]"
  >
    <!-- Plus icon for ITEM_CREATED -->
    <svg v-if="action === 'ITEM_CREATED'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
    </svg>
    <!-- Edit/pencil icon for ITEM_UPDATED -->
    <svg v-else-if="action === 'ITEM_UPDATED'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
    <!-- Trash icon for ITEM_DELETED -->
    <svg v-else-if="action === 'ITEM_DELETED'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
    <!-- Grid/layout icon for SCHEMA_UPDATED -->
    <svg v-else-if="action === 'SCHEMA_UPDATED'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import type { LogAction } from '~/types/log'

interface Props {
  action: LogAction
}

const props = defineProps<Props>()

const { getActionLabel, getActionColors } = useLogHelpers()

const label = computed(() => getActionLabel(props.action))
const colors = computed(() => getActionColors(props.action))
</script>
