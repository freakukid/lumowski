<template>
  <div class="new-item-page">
    <div class="page-container">
      <!-- Header -->
      <div class="page-header">
        <NuxtLink to="/" class="back-link">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Inventory</span>
        </NuxtLink>

        <div class="header-content">
          <!-- Header Icon -->
          <div class="header-icon">
            <svg class="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v4m0 0h2m-2 0h-2" />
            </svg>
          </div>

          <div class="header-text">
            <h1 class="page-title">Add New Item</h1>
            <p class="page-subtitle">Create a new inventory item</p>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isSchemaLoading" class="loading-state">
        <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Loading...</p>
      </div>

      <!-- Form Card -->
      <div v-else class="form-card">
        <!-- Card Header -->
        <div class="card-header">
          <div class="card-header-icon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span class="card-header-text">Item Details</span>
        </div>

        <InventoryDynamicInventoryForm
          :columns="sortedColumns"
          :is-loading="isLoading"
          @submit="handleSubmit"
          @cancel="router.push('/')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

const router = useRouter()
const { createItem, isLoading, sortedColumns } = useInventory()
const { fetchSchema, isLoading: isSchemaLoading } = useSchema()

// Fetch schema on mount
onMounted(async () => {
  await fetchSchema()
})

const handleSubmit = async (data: Record<string, unknown>) => {
  const result = await createItem(data)

  if (result.success) {
    router.push('/')
  }
}
</script>

<style scoped>
.new-item-page {
  @apply min-h-screen py-8 px-4 relative overflow-hidden;
  background: rgb(var(--color-surface-50));
}

.page-container {
  @apply max-w-3xl mx-auto relative z-10;
}

.page-header {
  @apply mb-10 space-y-4;
}

.back-link {
  @apply min-h-[44px] inline-flex items-center gap-2 px-2 -ml-2 text-sm font-medium mb-4 transition-colors;
  color: rgb(var(--color-surface-500));
}

.back-link:hover {
  color: rgb(var(--color-primary-600));
}

/* Header content with icon */
.header-content {
  @apply flex items-center gap-4;
}

/* Header icon container */
.header-icon {
  @apply flex items-center justify-center flex-shrink-0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgb(var(--color-primary-500)), rgb(var(--color-primary-600)));
  color: white;
  box-shadow: 0 4px 12px rgba(var(--color-primary-500), 0.3);
}

@media (min-width: 768px) {
  .header-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }
}

.header-text {
  @apply flex flex-col gap-1;
}

.page-title {
  @apply text-2xl md:text-3xl font-bold;
  color: rgb(var(--color-surface-900));
}

.page-subtitle {
  @apply text-sm;
  color: rgb(var(--color-surface-500));
}

.loading-state {
  @apply flex flex-col items-center justify-center py-20 gap-4;
  color: rgb(var(--color-surface-400));
}

/* Enhanced card styling */
.form-card {
  @apply p-5 md:p-8 rounded-3xl;
  background: rgba(var(--color-surface-100), 0.5);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
  box-shadow: 0 10px 40px rgba(var(--color-surface-900), 0.06);
}

/* Card header section */
.card-header {
  @apply flex items-center gap-3 mb-6 pb-4;
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
</style>
