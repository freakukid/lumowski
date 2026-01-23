import { Server as SocketServer } from 'socket.io'
import type { NitroApp } from 'nitropack'
import type { Server as HttpServer } from 'http'

let io: SocketServer | null = null

export function getIO(): SocketServer | null {
  return io
}

export default defineNitroPlugin((nitroApp: NitroApp) => {
  // @ts-expect-error - 'listen' hook exists at runtime but not in type definitions
  nitroApp.hooks.hook('listen', (server: HttpServer) => {
    io = new SocketServer(server, {
      path: '/_ws/',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Join a business room
      socket.on('join:business', (businessId: string) => {
        if (businessId) {
          socket.join(`business:${businessId}`)
          console.log(`Socket ${socket.id} joined business:${businessId}`)
        }
      })

      // Leave a business room
      socket.on('leave:business', (businessId: string) => {
        if (businessId) {
          socket.leave(`business:${businessId}`)
          console.log(`Socket ${socket.id} left business:${businessId}`)
        }
      })

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
      })
    })

    console.log('Socket.io server initialized')
  })
})
