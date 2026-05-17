# Customer Support Chatbot

## Quick Start (Development)

```bash
# Backend
cd laravel-backend
composer install
cp .env.example .env
php artisan key:generate
# Add your GROQ_API_KEY in .env
php artisan serve

# Frontend (separate terminal)
cd react-frontend
npm install
npm run dev
```

## Deployment

See `DEPLOY.md` for full deployment instructions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Laravel + PHP 8.4 |
| AI Model | LLaMA 3.3 70B via Groq API |
| Expert System | Rule-based PHP intent classifier |
| Styling | Pure CSS (dark/light themes) |

## Features

- 🧠 **Expert System** — Rule-based intent classification (8 rules)
- 💡 **Sentiment Analysis** — Real-time customer emotion detection
- ⚡ **Smart Suggestions** — AI-generated follow-up questions
- 💬 **Chat History** — Persistent conversations via localStorage
- 🌙 **Theme Toggle** — Dark/Light mode
- 👍 **Message Feedback** — Thumbs up/down on responses
- 📝 **Markdown Rendering** — Formatted bot responses
