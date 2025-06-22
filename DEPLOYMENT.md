# Cloud Run Deployment Guide

This guide covers deploying the LiveStream Audio application to Google Cloud Run.

## 🚀 Quick Deploy

### Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed and authenticated
3. **Docker** installed locally

### One-Command Deploy

\`\`\`bash
# Make deploy script executable
chmod +x deploy.sh

# Set your project ID and deploy
export GOOGLE_CLOUD_PROJECT=your-project-id
./deploy.sh
\`\`\`

## 📋 Manual Deployment Steps

### 1. Setup Google Cloud Project

\`\`\`bash
# Set project ID
export PROJECT_ID=your-project-id
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
\`\`\`

### 2. Build and Push Docker Image

\`\`\`bash
# Build the image
docker build -t gcr.io/$PROJECT_ID/livestream-audio .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/livestream-audio
\`\`\`

### 3. Deploy to Cloud Run

\`\`\`bash
gcloud run deploy livestream-audio \
  --image gcr.io/$PROJECT_ID/livestream-audio \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 10 \
  --set-env-vars "NODE_ENV=production,MAX_ROOMS=200"
\`\`\`

## ⚙️ Configuration Options

### Environment Variables

Set these during deployment:

\`\`\`bash
--set-env-vars "NODE_ENV=production,MAX_ROOMS=200,ROOM_TIMEOUT_HOURS=12,MAX_CONNECTIONS=100,CORS_ORIGIN=*"
\`\`\`

### Resource Limits

- **Memory**: 1Gi (recommended for WebRTC)
- **CPU**: 1 vCPU (can scale down to 0.1)
- **Concurrency**: 100 connections per instance
- **Timeout**: 300 seconds for long connections

## 🔧 Advanced Configuration

### Custom Domain

\`\`\`bash
# Map custom domain
gcloud run domain-mappings create \
  --service livestream-audio \
  --domain your-domain.com \
  --region us-central1
\`\`\`

### SSL Certificate

Cloud Run automatically provides SSL certificates for custom domains.

### Scaling Configuration

\`\`\`bash
# Set scaling parameters
gcloud run services update livestream-audio \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 20 \
  --concurrency 50
\`\`\`

## 📊 Monitoring

### Cloud Console

Monitor your service at:
\`\`\`
https://console.cloud.google.com/run/detail/us-central1/livestream-audio
\`\`\`

### Logs

\`\`\`bash
# View logs
gcloud run logs tail livestream-audio --region us-central1

# Follow logs in real-time
gcloud run logs tail livestream-audio --region us-central1 --follow
\`\`\`

### Metrics

Key metrics to monitor:
- **Request Count**: Number of HTTP requests
- **Request Latency**: Response time
- **Container CPU/Memory**: Resource usage
- **Active Connections**: WebSocket connections

## 🔒 Security

### IAM Permissions

For production, restrict access:

\`\`\`bash
# Remove public access
gcloud run services remove-iam-policy-binding livestream-audio \
  --region us-central1 \
  --member allUsers \
  --role roles/run.invoker

# Add specific users
gcloud run services add-iam-policy-binding livestream-audio \
  --region us-central1 \
  --member user:user@example.com \
  --role roles/run.invoker
\`\`\`

### CORS Configuration

Set specific origins in production:

\`\`\`bash
--set-env-vars "CORS_ORIGIN=https://yourdomain.com"
\`\`\`

## 💰 Cost Optimization

### Pricing Factors

- **CPU allocation**: Billed per vCPU-second
- **Memory allocation**: Billed per GB-second  
- **Requests**: First 2 million free per month
- **Networking**: Egress traffic charges

### Optimization Tips

1. **Set min-instances to 0** for cost savings
2. **Use appropriate memory/CPU** allocation
3. **Monitor and adjust** concurrency settings
4. **Implement connection limits** to prevent abuse

## 🐛 Troubleshooting

### Common Issues

**Cold Start Delays:**
\`\`\`bash
# Set minimum instances
gcloud run services update livestream-audio \
  --region us-central1 \
  --min-instances 1
\`\`\`

**Memory Issues:**
\`\`\`bash
# Increase memory allocation
gcloud run services update livestream-audio \
  --region us-central1 \
  --memory 2Gi
\`\`\`

**Connection Timeouts:**
\`\`\`bash
# Increase timeout
gcloud run services update livestream-audio \
  --region us-central1 \
  --timeout 600
\`\`\`

### Debug Commands

\`\`\`bash
# Check service status
gcloud run services describe livestream-audio --region us-central1

# Test health endpoint
curl https://your-service-url/api/health

# Check recent logs
gcloud run logs read livestream-audio --region us-central1 --limit 50
\`\`\`

## 🔄 CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:

\`\`\`yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - uses: google-github-actions/setup-gcloud@v0
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}
    
    - name: Build and Deploy
      run: |
        gcloud builds submit --config cloudbuild.yaml
\`\`\`

### Cloud Build Trigger

Set up automatic builds from your repository:

\`\`\`bash
gcloud builds triggers create github \
  --repo-name your-repo \
  --repo-owner your-username \
  --branch-pattern main \
  --build-config cloudbuild.yaml
\`\`\`

## 📈 Scaling Considerations

### WebRTC Limitations

- **Mesh topology**: Each host connects to all listeners
- **Bandwidth**: Scales linearly with listener count
- **CPU**: Encoding overhead per connection

### Recommended Limits

- **Max listeners per room**: 10-20 for mesh topology
- **Max concurrent rooms**: 50-100 per instance
- **Instance scaling**: Use multiple instances for more rooms

### SFU Architecture

For larger scale, consider implementing SFU (Selective Forwarding Unit):
- Single connection from host to server
- Server forwards to all listeners
- Better bandwidth efficiency
- More complex implementation

This deployment configuration provides a production-ready setup optimized for Google Cloud Run's serverless architecture.
