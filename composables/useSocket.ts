import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '~/stores/auth'
import { useInventoryStore } from '~/stores/inventory'
import type { DynamicInventoryItem } from '~/types/schema'
import type { Operation } from '~/types/operation'

let socket: Socket | null = null
let currentBusinessId: string | null = null

// Callback registries for operation events
// Using Sets to allow multiple subscribers and easy removal
const operationUndoneCallbacks = new Set<(operation: Operation) => void>()
const operationCreatedCallbacks = new Set<(operation: Operation) => void>()

export const useSocket = () => {
  const inventoryStore = useInventoryStore()
  const authStore = useAuthStore()
  const isConnected = ref(false)

  const joinBusiness = (businessId: string) => {
    if (!socket || !businessId) return

    // Leave previous business room if any
    if (currentBusinessId && currentBusinessId !== businessId) {
      socket.emit('leave:business', currentBusinessId)
    }

    // Join new business room
    socket.emit('join:business', businessId)
    currentBusinessId = businessId
  }

  const leaveBusiness = () => {
    if (!socket || !currentBusinessId) return
    socket.emit('leave:business', currentBusinessId)
    currentBusinessId = null
  }

  const connect = () => {
    if (socket?.connected) return

    // Explicitly pass the URL to prevent socket.io-client from probing
    // the default /socket.io/ path, which causes Vue Router warnings
    socket = io(window.location.origin, {
      path: '/_ws/',
      autoConnect: true,
    })

    socket.on('connect', () => {
      isConnected.value = true

      // Join business room if user has a business
      if (authStore.businessId) {
        joinBusiness(authStore.businessId)
      }
    })

    socket.on('disconnect', () => {
      isConnected.value = false
      currentBusinessId = null
    })

    // Listen for inventory events
    socket.on('inventory:created', (item: DynamicInventoryItem) => {
      // Only add if not already in the list (to avoid duplicates from own actions)
      const exists = inventoryStore.items.some((i) => i.id === item.id)
      if (!exists) {
        inventoryStore.addItem(item)
      }
    })

    socket.on('inventory:updated', (item: DynamicInventoryItem) => {
      inventoryStore.updateItem(item)
    })

    socket.on('inventory:deleted', (id: string) => {
      inventoryStore.removeItem(id)
    })

    socket.on('inventory:reset', () => {
      inventoryStore.setItems([])
      inventoryStore.setSchema([])
      inventoryStore.resetPagination()
    })

    // Listen for operation events
    socket.on('operation:created', (operation: Operation) => {
      operationCreatedCallbacks.forEach((callback) => callback(operation))
    })

    socket.on('operation:undone', (operation: Operation) => {
      operationUndoneCallbacks.forEach((callback) => callback(operation))
    })
  }

  const disconnect = () => {
    if (socket) {
      leaveBusiness()
      socket.disconnect()
      socket = null
      isConnected.value = false
    }
  }

  // Watch for business changes and join/leave rooms accordingly
  watch(
    () => authStore.businessId,
    (newBusinessId) => {
      if (socket?.connected) {
        if (newBusinessId) {
          joinBusiness(newBusinessId)
        } else {
          leaveBusiness()
        }
      }
    }
  )

  // Auto-connect on client side
  if (import.meta.client) {
    onMounted(() => {
      connect()
    })

    onUnmounted(() => {
      // Don't disconnect on unmount as we want to keep the connection alive
      // across page navigations. Only disconnect when explicitly needed.
    })
  }

  /**
   * Registers a callback to be invoked when an operation is undone.
   * Use this in components that need to react to real-time operation undo events.
   *
   * @param callback - Function to call with the undone operation data
   * @returns Cleanup function to unregister the callback
   */
  const onOperationUndone = (callback: (operation: Operation) => void) => {
    operationUndoneCallbacks.add(callback)
    return () => operationUndoneCallbacks.delete(callback)
  }

  /**
   * Unregisters a previously registered operation:undone callback.
   *
   * @param callback - The callback function to remove
   */
  const offOperationUndone = (callback: (operation: Operation) => void) => {
    operationUndoneCallbacks.delete(callback)
  }

  /**
   * Registers a callback to be invoked when a new operation is created.
   * Use this in components that need to react to real-time operation create events.
   *
   * @param callback - Function to call with the created operation data
   * @returns Cleanup function to unregister the callback
   */
  const onOperationCreated = (callback: (operation: Operation) => void) => {
    operationCreatedCallbacks.add(callback)
    return () => operationCreatedCallbacks.delete(callback)
  }

  /**
   * Unregisters a previously registered operation:created callback.
   *
   * @param callback - The callback function to remove
   */
  const offOperationCreated = (callback: (operation: Operation) => void) => {
    operationCreatedCallbacks.delete(callback)
  }

  return {
    isConnected,
    connect,
    disconnect,
    joinBusiness,
    leaveBusiness,
    // Operation event callbacks
    onOperationUndone,
    offOperationUndone,
    onOperationCreated,
    offOperationCreated,
  }
}
