const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const path = require("path")
const os = require("os")

const app = express()
const server = http.createServer(app)

// Cloud Run optimized configuration
const config = {
  port: process.env.PORT || 8080, // Cloud Run sets PORT
  host: process.env.HOST || "0.0.0.0",
  domain: process.env.DOMAIN || null,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  nodeEnv: process.env.NODE_ENV || "production",
  maxRooms: Number.parseInt(process.env.MAX_ROOMS) || 200,
  roomTimeout: Number.parseInt(process.env.ROOM_TIMEOUT_HOURS) || 12,
  stunServers: process.env.STUN_SERVERS
    ? process.env.STUN_SERVERS.split(",")
    : ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
  // Cloud Run specific settings
  maxConnections: Number.parseInt(process.env.MAX_CONNECTIONS) || 100,
  connectionTimeout: Number.parseInt(process.env.CONNECTION_TIMEOUT) || 30000,
}

const io = socketIo(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
  pingTimeout: config.connectionTimeout,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB limit for Cloud Run
  connectTimeout: config.connectionTimeout,
})

// Get deployment info
function getDeploymentInfo() {
  const isCloudRun = process.env.K_SERVICE !== undefined
  const serviceUrl = process.env.K_SERVICE
    ? `https://${process.env.K_SERVICE}-${process.env.K_REVISION.split("-")[0]}.a.run.app`
    : null

  return {
    isCloudRun,
    serviceUrl,
    revision: process.env.K_REVISION || "local",
    service: process.env.K_SERVICE || "local",
  }
}

const deploymentInfo = getDeploymentInfo()
const publicDomain = config.domain || deploymentInfo.serviceUrl || `localhost:${config.port}`

// Room management with Cloud Run optimizations
const rooms = new Map()
let connectionCount = 0

// Middleware
app.use(express.static("public"))
app.use(express.json({ limit: "1mb" }))

// Request logging for Cloud Run
app.use((req, res, next) => {
  if (config.nodeEnv === "production") {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} - ${req.ip}`)
  }
  next()
})

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
    isCloudRun: deploymentInfo.isCloudRun,
    service: deploymentInfo.service,
    revision: deploymentInfo.revision,
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
    connections: connectionCount,
  })
})

// Health check endpoint for Cloud Run
app.get("/api/health", (req, res) => {
  const memUsage = process.memoryUsage()
  const uptime = process.uptime()

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    rooms: rooms.size,
    connections: connectionCount,
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    deployment: deploymentInfo,
    version: "1.0.0",
    environment: config.nodeEnv,
  })
})

// Root health check for load balancers
app.get("/", (req, res) => {
  if (req.headers["user-agent"]?.includes("GoogleHC")) {
    // Google Health Check
    res.status(200).send("OK")
  } else {
    // Serve the main page
    res.sendFile(path.join(__dirname, "public", "index.html"))
  }
})

// Socket.io connection handling with Cloud Run optimizations
io.on("connection", (socket) => {
  connectionCount++

  // Connection limit for Cloud Run
  if (connectionCount > config.maxConnections) {
    socket.emit("error", { message: "Server at capacity" })
    socket.disconnect()
    connectionCount--
    return
  }

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

  // WebRTC signaling with rate limiting
  const signalRateLimit = new Map()

  socket.on("offer", ({ to, offer }) => {
    if (rateLimitSignal(socket.id)) {
      socket.to(to).emit("offer", { from: socket.id, offer: offer })
    }
  })

  socket.on("answer", ({ to, answer }) => {
    if (rateLimitSignal(socket.id)) {
      socket.to(to).emit("answer", { from: socket.id, answer: answer })
    }
  })

  socket.on("ice-candidate", ({ to, candidate }) => {
    if (rateLimitSignal(socket.id)) {
      socket.to(to).emit("ice-candidate", { from: socket.id, candidate: candidate })
    }
  })

  function rateLimitSignal(socketId) {
    const now = Date.now()
    const lastSignal = signalRateLimit.get(socketId) || 0

    if (now - lastSignal < 50) {
      // 50ms rate limit
      return false
    }

    signalRateLimit.set(socketId, now)
    return true
  }

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
    connectionCount--
    handleDisconnect(socket)
    signalRateLimit.delete(socket.id)
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

// Clean up old rooms periodically (Cloud Run optimized)
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
  30 * 60 * 1000, // Run every 30 minutes (more frequent for Cloud Run)
)

// Graceful shutdown for Cloud Run
const gracefulShutdown = () => {
  console.log("Received shutdown signal, closing server gracefully...")

  server.close(() => {
    console.log("HTTP server closed")

    // Close all socket connections
    io.close(() => {
      console.log("Socket.io server closed")
      process.exit(0)
    })
  })

  // Force close after 10 seconds
  setTimeout(() => {
    console.log("Forcing shutdown...")
    process.exit(1)
  }, 10000)
}

process.on("SIGTERM", gracefulShutdown)
process.on("SIGINT", gracefulShutdown)

// Start server
server.listen(config.port, config.host, () => {
  console.log(`🎵 LiveStream Audio Server`)
  console.log(`📡 Running on ${config.host}:${config.port}`)
  console.log(`🌐 Environment: ${config.nodeEnv}`)

  if (deploymentInfo.isCloudRun) {
    console.log(`☁️  Cloud Run Service: ${deploymentInfo.service}`)
    console.log(`🔄 Revision: ${deploymentInfo.revision}`)
    console.log(`🔗 Public URL: ${publicDomain}`)
  } else if (config.domain) {
    console.log(`🔗 Public domain: ${config.domain}`)
  } else {
    console.log(`🏠 Local access: http://localhost:${config.port}`)
  }

  console.log(`🎯 Max rooms: ${config.maxRooms}`)
  console.log(`👥 Max connections: ${config.maxConnections}`)
  console.log(`⏰ Room timeout: ${config.roomTimeout} hours`)
})

module.exports = { app, server, io }
