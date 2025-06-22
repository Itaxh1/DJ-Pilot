"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MicOff, Users, Copy, Radio, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { io, type Socket } from "socket.io-client"

export default function HostPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const roomId = params.roomId as string

  const [isStreaming, setIsStreaming] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [listeners, setListeners] = useState<string[]>([])
  const [audioLevel, setAudioLevel] = useState(0)

  const socketRef = useRef<Socket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    if (!roomId) {
      router.push("/")
      return
    }

    // Initialize Socket.io connection
    socketRef.current = io("/api/socket", {
      query: { roomId, role: "host" },
    })

    const socket = socketRef.current

    socket.on("listener-joined", (listenerId: string) => {
      setListeners((prev) => [...prev, listenerId])
      if (streamRef.current) {
        createPeerConnection(listenerId)
      }
    })

    socket.on("listener-left", (listenerId: string) => {
      setListeners((prev) => prev.filter((id) => id !== listenerId))
      const pc = peerConnectionsRef.current.get(listenerId)
      if (pc) {
        pc.close()
        peerConnectionsRef.current.delete(listenerId)
      }
    })

    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current.get(from)
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    })

    socket.on("answer", async ({ from, answer }) => {
      const pc = peerConnectionsRef.current.get(from)
      if (pc && answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      }
    })

    return () => {
      stopStreaming()
      socket.disconnect()
    }
  }, [roomId, router])

  const createPeerConnection = async (listenerId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    peerConnectionsRef.current.set(listenerId, pc)

    // Add audio track
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current!)
      })
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          to: listenerId,
          candidate: event.candidate,
        })
      }
    }

    // Create and send offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    if (socketRef.current) {
      socketRef.current.emit("offer", {
        to: listenerId,
        offer: offer,
      })
    }
  }

  const startStreaming = async () => {
    try {
      // Request microphone access (which should be your virtual audio cable)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        },
      })

      streamRef.current = stream
      setIsStreaming(true)

      // Setup audio analysis for visual feedback
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // Start audio level monitoring
      monitorAudioLevel()

      // Create peer connections for existing listeners
      listeners.forEach((listenerId) => {
        createPeerConnection(listenerId)
      })

      toast({
        title: "Stream started!",
        description: "You're now broadcasting live audio.",
      })
    } catch (error) {
      console.error("Error starting stream:", error)
      toast({
        title: "Error",
        description: "Failed to access microphone. Make sure you have a virtual audio cable set up.",
        variant: "destructive",
      })
    }
  }

  const stopStreaming = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()

    setIsStreaming(false)
    setAudioLevel(0)
  }

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

    const updateLevel = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length
      setAudioLevel((average / 255) * 100)

      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  const copyRoomLink = () => {
    const link = `${window.location.origin}/listen/${roomId}`
    navigator.clipboard.writeText(link)
    toast({
      title: "Link copied!",
      description: "Share this link with listeners.",
    })
  }

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/listen/${roomId}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Radio className="h-6 w-6 text-purple-600" />
            <h1 className="text-2xl font-bold">Host Stream</h1>
          </div>
          <Badge variant="outline" className="font-mono text-lg px-3 py-1">
            Room: {roomId}
          </Badge>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Audio Stream Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isStreaming ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 mb-1">Setup Required</p>
                        <p className="text-amber-700">
                          Make sure you have virtual audio routing set up to capture system sound. When you click start,
                          select your virtual audio cable as the microphone.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={startStreaming} className="w-full bg-purple-600 hover:bg-purple-700">
                    <Mic className="h-4 w-4 mr-2" />
                    Start Streaming
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-medium">Live</span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all duration-100"
                          style={{ width: `${audioLevel}%` }}
                        ></div>
                      </div>
                    </div>
                    <Button onClick={toggleMute} variant={isMuted ? "destructive" : "outline"} size="sm">
                      {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button onClick={stopStreaming} variant="destructive" className="w-full">
                    Stop Streaming
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Listeners ({listeners.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listeners.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No listeners yet</p>
              ) : (
                <div className="space-y-2">
                  {listeners.map((listenerId, index) => (
                    <div key={listenerId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Listener {index + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share Stream</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded text-sm bg-gray-50"
                />
                <Button onClick={copyRoomLink} variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-600">Share this link with people who want to listen to your stream.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
