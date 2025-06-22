# Live Audio Streaming Backend

A Node.js backend server for real-time audio streaming using WebRTC and Socket.io. Stream system audio from your laptop to multiple listeners on mobile devices.

## 🚀 Features

- **Real-time Audio Streaming**: WebRTC-based low-latency audio transmission
- **Multi-listener Support**: Host can broadcast to unlimited listeners
- **Room Management**: Simple room-based sessions with unique IDs
- **WebRTC Signaling**: Complete offer/answer/ICE candidate handling
- **Connection Management**: Automatic cleanup and reconnection handling
- **REST API**: Room status and management endpoints

## 📋 Prerequisites

### Virtual Audio Routing Setup

**Windows:**
1. Download [VB-Audio Virtual Cable](https://vb-audio.com/Cable/)
2. Install and restart your computer
3. Set "CABLE Input" as your default playback device
4. Your system audio will now route through the virtual cable
5. When streaming, select "CABLE Output" as microphone

**macOS:**
1. Install [BlackHole](https://github.com/ExistentialAudio/BlackHole) (free) or [Loopback](https://rogueamoeba.com/loopback/) (paid)
2. Create a Multi-Output Device in Audio MIDI Setup
3. Include both your speakers and BlackHole
4. Set this as your default output device
5. When streaming, select BlackHole as microphone

## 🛠️ Installation

1. **Clone and install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start the server:**
   \`\`\`bash
   # Development mode with auto-restart
   npm run dev
   
   # Production mode
   npm start
   \`\`\`

3. **Access the application:**
   \`\`\`
   http://localhost:3000
   \`\`\`

## 📡 API Endpoints

### GET /api/rooms/:roomId
Get room information
\`\`\`json
{
  "roomId": "ABC123",
  "hasHost": true,
  "listenerCount": 3,
  "isActive": true
}
\`\`\`

### POST /api/rooms
Create a new room
\`\`\`json
{
  "roomId": "XYZ789"
}
\`\`\`

### GET /api/rooms
List all active rooms
\`\`\`json
{
  "rooms": [
    {
      "roomId": "ABC123",
      "listenerCount": 3,
      "createdAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
\`\`\`

## 🔌 Socket.io Events

### Client to Server

- `join-room`: Join a room as host or listener
- `offer`: WebRTC offer from host to listener
- `answer`: WebRTC answer from listener to host
- `ice-candidate`: ICE candidate exchange
- `mute-stream`: Host mutes the stream
- `unmute-stream`: Host unmutes the stream

### Server to Client

- `host-joined`: Host successfully joined room
- `listener-joined`: New listener joined
- `listener-left`: Listener disconnected
- `listener-count-updated`: Updated listener count
- `host-connected`: Host is available
- `host-disconnected`: Host left the room
- `host-muted`: Host muted the stream
- `host-unmuted`: Host unmuted the stream

## 🎵 How to Use

### For Hosts:
1. Set up virtual audio routing on your laptop
2. Visit `http://localhost:3000`
3. Generate or enter a room ID
4. Click "Start Stream"
5. Allow microphone access and select virtual audio cable
6. Share the listener link with others
7. Start playing audio (Spotify, YouTube, etc.)

### For Listeners:
1. Open the shared link on any device
2. Click "Join Stream"
3. Click "Ready to Listen" when prompted
4. Adjust volume as needed
5. Use headphones for best quality

## 🚀 Deployment

### Heroku
\`\`\`bash
# Install Heroku CLI and login
heroku create your-app-name
git push heroku main
\`\`\`

### Railway
\`\`\`bash
# Connect your GitHub repo to Railway
# Set PORT environment variable if needed
\`\`\`

### VPS/Cloud Server
\`\`\`bash
# Install Node.js and PM2
npm install -g pm2
pm2 start server.js --name "audio-stream"
pm2 startup
pm2 save
\`\`\`

## 🔧 Configuration

### Environment Variables
\`\`\`bash
PORT=3000                    # Server port (default: 3000)
NODE_ENV=production         # Environment mode
\`\`\`

### STUN Servers
The app uses Google's public STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`

For production, consider using your own STUN/TURN servers.

## 🐛 Troubleshooting

### Audio Not Working
- Ensure virtual audio cable is properly configured
- Check browser permissions for microphone access
- Verify the correct audio input device is selected
- Test with headphones to avoid feedback

### Connection Issues
- Check firewall settings for WebRTC ports
- Ensure STUN servers are accessible
- Try refreshing both host and listener pages
- Check browser console for error messages

### Performance Issues
- Use wired internet connection for hosting
- Limit number of concurrent listeners (WebRTC mesh)
- Consider implementing SFU for scalability
- Monitor server resources and connection quality

## 📱 Browser Compatibility

- **Chrome/Chromium**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 11+)
- **Edge**: Full support

## 🔒 Security Considerations

- Rooms are not password protected
- Use HTTPS in production for WebRTC
- Implement rate limiting for room creation
- Consider adding authentication for sensitive use cases

## 📈 Scaling

For high-scale deployments:
- Implement SFU (Selective Forwarding Unit)
- Use Redis for session management
- Add load balancing for multiple server instances
- Monitor bandwidth and connection quality

## 📄 License

MIT License - feel free to use for personal and commercial projects.
