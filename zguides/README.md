# TutorSaaS - WhatsApp AI Assistant + Tutor Dashboard

Production-ready SaaS system for Sri Lankan tuition classes.

## Quick Start

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Configure environment
cp .env.example .env
# Edit .env with your OpenAI API key

# 3. Seed database with sample data
npm run seed

# 4. Start development
npm run dev
```

**Login:** `admin@tutor.lk` / `admin123`

## Architecture

```
├── server/             # Node.js + Express backend
│   ├── db/             # SQLite database (sql.js)
│   ├── middleware/      # Auth (JWT) + error handler
│   ├── routes/         # REST API endpoints
│   ├── services/       # WhatsApp + AI services
│   ├── websocket.js    # Real-time WA status
│   └── index.js        # Entry point
├── client/             # React + Vite frontend
│   └── src/
│       ├── context/    # Auth + WebSocket providers
│       ├── pages/      # Dashboard, Students, etc.
│       ├── api.js      # API client
│       └── App.jsx     # Main app with routing
├── data/               # SQLite database file
└── .env                # Environment config
```

## Features

- **Student Management** — Full CRUD, search, filter by grade, status toggle
- **Class Scheduling** — Create/edit classes with day, time, location
- **Payment Tracking** — Monthly records, bulk generation, status management, analytics
- **WhatsApp Integration** — Direct messaging, broadcast, auto-reconnect, QR auth
- **AI Assistant** — GPT-4o-mini for Sinhala-English message generation, rephrasing
- **Message Templates** — Pre-built templates with variable substitution
- **Real-time Updates** — WebSocket for live WhatsApp status
- **Dashboard Analytics** — Revenue trends, payment summary, student breakdown

## Production Deployment

```bash
# Build frontend
cd client && npm run build && cd ..

# Set environment
export NODE_ENV=production
export PORT=3001

# Start
node server/index.js
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | ❌ | Login |
| POST | /api/auth/register | ❌ | Register |
| GET | /api/students | ✅ | List students |
| POST | /api/students | ✅ | Add student |
| PUT | /api/students/:id | ✅ | Update student |
| DELETE | /api/students/:id | ✅ | Delete student |
| GET | /api/classes | ✅ | List classes |
| POST/PUT/DELETE | /api/classes/:id | ✅ | Manage classes |
| GET | /api/payments | ✅ | List payments |
| POST | /api/payments/generate | ✅ | Bulk generate |
| GET | /api/payments/summary | ✅ | Payment analytics |
| POST | /api/whatsapp/send | ✅ | Send message |
| POST | /api/whatsapp/broadcast | ✅ | Broadcast |
| GET | /api/whatsapp/status | ✅ | WA status |
| POST | /api/ai/generate | ✅ | AI message |
| POST | /api/ai/rephrase | ✅ | AI rephrase |
| GET | /api/dashboard/summary | ✅ | Dashboard data |
