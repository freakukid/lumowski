import { vi } from 'vitest'

// Mock socket instance
export const mockSocket = {
  id: 'test-socket-id',
  connected: true,
  disconnected: false,

  // Connection methods
  connect: vi.fn(),
  disconnect: vi.fn(),
  close: vi.fn(),

  // Event methods
  on: vi.fn(),
  off: vi.fn(),
  once: vi.fn(),
  emit: vi.fn(),

  // Room methods
  join: vi.fn(),
  leave: vi.fn(),

  // Listeners storage for testing
  _listeners: new Map<string, Function[]>()
}

// Mock io function
export const mockIo = vi.fn(() => mockSocket)

// Setup Socket.io mocks
export function setupSocketMocks() {
  vi.mock('socket.io-client', () => ({
    io: mockIo,
    default: mockIo
  }))
}

// Helper to simulate receiving an event
export function simulateSocketEvent(event: string, ...args: any[]) {
  const listeners = mockSocket._listeners.get(event) || []
  listeners.forEach(listener => listener(...args))
}

// Helper to capture event listeners
export function captureSocketListeners() {
  mockSocket.on.mockImplementation((event: string, callback: Function) => {
    const listeners = mockSocket._listeners.get(event) || []
    listeners.push(callback)
    mockSocket._listeners.set(event, listeners)
    return mockSocket
  })

  mockSocket.off.mockImplementation((event: string, callback?: Function) => {
    if (callback) {
      const listeners = mockSocket._listeners.get(event) || []
      const index = listeners.indexOf(callback)
      if (index > -1) listeners.splice(index, 1)
      mockSocket._listeners.set(event, listeners)
    } else {
      mockSocket._listeners.delete(event)
    }
    return mockSocket
  })
}

// Helper to reset socket state
export function resetSocketMocks() {
  mockSocket.connected = true
  mockSocket.disconnected = false
  mockSocket._listeners.clear()
  vi.clearAllMocks()
}

// Helper to simulate disconnect
export function simulateDisconnect(reason = 'io client disconnect') {
  mockSocket.connected = false
  mockSocket.disconnected = true
  simulateSocketEvent('disconnect', reason)
}

// Helper to simulate reconnect
export function simulateReconnect() {
  mockSocket.connected = true
  mockSocket.disconnected = false
  simulateSocketEvent('connect')
}

// Common inventory socket events
export const InventorySocketEvents = {
  ITEM_CREATED: 'inventory:created',
  ITEM_UPDATED: 'inventory:updated',
  ITEM_DELETED: 'inventory:deleted',
  SCHEMA_UPDATED: 'schema:updated',
  LOW_STOCK_ALERT: 'inventory:low-stock'
} as const
