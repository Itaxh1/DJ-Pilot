"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mic, Users, Radio, Share2 } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  const [roomId, setRoomId] = useState("")

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase()
    setRoomId(id)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Radio className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">LiveStream Audio</h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Stream live audio from your laptop to multiple listeners. Perfect for sharing music, podcasts, or any system
            audio in real-time.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-purple-200 hover:border-purple-300 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mic className="h-6 w-6 text-purple-600" />
                <CardTitle>Start Streaming</CardTitle>
              </div>
              <CardDescription>Host a live audio stream from your laptop</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-id">Room ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="room-id"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    placeholder="Enter or generate room ID"
                    className="font-mono"
                  />
                  <Button onClick={generateRoomId} variant="outline">
                    Generate
                  </Button>
                </div>
              </div>
              <Link href={`/host/${roomId}`} className="block">
                <Button className="w-full bg-purple-600 hover:bg-purple-700" disabled={!roomId}>
                  Start Stream
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 hover:border-blue-300 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-blue-600" />
                <CardTitle>Join Stream</CardTitle>
              </div>
              <CardDescription>Listen to a live audio stream</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="join-room-id">Room ID</Label>
                <Input
                  id="join-room-id"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="Enter room ID to join"
                  className="font-mono"
                />
              </div>
              <Link href={`/listen/${roomId}`} className="block">
                <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={!roomId}>
                  Join Stream
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-gray-600" />
              <CardTitle className="text-lg">How it works</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-purple-600">1</span>
                </div>
                <h3 className="font-semibold mb-1">Setup Audio Routing</h3>
                <p className="text-gray-600">Install virtual audio cable to route system sound</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-purple-600">2</span>
                </div>
                <h3 className="font-semibold mb-1">Start Stream</h3>
                <p className="text-gray-600">Create a room and begin broadcasting audio</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <span className="font-bold text-purple-600">3</span>
                </div>
                <h3 className="font-semibold mb-1">Share & Listen</h3>
                <p className="text-gray-600">Share room ID for others to join and listen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
