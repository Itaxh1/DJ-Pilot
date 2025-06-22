# LiveStream Audio

A real-time audio streaming application that allows users to broadcast live audio from their device to multiple listeners using WebRTC and Socket.io.

## 🚀 Features

- **Real-time Audio Streaming**: Low-latency audio transmission using WebRTC
- **Multiple Audio Sources**: Support for system audio (screen share) and microphone input
- **Multi-listener Support**: Broadcast to unlimited listeners simultaneously
- **Room-based Sessions**: Simple room management with unique IDs
- **Responsive Design**: Works on desktop and mobile devices
- **Production Ready**: Configurable for deployment with environment variables

## 📋 Quick Start

### 1. Installation

\`\`\`bash
# Clone the repository
git clone <repository-url>
cd livestream-audio

# Install dependencies
npm install
\`\`\`

### 2. Configuration

Copy the example environment file and configure as needed:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your configuration:

\`\`\`env
PORT=3000
HOST=0.0.0.0
DOMAIN=yourdomain.com  # Optional: for production
MAX_ROOMS=100
ROOM_TIMEOUT_HOURS=24
\`\`\`

### 3. Run the Application

\`\`\`bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
\`\`\`

### 4. Access the Application

- Local: `http://localhost:3000`
- Network: `http://[your-ip]:3000`

## 🎵 How to Use

### For Hosts (Broadcasters):

1. **Visit the homepage** and generate or enter a room ID
2. **Click "Start Broadcasting"** to enter the host interface
3. **Choose your audio source**:
   - **System Audio**: Select screen share and check "Share system audio" for music/videos
   - **Microphone**: Select microphone input for voice streaming
4. **Start streaming** and share the listener link with your audience
5. **Monitor listeners** and control your stream (mute/unmute, stop)

### For Listeners:

1. **Open the shared link** or enter the room ID on the homepage
2. **Click "Join & Listen"** to enter the listener interface
3. **Click "Ready to Listen"** when prompted (if needed)
4. **Adjust volume** and enjoy the stream
5. **Use headphones** for the best experience

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host (use 0.0.0.0 for network access) |
| `DOMAIN` | `null` | Public domain for production deployment |
| `CORS_ORIGIN` | `*` | CORS origin policy |
| `NODE_ENV` | `development` | Environment mode |
| `MAX_ROOMS` | `100` | Maximum concurrent rooms |
| `ROOM_TIMEOUT_HOURS` | `24` | Room cleanup timeout |
| `STUN_SERVERS` | Google STUN | Comma-separated STUN server URLs |

### Production Deployment

For production deployment, set these environment variables:

\`\`\`env
NODE_ENV=production
DOMAIN=livestream.yourdomain.com
CORS_ORIGIN=https://livestream.yourdomain.com
MAX_ROOMS=500
ROOM_TIMEOUT_HOURS=12
\`\`\`

## 🌐 Deployment

### Heroku

\`\`\`bash
# Install Heroku CLI and login
heroku create your-app-name
heroku config:set NODE_ENV=production
heroku config:set DOMAIN=your-app-name.herokuapp.com
git push heroku main
\`\`\`

### Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in the Railway dashboard
3. Deploy automatically on push

### VPS/Cloud Server

\`\`\`bash
# Install Node.js and PM2
npm install -g pm2

# Set environment variables
export NODE_ENV=production
export DOMAIN=yourdomain.com

# Start with PM2
pm2 start server.js --name "livestream-audio"
pm2 startup
pm2 save
\`\`\`

### Docker

\`\`\`dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
\`\`\`

## 🔒 Security Considerations

- Rooms are not password protected by default
- Use HTTPS in production for WebRTC functionality
- Configure CORS_ORIGIN for production deployments
- Consider implementing rate limiting for room creation
- Monitor server resources and connection limits

## 🛠️ Technical Details

### Architecture

- **Frontend**: Vanilla HTML/CSS/JavaScript with modern browser APIs
- **Backend**: Node.js with Express and Socket.io
- **Real-time Communication**: WebRTC for peer-to-peer audio streaming
- **Signaling**: Socket.io for WebRTC signaling and room management

### Browser Compatibility

- **Chrome/Chromium**: Full support ✅
- **Firefox**: Full support ✅
- **Safari**: Full support (iOS 11+) ✅
- **Edge**: Full support ✅

### Audio Quality

- **Sample Rate**: 48kHz
- **Channels**: Stereo (2 channels)
- **Codec**: Browser-dependent (typically Opus)
- **Latency**: ~100-300ms depending on network conditions

## 🐛 Troubleshooting

### Common Issues

**No Audio Streaming:**
- Ensure "Share system audio" is checked when using screen share
- Verify microphone permissions are granted
- Check that the correct audio input device is selected

**Connection Issues:**
- Verify firewall settings allow WebRTC traffic
- Ensure STUN servers are accessible
- Try refreshing both host and listener pages

**Performance Issues:**
- Use wired internet connection for hosting
- Limit number of concurrent listeners for mesh topology
- Monitor server resources and network bandwidth

### Debug Mode

The application includes comprehensive error handling and status messages. Check the browser console for detailed error information.

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review browser console for errors
- Ensure all dependencies are installed correctly
- Verify environment configuration
