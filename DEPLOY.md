# Deployment Guide - Lead Gen Dossier Tool

Deploy both the **Python backend** and **React frontend** to Railway with free tier.

## Quick Start (Railway - 5 minutes)

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (free tier: $5/month credit)

### Step 2: Deploy Backend (Python API)

```bash
# From DDSScraper folder
cd c:\DDSScraper

# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init

# Deploy
railway up
```

After deployment:
1. Go to Railway dashboard
2. Click on your service → Settings → Networking
3. Click "Generate Domain"
4. Copy the URL (e.g., `https://your-backend-abc123.up.railway.app`)

### Step 3: Deploy Frontend (React)

```bash
# From frontend folder
cd c:\DDSScraper\NPResearch\NPResearch

# Create new Railway project for frontend
railway init

# Set the backend URL as environment variable
railway variables set VITE_API_URL=https://your-backend-abc123.up.railway.app

# Deploy
railway up
```

After deployment:
1. Generate a domain for the frontend too
2. Share the frontend URL with users!

---

## Environment Variables

### Backend (main.py)
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8000 |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | localhost |
| `RAILWAY_ENVIRONMENT` | Set automatically by Railway | - |

### Frontend
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API URL | Yes (for production) |

---

## How Users Add Their API Key

1. Users visit your deployed frontend URL
2. Click the **gear icon** (⚙️) in the header
3. Enter their Gemini API key
4. Key is stored **locally in their browser** (never sent to your server)

Get a free API key at: https://aistudio.google.com/app/apikey

---

## Alternative: Docker Deployment

### Backend Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile
```dockerfile
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Troubleshooting

### CORS Errors
If you see CORS errors, add your frontend URL to `ALLOWED_ORIGINS`:
```bash
railway variables set ALLOWED_ORIGINS=https://your-frontend.up.railway.app
```

### Build Fails
Make sure `serve` is installed:
```bash
npm install serve
```

### API Key Not Working
- Gemini API keys start with `AIza...`
- Get one free at: https://aistudio.google.com/app/apikey
- Check browser console for error details

---

## Cost Estimate

**Railway Free Tier:**
- $5/month credit (usually enough for demo use)
- Both services can run within free tier for light usage

**Paid Tier (~$10-20/month):**
- For production use with consistent traffic
