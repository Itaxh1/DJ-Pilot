"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Volume2, VolumeX, Radio, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { io, type Socket } from "socket.io-client"

export default function ListenPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const roomId = params.roomId as string

  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")

  const socketRef = useRef<Socket | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!roomId) {
      router.push("/")
      return
    }

    // Initialize Socket.io connection
    socketRef.current = io("/api/socket", {
      query: { roomId, role: "listener" },
    })

    const socket = socketRef.current

    socket.on("connect", () => {
      setConnectionStatus("connected")
      setIsConnected(true)
    })

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected")
      setIsConnected(false)
      setIsPlaying(false)
    })

    socket.on("offer", async ({ from, offer }) => {
      await handleOffer(from, offer)
    })

    socket.on("ice-candidate", async ({ from, candidate }) => {
      if (peerConnectionRef.current && candidate) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      }
    })

    socket.on("host-disconnected", () => {
      setIsPlaying(false)
      toast({
        title: "Host disconnected",
        description: "The stream has ended.",
        variant: "destructive",
      })
    })

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
      socket.disconnect()
    }
  }, [roomId, router, toast])

  const handleOffer = async (hostId: string, offer: RTCSessionDescriptionInit) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    peerConnectionRef.current = pc

    // Handle incoming audio stream
    pc.ontrack = (event) => {
      if (audioRef.current && event.streams[0]) {
        audioRef.current.srcObject = event.streams[0]
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true)
            toast({
              title: "Connected!",
              description: "You're now listening to the live stream.",
            })
          })
          .catch((error) => {
            console.error("Error playing audio:", error)
            toast({
              title: "Playback Error",
              description: "Click the play button to start listening.",
              variant: "destructive",
            })
          })
      }
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", {
          to: hostId,
          candidate: event.candidate,
        })
      }
    }

    // Set remote description and create answer
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    // Send answer back to host
    if (socketRef.current) {
      socketRef.current.emit("answer", {
        to: hostId,
        answer: answer,
      })
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const startListening = async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (error) {
        console.error("Error starting playback:", error)
        toast({
          title: "Playback Error",
          description: "Unable to start audio playback.",
          variant: "destructive",
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Radio className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Listen to Stream</h1>
          </div>
          <Badge variant="outline" className="font-mono text-lg px-3 py-1">
            Room: {roomId}
          </Badge>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Audio Player
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                {connectionStatus === "connecting" && (
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Connecting to room...</span>
                  </div>
                )}

                {connectionStatus === "connected" && !isPlaying && (
                  <div className="space-y-4">
                    <div className="text-gray-600">
                      <p>Ready to listen</p>
                      <p className="text-sm">Waiting for audio stream...</p>
                    </div>
                    <Button onClick={startListening} className="bg-blue-600 hover:bg-blue-700">
                      <Volume2 className="h-4 w-4 mr-2" />
                      Start Listening
                    </Button>
                  </div>
                )}

                {isPlaying && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-600 font-medium">Live Audio</span>
                    </div>

                    <div className="flex justify-center">
                      <Button onClick={toggleMute} variant={isMuted ? "destructive" : "outline"} size="lg">
                        {isMuted ? (
                          <>
                            <VolumeX className="h-5 w-5 mr-2" />
                            Unmute
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-5 w-5 mr-2" />
                            Mute
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {connectionStatus === "disconnected" && (
                  <div className="text-red-600">
                    <p>Disconnected from stream</p>
                    <p className="text-sm">Please refresh to reconnect</p>
                  </div>
                )}
              </div>

              <audio ref={audioRef} autoPlay playsInline className="hidden" />
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="text-center text-sm text-blue-800">
                <p className="font-medium mb-1">Listening Tips</p>
                <ul className="text-left space-y-1">
                  <li>• Use headphones for better audio quality</li>
                  <li>• Make sure your volume is turned up</li>
                  <li>• Keep this tab active for best performance</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
