import { type NextRequest, NextResponse } from "next/server"
import { Server as SocketIOServer } from "socket.io"
import { createServer } from "http"

// Global socket server instance
let io: SocketIOServer | null = null

// Room management
const rooms = new Map<string, { host?: string; listeners: Set<string> }>()

function initializeSocketServer() {
  if (io) return io

  const httpServer = createServer()
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket/",
  })

  io.on("connection", (socket) => {
    const { roomId, role } = socket.handshake.query

    if (!roomId || typeof roomId !== "string") {
      socket.disconnect()
      return
    }

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { listeners: new Set() })
    }

    const room = rooms.get(roomId)!

    if (role === "host") {
      // Handle host connection
      if (room.host) {
        socket.emit("error", "Room already has a host")
        socket.disconnect()
        return
      }

      room.host = socket.id
      socket.join(roomId)

      console.log(`Host ${socket.id} joined room ${roomId}`)

      socket.on("offer", ({ to, offer }) => {
        socket.to(to).emit("offer", { from: socket.id, offer })
      })

      socket.on("ice-candidate", ({ to, candidate }) => {
        socket.to(to).emit("ice-candidate", { from: socket.id, candidate })
      })

      socket.on("disconnect", () => {
        if (room.host === socket.id) {
          room.host = undefined
          // Notify all listeners that host disconnected
          room.listeners.forEach((listenerId) => {
            socket.to(listenerId).emit("host-disconnected")
          })
          console.log(`Host ${socket.id} left room ${roomId}`)
        }
      })
    } else if (role === "listener") {
      // Handle listener connection
      room.listeners.add(socket.id)
      socket.join(roomId)

      console.log(`Listener ${socket.id} joined room ${roomId}`)

      // Notify host about new listener
      if (room.host) {
        socket.to(room.host).emit("listener-joined", socket.id)
      }

      socket.on("answer", ({ to, answer }) => {
        socket.to(to).emit("answer", { from: socket.id, answer })
      })

      socket.on("ice-candidate", ({ to, candidate }) => {
        socket.to(to).emit("ice-candidate", { from: socket.id, candidate })
      })

      socket.on("disconnect", () => {
        room.listeners.delete(socket.id)
        // Notify host about listener leaving
        if (room.host) {
          socket.to(room.host).emit("listener-left", socket.id)
        }
        console.log(`Listener ${socket.id} left room ${roomId}`)
      })
    }
  })

  // Start the server on a different port for Socket.io
  httpServer.listen(3001, () => {
    console.log("Socket.io server running on port 3001")
  })

  return io
}

export function middleware(request: NextRequest) {
  // Initialize Socket.io server on first request
  if (!io) {
    initializeSocketServer()
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/api/socket/:path*",
}
