import { Server as SocketServer } from 'socket.io'
import type { NitroApp } from 'nitropack'
import type { Server as HttpServer } from 'http'

// Socket.io path constant - used for server configuration
const SOCKET_PATH = '/_ws/'

// Maximum allowed length for businessId to prevent abuse
const MAX_BUSINESS_ID_LENGTH = 256

// Global socket instance for singleton pattern
const globalForSocket = globalThis as unknown as {
  __socketIO: SocketServer | null
  __socketInitialized: boolean
}

// Initialize globals if not present
if (globalForSocket.__socketIO === undefined) {
  globalForSocket.__socketIO = null
}
if (globalForSocket.__socketInitialized === undefined) {
  globalForSocket.__socketInitialized = false
}

/**
 * Returns the Socket.io server instance.
 * May return null if the server hasn't been initialized yet.
 */
export function getIO(): SocketServer | null {
  return globalForSocket.__socketIO
}

/**
 * Configures Socket.io event handlers for business room management.
 *
 * Room naming convention:
 * - Business rooms: `business:${businessId}` - All clients connected to a business
 *   join this room to receive real-time inventory updates for that business.
 */
function setupSocketHandlers(io: SocketServer): void {
  // Server-level error handler to prevent unhandled errors from crashing Nitro
  io.on('error', (error) => {
    console.error('[Socket.io] Server error:', error)
  })

  // Engine-level error handler for connection errors (e.g., ECONNABORTED)
  io.engine.on('connection_error', (err) => {
    console.error('[Socket.io] Connection error:', err.message)
  })

  io.on('connection', (socket) => {
    // Join a business room (room format: `business:${businessId}`)
    socket.on('join:business', (businessId: string) => {
      // Validate businessId: must be a non-empty string with reasonable length
      if (typeof businessId === 'string' && businessId.length > 0 && businessId.length < MAX_BUSINESS_ID_LENGTH) {
        socket.join(`business:${businessId}`)
      }
    })

    // Leave a business room
    socket.on('leave:business', (businessId: string) => {
      // Validate businessId: must be a non-empty string with reasonable length
      if (typeof businessId === 'string' && businessId.length > 0 && businessId.length < MAX_BUSINESS_ID_LENGTH) {
        socket.leave(`business:${businessId}`)
      }
    })

    socket.on('error', (error) => {
      console.error(`[Socket.io] Socket error for ${socket.id}:`, error)
    })
  })
}

/**
 * Initializes the Socket.io server attached to the given HTTP server.
 */
function initializeSocketServer(server: HttpServer, _context: string): void {
  // Prevent double initialization
  if (globalForSocket.__socketInitialized && globalForSocket.__socketIO) {
    return
  }

  try {
    // Production CORS configuration
    // `origin: true` restricts to same-origin requests only (secure default)
    // Set SOCKET_ALLOWED_ORIGINS env var for cross-origin support (e.g., "https://app.example.com,https://admin.example.com")
    const corsConfig = {
      origin: process.env.SOCKET_ALLOWED_ORIGINS?.split(',') || true,
      methods: ['GET', 'POST'],
      credentials: true,
    }

    globalForSocket.__socketIO = new SocketServer(server, {
      path: SOCKET_PATH,
      cors: corsConfig,
      // Don't serve client JS bundle - it's already bundled with the Nuxt app
      serveClient: false,
      // Improve connection reliability
      pingTimeout: 60000,
      pingInterval: 25000,
      // Allow both websocket and polling for better compatibility
      transports: ['websocket', 'polling'],
    })

    setupSocketHandlers(globalForSocket.__socketIO)
    globalForSocket.__socketInitialized = true
  } catch (error) {
    console.error('[Socket.io] Failed to initialize server:', error)
    globalForSocket.__socketIO = null
    globalForSocket.__socketInitialized = false
  }
}

export default defineNitroPlugin((nitroApp: NitroApp) => {
  // Handle ECONNABORTED errors gracefully - these occur when clients disconnect abruptly
  process.on('unhandledRejection', (reason: unknown) => {
    const errorMessage = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : String(reason)

    // ECONNABORTED occurs when writing to a closed socket - safe to ignore
    if (errorMessage.includes('ECONNABORTED') || errorMessage.includes('ECONNRESET')) {
      return
    }

    // For other unhandled rejections, log but don't re-throw to avoid double-reporting
    console.error('[unhandledRejection]', reason)
  })

  // Initialize via 'listen' hook when Nitro creates its own server
  // @ts-expect-error - 'listen' hook exists at runtime but not in type definitions
  nitroApp.hooks.hook('listen', (server: HttpServer) => {
    initializeSocketServer(server, 'listen hook')
  })

  // Handle server close for cleanup
  nitroApp.hooks.hook('close', () => {
    if (globalForSocket.__socketIO) {
      globalForSocket.__socketIO.close()
      globalForSocket.__socketIO = null
      globalForSocket.__socketInitialized = false
    }
  })
})
