<template>
  <div class="settings-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <NuxtLink to="/" class="back-link">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Inventory</span>
          </NuxtLink>
          <h1 class="page-title">Customize Fields</h1>
          <p class="page-subtitle">Define the columns for your inventory table</p>
        </div>
      </div>

      <!-- Schema Editor -->
      <div class="editor-card">
        <SchemaEditor
          :columns="columns"
          :is-saving="isSaving"
          :is-loading="isLoading"
          @save="handleSave"
        />
      </div>

      <!-- Help section -->
      <div class="help-section">
        <h3 class="help-title">Column Roles</h3>
        <div class="help-grid">
          <div class="help-item">
            <span class="help-badge name">Name</span>
            <p>Primary identifier shown prominently in cards and search results</p>
          </div>
          <div class="help-item">
            <span class="help-badge quantity">Quantity</span>
            <p>Stock count used for low-stock alerts and inventory tracking</p>
          </div>
          <div class="help-item">
            <span class="help-badge minQuantity">Min Quantity</span>
            <p>Threshold that triggers low-stock warnings when quantity falls below</p>
          </div>
          <div class="help-item">
            <span class="help-badge price">Price</span>
            <p>Item value for currency formatting and total value calculations</p>
          </div>
        </div>
      </div>

      <!-- Danger Zone (Owner Only, only when there's data to reset) -->
      <div v-if="authStore.isOwner && hasDataToReset" class="danger-zone">
        <h3 class="danger-title">Danger Zone</h3>
        <div class="danger-content">
          <div class="danger-info">
            <h4 class="danger-action-title">Reset Inventory</h4>
            <p class="danger-description">
              Delete all inventory items and columns. This action cannot be undone.
            </p>
          </div>
          <button
            class="btn btn-danger"
            :disabled="isResetting"
            @click="showResetModal = true"
          >
            <svg v-if="isResetting" class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ isResetting ? 'Resetting...' : 'Reset Inventory' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <UiModal
      v-model="showResetModal"
      title="Reset Inventory"
      variant="danger"
      size="md"
    >
      <div class="reset-modal-content">
        <div class="warning-icon-container">
          <svg class="warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p class="reset-warning-title">Are you sure you want to reset everything?</p>
        <p class="reset-intro-text">This will permanently delete all of the following data from your business:</p>
        <ul class="reset-warning-list">
          <li>All inventory items</li>
          <li>Column definitions (your custom fields)</li>
          <li>Action history (inventory logs)</li>
          <li>Receiving operations</li>
        </ul>
        <p class="reset-final-warning">This action cannot be undone.</p>
      </div>

      <template #footer>
        <button class="btn btn-secondary" @click="showResetModal = false">
          Cancel
        </button>
        <button
          class="btn btn-danger"
          :disabled="isResetting"
          @click="handleReset"
        >
          {{ isResetting ? 'Deleting...' : 'Yes, Delete Everything' }}
        </button>
      </template>
    </UiModal>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDefinition } from '~/types/schema'

definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const authStore = useAuthStore()
const { columns, fetchSchema, fetchItemCount, updateSchema, resetInventory, isLoading, itemCount } = useSchema()

const isSaving = ref(false)
const isResetting = ref(false)
const showResetModal = ref(false)

// Redirect employees to inventory page - they cannot access schema settings
watch(
  () => authStore.businessRole,
  (role) => {
    if (role === 'EMPLOYEE') {
      router.replace('/')
    }
  },
  { immediate: true }
)

// Computed property to determine if there's anything to reset
const hasDataToReset = computed(() => {
  return columns.value.length > 0 || (itemCount.value !== null && itemCount.value > 0)
})

// Fetch schema and item count on mount
onMounted(async () => {
  // Double-check role on mount (in case watch didn't fire)
  if (authStore.businessRole === 'EMPLOYEE') {
    router.replace('/')
    return
  }
  // Fetch schema and item count in parallel
  await Promise.all([fetchSchema(), fetchItemCount()])
})

const handleSave = async (newColumns: ColumnDefinition[]) => {
  isSaving.value = true
  const result = await updateSchema(newColumns)
  isSaving.value = false

  if (result.success) {
    // Success feedback could be added here
  } else {
    alert(result.error || 'Failed to save schema')
  }
}

const handleReset = async () => {
  isResetting.value = true
  const result = await resetInventory()
  isResetting.value = false
  showResetModal.value = false

  if (result.success) {
    // Redirect to inventory page after successful reset
    router.push('/')
  } else {
    alert(result.error || 'Failed to reset inventory')
  }
}
</script>

<style scoped>
.settings-page {
  @apply min-h-screen py-8 px-4;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-4xl mx-auto space-y-6;
}

.page-header {
  @apply mb-8;
}

.header-content {
  @apply space-y-2;
}

.back-link {
  @apply inline-flex items-center gap-2 text-sm font-medium mb-4 transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

.page-title {
  @apply text-3xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  color: rgb(var(--color-surface-500));
}

.editor-card {
  @apply p-6 rounded-2xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.help-section {
  @apply p-6 rounded-2xl;
  background: rgba(var(--color-primary-500), 0.05);
  border: 1px solid rgba(var(--color-primary-500), 0.1);
}

.help-title {
  @apply text-lg font-semibold mb-4;
  color: rgb(var(--color-surface-900));
}

.help-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-4;
}

.help-item {
  @apply space-y-1;
}

.help-badge {
  @apply inline-block px-2 py-0.5 text-xs font-semibold rounded;
}

.help-badge.name {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-700));
}

.help-badge.quantity {
  background: rgba(var(--color-success-500), 0.1);
  color: rgb(var(--color-success-600));
}

.help-badge.minQuantity {
  background: rgba(var(--color-warning-500), 0.1);
  color: rgb(var(--color-warning-600));
}

.help-badge.price {
  background: rgba(var(--color-primary-500), 0.1);
  color: rgb(var(--color-primary-600));
}

.help-item p {
  @apply text-sm;
  color: rgb(var(--color-surface-600));
}

/* Danger Zone */
.danger-zone {
  @apply p-6 rounded-2xl mt-6;
  background: rgba(var(--color-error-500), 0.05);
  border: 1px solid rgba(var(--color-error-500), 0.2);
}

.danger-title {
  @apply text-lg font-semibold mb-4;
  color: rgb(var(--color-error-600));
}

.danger-content {
  @apply flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4;
}

.danger-info {
  @apply space-y-1;
}

.danger-action-title {
  @apply font-medium;
  color: rgb(var(--color-surface-900));
}

.danger-description {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

/* Buttons */
.btn {
  @apply px-4 min-h-[44px] flex items-center justify-center rounded-lg font-medium transition-all;
}

.btn-secondary {
  background: rgba(var(--color-surface-200), 0.5);
  color: rgb(var(--color-surface-700));
}

.btn-secondary:hover {
  background: rgba(var(--color-surface-300), 0.5);
}

.btn-danger {
  @apply flex-shrink-0;
  background: rgb(var(--color-error-500));
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: rgb(var(--color-error-600));
}

.btn-danger:disabled {
  @apply opacity-70 cursor-not-allowed;
}

/* Reset Modal */
.reset-modal-content {
  @apply text-center;
}

.warning-icon-container {
  @apply flex justify-center mb-4;
}

.warning-icon {
  @apply w-12 h-12;
  color: rgb(var(--color-error-500));
}

.reset-warning-title {
  @apply text-lg font-semibold mb-4;
  color: rgb(var(--color-surface-900));
}

.reset-intro-text {
  @apply text-sm mb-3;
  color: rgb(var(--color-surface-600));
}

.reset-warning-list {
  @apply text-left space-y-2 pl-6 list-disc;
  color: rgb(var(--color-surface-600));
}

.reset-warning-list li {
  @apply text-sm;
}

.reset-final-warning {
  @apply text-center mt-4 font-semibold;
  color: rgb(var(--color-error-600));
}
</style>
