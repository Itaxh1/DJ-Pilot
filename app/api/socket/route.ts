import type { NextRequest } from "next/server"

// Store for room management
const rooms = new Map<string, { host?: string; listeners: Set<string> }>()

export async function GET(request: NextRequest) {
  // This endpoint is just for Socket.io initialization
  // The actual Socket.io server is handled in the middleware
  return new Response("Socket.io server running", { status: 200 })
}

// This will be handled by the Socket.io server in the middleware
export const dynamic = "force-dynamic"
