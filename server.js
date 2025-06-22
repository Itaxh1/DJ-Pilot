const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const path = require("path")
const os = require("os")

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
})

const PORT = process.env.PORT || 9000

// Get local IP address
function getLocalIP() {
  const networkInterfaces = os.networkInterfaces()
  for (const name of Object.keys(networkInterfaces)) {
    for (const networkInterface of networkInterfaces[name]) {
      if (networkInterface.family === "IPv4" && !networkInterface.internal) {
        return networkInterface.address
      }
    }
  }
  return "localhost"
}

const localIP = getLocalIP()

// Room management
const rooms = new Map()

// Serve static files
app.use(express.static("public"))
app.use(express.json())

// Add CORS headers for all requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

// API Routes
app.get("/api/rooms/:roomId", (req, res) => {
  const { roomId } = req.params
  const room = rooms.get(roomId)

  if (!room) {
    return res.status(404).json({ error: "Room not found" })
  }

  res.json({
    roomId,
    hasHost: !!room.host,
    listenerCount: room.listeners.size,
    isActive: !!room.host,
  })
})

app.post("/api/rooms", (req, res) => {
  const roomId = generateRoomId()

  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      host: null,
      listeners: new Set(),
      createdAt: new Date(),
    })
  }

  res.json({ roomId })
})

app.get("/api/rooms", (req, res) => {
  const activeRooms = Array.from(rooms.entries())
    .filter(([_, room]) => room.host)
    .map(([roomId, room]) => ({
      roomId,
      listenerCount: room.listeners.size,
      createdAt: room.createdAt,
    }))

  res.json({ rooms: activeRooms })
})

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    localIP: localIP,
  })
})

// Socket.io connection handling with low-latency optimizations
io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  socket.on("join-room", ({ roomId, role }) => {
    console.log(`${socket.id} joining room ${roomId} as ${role}`)

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        host: null,
        listeners: new Set(),
        createdAt: new Date(),
      })
    }

    const room = rooms.get(roomId)
    socket.join(roomId)
    socket.roomId = roomId
    socket.role = role

    if (role === "host") {
      handleHostJoin(socket, room, roomId)
    } else if (role === "listener") {
      handleListenerJoin(socket, room, roomId)
    }
  })

  // WebRTC signaling with priority handling
  socket.on("offer", ({ to, offer }) => {
    console.log(`Offer from ${socket.id} to ${to}`)
    // Send immediately without queuing
    socket.to(to).emit("offer", {
      from: socket.id,
      offer: offer,
    })
  })

  socket.on("answer", ({ to, answer }) => {
    console.log(`Answer from ${socket.id} to ${to}`)
    socket.to(to).emit("answer", {
      from: socket.id,
      answer: answer,
    })
  })

  socket.on("ice-candidate", ({ to, candidate }) => {
    console.log(`ICE candidate from ${socket.id} to ${to}`)
    // ICE candidates are time-sensitive, send immediately
    socket.to(to).emit("ice-candidate", {
      from: socket.id,
      candidate: candidate,
    })
  })

  // Host controls
  socket.on("mute-stream", () => {
    if (socket.role === "host" && socket.roomId) {
      socket.to(socket.roomId).emit("host-muted")
    }
  })

  socket.on("unmute-stream", () => {
    if (socket.role === "host" && socket.roomId) {
      socket.to(socket.roomId).emit("host-unmuted")
    }
  })

  // Disconnect handling
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`)
    handleDisconnect(socket)
  })

  // Error handling
  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error)
  })
})

function handleHostJoin(socket, room, roomId) {
  if (room.host) {
    socket.emit("error", { message: "Room already has a host" })
    return
  }

  room.host = socket.id
  socket.emit("host-joined", { roomId })

  // Notify existing listeners about host
  room.listeners.forEach((listenerId) => {
    socket.to(listenerId).emit("host-connected")
    socket.emit("listener-joined", { listenerId })
  })

  console.log(`Host ${socket.id} joined room ${roomId}`)
}

function handleListenerJoin(socket, room, roomId) {
  room.listeners.add(socket.id)
  socket.emit("listener-joined", { roomId })

  // Notify host about new listener
  if (room.host) {
    socket.to(room.host).emit("listener-joined", { listenerId: socket.id })
    socket.emit("host-connected")
  }

  // Send room stats to all listeners
  const listenerCount = room.listeners.size
  socket.to(roomId).emit("listener-count-updated", { count: listenerCount })

  console.log(`Listener ${socket.id} joined room ${roomId} (${listenerCount} total)`)
}

function handleDisconnect(socket) {
  if (!socket.roomId) return

  const room = rooms.get(socket.roomId)
  if (!room) return

  if (socket.role === "host" && room.host === socket.id) {
    // Host disconnected
    room.host = null
    socket.to(socket.roomId).emit("host-disconnected")
    console.log(`Host ${socket.id} left room ${socket.roomId}`)

    // Clean up room if no listeners
    if (room.listeners.size === 0) {
      rooms.delete(socket.roomId)
      console.log(`Room ${socket.roomId} deleted`)
    }
  } else if (socket.role === "listener") {
    // Listener disconnected
    room.listeners.delete(socket.id)

    if (room.host) {
      socket.to(room.host).emit("listener-left", { listenerId: socket.id })
    }

    // Update listener count
    const listenerCount = room.listeners.size
    socket.to(socket.roomId).emit("listener-count-updated", { count: listenerCount })

    console.log(`Listener ${socket.id} left room ${socket.roomId} (${listenerCount} remaining)`)

    // Clean up room if empty
    if (!room.host && room.listeners.size === 0) {
      rooms.delete(socket.roomId)
      console.log(`Room ${socket.roomId} deleted`)
    }
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// Clean up old rooms periodically
setInterval(
  () => {
    const now = new Date()
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    for (const [roomId, room] of rooms.entries()) {
      if (!room.host && room.listeners.size === 0 && now - room.createdAt > maxAge) {
        rooms.delete(roomId)
        console.log(`Cleaned up old room: ${roomId}`)
      }
    }
  },
  60 * 60 * 1000,
) // Run every hour

// Start server on all network interfaces (0.0.0.0)
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎵 Live Audio Streaming Server running on port ${PORT}`)
  console.log(`📡 WebSocket server ready for connections`)
  console.log(`🌐 Local access: http://localhost:${PORT}`)
  console.log(`📱 Network access: http://${localIP}:${PORT}`)
  console.log(`🔗 Share this IP with other devices: ${localIP}:${PORT}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Server closed")
    process.exit(0)
  })
})

module.exports = { app, server, io }
