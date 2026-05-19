# Customer Support Chatbot

AI-powered customer support chatbot with Expert System, Sentiment Analysis, and Smart Suggestions.

Built with **React** + **Laravel** + **LLaMA 3** (via Groq API).

## Quick Start

### Backend
```bash
cd laravel-backend
composer install
cp .env.example .env
php artisan key:generate
# Add your GROQ_API_KEY in .env
php artisan serve
```

### Frontend
```bash
cd react-frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

## Features

- 🧠 **Expert System** — Rule-based intent classification (8 rules)
- 💡 **Sentiment Analysis** — Real-time customer emotion detection
- ⚡ **Smart Suggestions** — AI-generated follow-up questions
- 💬 **Chat History** — Persistent conversations via localStorage
- 🌙 **Theme Toggle** — Dark/Light mode
- 👍 **Message Feedback** — Thumbs up/down on responses
- 📝 **Markdown Rendering** — Formatted bot responses

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | Laravel 13 + PHP 8.4 |
| AI Model | LLaMA 3.3 70B via Groq API |
| Expert System | Rule-based PHP intent classifier |
| Styling | Pure CSS (dark/light themes) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Your Groq API key ([get one free](https://console.groq.com)) |
| `FRONTEND_URL` | Frontend URL for CORS (default: `http://localhost:3000`) |
