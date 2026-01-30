<template>
  <UiModal
    :model-value="modelValue"
    title="Out of Stock"
    variant="warning"
    size="sm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- Item Info -->
    <div class="zero-stock-item-info">
      <div class="item-icon">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      </div>
      <div class="item-details">
        <span class="item-name">{{ itemName }}</span>
        <span class="stock-badge">0 in stock</span>
      </div>
    </div>

    <!-- Message for authorized users -->
    <p v-if="canUpdateInventory" class="zero-stock-message">
      This item has no stock. Would you like to update the quantity to 1 and add it to the cart?
    </p>

    <!-- Message for unauthorized users -->
    <p v-else class="zero-stock-message unauthorized">
      This item has no stock. Please ask someone with inventory management permissions to update the stock level.
    </p>

    <template #footer>
      <template v-if="canUpdateInventory">
        <UiButton variant="secondary" @click="handleCancel">
          Cancel
        </UiButton>
        <UiButton
          variant="primary"
          :loading="loading"
          loading-text="Updating..."
          @click="handleUpdateAndAdd"
        >
          Update &amp; Add
        </UiButton>
      </template>
      <template v-else>
        <UiButton variant="primary" @click="handleCancel">
          OK
        </UiButton>
      </template>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
/**
 * ZeroStockAlertModal - Displays when a scanned barcode item has 0 quantity.
 *
 * For authorized users (OWNER/BOSS): Shows option to quick-update quantity to 1 and add to cart.
 * For unauthorized users (EMPLOYEE): Shows message asking them to get someone to update inventory.
 */

const props = defineProps<{
  /**
   * Controls the visibility of the modal (v-model)
   */
  modelValue: boolean
  /**
   * The name of the item with zero stock
   */
  itemName: string
  /**
   * The ID of the item with zero stock
   */
  itemId: string
  /**
   * Whether the current user can update inventory (OWNER/BOSS roles)
   */
  canUpdateInventory: boolean
  /**
   * Whether the update operation is in progress
   */
  loading?: boolean
}>()

const emit = defineEmits<{
  /**
   * Emitted when the modal visibility changes
   */
  'update:modelValue': [value: boolean]
  /**
   * Emitted when user chooses to update stock and add to cart
   */
  'update-and-add': [itemId: string]
  /**
   * Emitted when user cancels the action
   */
  'cancel': []
}>()

/**
 * Handles the "Update & Add" button click.
 * Emits the update-and-add event with the item ID.
 */
function handleUpdateAndAdd(): void {
  emit('update-and-add', props.itemId)
}

/**
 * Handles the cancel action (Cancel button or OK for unauthorized users).
 * Closes the modal and emits the cancel event.
 */
function handleCancel(): void {
  emit('update:modelValue', false)
  emit('cancel')
}
</script>

<style scoped>
.zero-stock-item-info {
  @apply flex items-center gap-3 p-3 rounded-lg mb-4;
  background: rgba(var(--color-surface-100), 0.8);
  border: 1px solid rgba(var(--color-surface-200), 0.8);
}

.item-icon {
  @apply flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0;
  background: rgba(var(--color-warning-500), 0.12);
  color: rgb(var(--color-warning-600));
}

.item-details {
  @apply flex flex-col gap-1 min-w-0;
}

.item-name {
  @apply text-sm font-medium truncate;
  color: rgb(var(--color-surface-800));
}

.stock-badge {
  @apply inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full w-fit;
  background: rgba(var(--color-error-500), 0.12);
  color: rgb(var(--color-error-600));
}

.zero-stock-message {
  @apply text-sm leading-relaxed;
  color: rgb(var(--color-surface-600));
}

.zero-stock-message.unauthorized {
  color: rgb(var(--color-surface-500));
}
</style>
