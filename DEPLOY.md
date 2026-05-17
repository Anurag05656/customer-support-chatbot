# Deployment Guide

## Option 1: Render.com (Recommended — Free)

Deploy both frontend and backend to **Render** for free.

---

### Step 1 — Push to GitHub

```bash
cd ~/Downloads/customer-support-chatbot
git init
git add .
git commit -m "Customer support chatbot - ready for deployment"

# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/customer-support-chatbot.git
git branch -M main
git push -u origin main
```

---

### Step 2 — Deploy Backend (Laravel) on Render

1. Go to [render.com](https://render.com) → Sign up (free)
2. Click **"New" → "Web Service"**
3. Connect your GitHub repo
4. Configure:
   | Setting | Value |
   |---------|-------|
   | **Name** | `chatbot-backend` |
   | **Root Directory** | `laravel-backend` |
   | **Runtime** | `PHP` |
   | **Build Command** | `composer install --no-dev --optimize-autoloader` |
   | **Start Command** | `php artisan serve --host=0.0.0.0 --port=$PORT` |
   | **Instance Type** | `Free` |

5. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `APP_KEY` | (copy from your local `.env`) |
   | `APP_ENV` | `production` |
   | `APP_DEBUG` | `false` |
   | `GROQ_API_KEY` | `gsk_your_key_here` |
   | `FRONTEND_URL` | `https://your-frontend-url.onrender.com` |

6. Click **"Deploy"** — note the URL (e.g. `https://chatbot-backend-xxxx.onrender.com`)

---

### Step 3 — Deploy Frontend (React) on Render

1. Click **"New" → "Static Site"**
2. Connect same GitHub repo
3. Configure:
   | Setting | Value |
   |---------|-------|
   | **Name** | `chatbot-frontend` |
   | **Root Directory** | `react-frontend` |
   | **Build Command** | `npm install && npm run build` |
   | **Publish Directory** | `dist` |

4. Add **Environment Variable**:
   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://chatbot-backend-xxxx.onrender.com` |

5. Click **"Deploy"** 🎉

---

### Step 4 — Update CORS

Go back to the backend service environment variables and update:
- `FRONTEND_URL` = `https://chatbot-frontend-xxxx.onrender.com`

Redeploy the backend.

---

## Option 2: Vercel (Frontend) + Railway (Backend)

### Frontend → Vercel

```bash
cd react-frontend
npx -y vercel --prod
# Follow prompts to login and deploy
# Set env var VITE_API_URL to your backend URL
```

### Backend → Railway

1. Go to [railway.app](https://railway.app) → Sign up
2. Click **"New Project" → "Deploy from GitHub"**
3. Select your repo, set root directory to `laravel-backend`
4. Add environment variables (same as Render list above)
5. Railway auto-detects PHP and deploys

---

## Option 3: VPS / Self-Hosted (DigitalOcean, AWS, etc.)

### Requirements
- Ubuntu 22.04+ server
- PHP 8.2+, Composer, Node.js 18+, Nginx

### Setup

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/customer-support-chatbot.git
cd customer-support-chatbot

# Backend
cd laravel-backend
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
# Edit .env with production values

# Frontend
cd ../react-frontend
echo "VITE_API_URL=https://yourdomain.com" > .env.production
npm install
npm run build

# Copy frontend build to nginx
sudo cp -r dist/* /var/www/chatbot/
```

### Nginx Config

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (static files)
    root /var/www/chatbot;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Start backend
cd laravel-backend
php artisan serve --host=127.0.0.1 --port=8000 &

# Or use PHP-FPM for production
```

---

## Environment Variables Reference

| Variable | Where | Description |
|----------|-------|-------------|
| `GROQ_API_KEY` | Backend | Your Groq API key |
| `APP_KEY` | Backend | Laravel app key (from `php artisan key:generate`) |
| `APP_ENV` | Backend | `production` |
| `APP_DEBUG` | Backend | `false` |
| `FRONTEND_URL` | Backend | Your frontend URL (for CORS) |
| `VITE_API_URL` | Frontend (build-time) | Your backend URL (e.g. `https://api.example.com`) |

---

## Quick Verify After Deploy

```bash
# Test backend health
curl https://your-backend-url.com/api/chat/health

# Expected: {"status":"ok","service":"customer-support-chatbot"}
```
