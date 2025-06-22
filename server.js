const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const path = require("path")
const os = require("os")

const app = express()
const server = http.createServer(app)

// Configuration from environment variables
const config = {
  port: process.env.PORT || 9000,
  host: process.env.HOST || "0.0.0.0",
  domain: process.env.DOMAIN || null,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  nodeEnv: process.env.NODE_ENV || "development",
  maxRooms: Number.parseInt(process.env.MAX_ROOMS) || 100,
  roomTimeout: Number.parseInt(process.env.ROOM_TIMEOUT_HOURS) || 24,
  stunServers: process.env.STUN_SERVERS
    ? process.env.STUN_SERVERS.split(",")
    : ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
}

const io = socketIo(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Get local IP address for network access
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
const publicDomain = config.domain || localIP

// Room management with cleanup
const rooms = new Map()

// Middleware
app.use(express.static("public"))
app.use(express.json())

// CORS headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", config.corsOrigin)
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

// API Routes
app.get("/api/config", (req, res) => {
  res.json({
    domain: publicDomain,
    port: config.port,
    stunServers: config.stunServers,
    maxRooms: config.maxRooms,
  })
})

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
    createdAt: room.createdAt,
  })
})

app.post("/api/rooms", (req, res) => {
  if (rooms.size >= config.maxRooms) {
    return res.status(429).json({ error: "Maximum number of rooms reached" })
  }

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

  res.json({
    rooms: activeRooms,
    total: activeRooms.length,
    maxRooms: config.maxRooms,
  })
})

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    rooms: rooms.size,
    localIP: localIP,
    domain: publicDomain,
    version: "1.0.0",
    environment: config.nodeEnv,
  })
})

// Socket.io connection handling
io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, role }) => {
    if (!roomId || typeof roomId !== "string" || roomId.length > 10) {
      socket.emit("error", { message: "Invalid room ID" })
      return
    }

    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      if (rooms.size >= config.maxRooms) {
        socket.emit("error", { message: "Server at capacity" })
        return
      }

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

  // WebRTC signaling
  socket.on("offer", ({ to, offer }) => {
    socket.to(to).emit("offer", {
      from: socket.id,
      offer: offer,
    })
  })

  socket.on("answer", ({ to, answer }) => {
    socket.to(to).emit("answer", {
      from: socket.id,
      answer: answer,
    })
  })

  socket.on("ice-candidate", ({ to, candidate }) => {
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

  socket.on("disconnect", () => {
    handleDisconnect(socket)
  })

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

  // Notify existing listeners
  room.listeners.forEach((listenerId) => {
    socket.to(listenerId).emit("host-connected")
    socket.emit("listener-joined", { listenerId })
  })
}

function handleListenerJoin(socket, room, roomId) {
  room.listeners.add(socket.id)
  socket.emit("listener-joined", { roomId })

  // Notify host
  if (room.host) {
    socket.to(room.host).emit("listener-joined", { listenerId: socket.id })
    socket.emit("host-connected")
  }

  // Update listener count
  const listenerCount = room.listeners.size
  socket.to(roomId).emit("listener-count-updated", { count: listenerCount })
}

function handleDisconnect(socket) {
  if (!socket.roomId) return

  const room = rooms.get(socket.roomId)
  if (!room) return

  if (socket.role === "host" && room.host === socket.id) {
    room.host = null
    socket.to(socket.roomId).emit("host-disconnected")

    // Clean up room if no listeners
    if (room.listeners.size === 0) {
      rooms.delete(socket.roomId)
    }
  } else if (socket.role === "listener") {
    room.listeners.delete(socket.id)

    if (room.host) {
      socket.to(room.host).emit("listener-left", { listenerId: socket.id })
    }

    // Update listener count
    const listenerCount = room.listeners.size
    socket.to(socket.roomId).emit("listener-count-updated", { count: listenerCount })

    // Clean up empty room
    if (!room.host && room.listeners.size === 0) {
      rooms.delete(socket.roomId)
    }
  }
}

function generateRoomId() {
  let roomId
  do {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase()
  } while (rooms.has(roomId))
  return roomId
}

// Clean up old rooms periodically
setInterval(
  () => {
    const now = new Date()
    const maxAge = config.roomTimeout * 60 * 60 * 1000

    for (const [roomId, room] of rooms.entries()) {
      if (!room.host && room.listeners.size === 0 && now - room.createdAt > maxAge) {
        rooms.delete(roomId)
      }
    }
  },
  60 * 60 * 1000,
) // Run every hour

// Start server
server.listen(config.port, config.host, () => {
  console.log(`🎵 LiveStream Audio Server`)
  console.log(`📡 Running on ${config.host}:${config.port}`)
  console.log(`🌐 Environment: ${config.nodeEnv}`)

  if (config.domain) {
    console.log(`🔗 Public domain: ${config.domain}`)
  } else {
    console.log(`🏠 Local access: http://localhost:${config.port}`)
    console.log(`📱 Network access: http://${localIP}:${config.port}`)
  }

  console.log(`🎯 Max rooms: ${config.maxRooms}`)
  console.log(`⏰ Room timeout: ${config.roomTimeout} hours`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    console.log("Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully")
  server.close(() => {
    console.log("Server closed")
    process.exit(0)
  })
})

module.exports = { app, server, io }
