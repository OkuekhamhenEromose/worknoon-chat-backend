# worknoon-chat-backend

Real-time chat API for the Worknoon eCommerce platform — built with **Node.js**, **Express**, **MongoDB**, and **Socket.IO**.

---

## Demo Walkthrough

🎥 **Frontend Demo Video**

Watch the full implementation walkthrough here:

**Loom:** https://www.loom.com/share/033dfeb161ca406793f939a203976388

### Walkthrough Covers

- Authentication flow and role selection
- Real-time messaging with Socket.IO
- Inbox and chat experience
- Typing indicators and online presence
- File upload support
- Notifications system
- Profile management
- Admin dashboard analytics
- Dark/light theme switching
- Offline support through Service Worker
- Frontend architecture and design decisions

---

## Project Goal

The goal of this frontend implementation is to provide a clean, responsive, and scalable chat experience suitable for an eCommerce environment where customers, agents, merchants, and designers can communicate in real time.

The application focuses on:

- Performance
- Responsive UX
- Authentication and security
- Real-time interactions
- Maintainable architecture
- Accessibility and scalability

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Database | MongoDB (Mongoose 8) |
| Real-time | Socket.IO 4 |
| Auth | JWT (access + refresh tokens, httpOnly cookies) |
| File uploads | Multer + Sharp (image thumbnails) |
| Email | Nodemailer (SMTP) |
| Caching / Scaling | Redis (optional — in-memory fallback) |
| Logging | Winston |
| Security | Helmet, express-mongo-sanitize, express-rate-limit, CORS |

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/your-org/worknoon-chat-backend.git
cd worknoon-chat-backend

# 2. Install
npm install

# 3. Configure
cp .env.example .env
# Edit .env — set MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET at minimum

# 4. Run dev server (nodemon)
npm run dev

# 5. Health check
curl http://localhost:5001/health
```

---

## Environment Variables

See `.env.example` for the full list. Required keys:

```
MONGODB_URI          # MongoDB connection string
JWT_SECRET           # Access token signing secret (≥ 32 chars)
JWT_REFRESH_SECRET   # Refresh token signing secret (≥ 32 chars)
```

Optional (sensible defaults provided):
```
PORT                 # Default 5001
REDIS_URL            # For Socket.IO horizontal scaling
UPLOAD_PATH          # File upload directory (default ./uploads)
MAX_FILE_SIZE        # Bytes (default 10485760 = 10 MB)
ALLOWED_FILE_TYPES   # Comma-separated MIME types
SMTP_HOST / SMTP_USER / SMTP_PASS  # Email notifications
LOG_LEVEL            # winston level (debug | info | warn | error)
LOG_DIR              # Log file directory (production only)
```

> **Security note:** `JWT_EXPIRES_IN=15m` is recommended for production. The `.env.example` uses `7d` for development convenience only.

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, receive JWT |
| POST | `/api/auth/refresh` | Rotate access token |
| POST | `/api/auth/logout` | Invalidate session |
| GET  | `/api/auth/me` | Current user profile |

### Conversations
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/conversations` | Create or retrieve direct conversation |
| GET  | `/api/conversations` | List user's conversations (paginated) |
| GET  | `/api/conversations/:id` | Single conversation |
| DELETE | `/api/conversations/:id` | Archive (soft-delete) |

### Messages
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/messages` | Send message (supports file attachments) |
| GET  | `/api/messages/:conversationId` | Paginated message history |
| PUT  | `/api/messages/:id/read` | Mark single message read |
| PUT  | `/api/messages/read-all/:conversationId` | Mark all read |
| DELETE | `/api/messages/:id` | Soft-delete message |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | List notifications |
| PUT | `/api/notifications/read-all` | Mark all read |
| PUT | `/api/notifications/:id/read` | Mark one read |
| DELETE | `/api/notifications/:id` | Delete notification |

### Uploads
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/uploads/avatar` | Upload profile image |
| POST | `/api/uploads/message-files` | Upload message attachments |

---

## Socket.IO Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_conversation` | `conversationId` | Join a room |
| `leave_conversation` | `conversationId` | Leave a room |
| `send_message` | `{ conversationId, content, tempId }` | Send real-time message |
| `typing_start` | `{ conversationId, userId, userName }` | Start typing indicator |
| `typing_stop` | `{ conversationId, userId, userName }` | Stop typing indicator |
| `mark_read` | `{ conversationId, messageId }` | Mark message read |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | `{ conversationId, message, tempId }` | Incoming message |
| `typing_update` | `{ conversationId, userId, userName, isTyping }` | Typing status |
| `online_status` | `{ userId, isOnline, lastSeen }` | Presence update |
| `message_read` | `{ messageId, conversationId, readBy }` | Read receipt |
| `message_error` | `{ tempId, error }` | Send failure |

### Authentication
Pass the JWT in the Socket.IO handshake:
```js
const socket = io('http://localhost:5001', {
  auth: { token: 'your_jwt_here' }
});
```

---

## User Roles

| Role | Can do |
|------|--------|
| `admin` | Full access, manage all users and conversations |
| `agent` | Handle customer conversations |
| `customer` | Start conversations with agents / designers / merchants |
| `designer` | Receive design enquiries |
| `merchant` | Receive product enquiries |

---

## Project Structure

```
src/
├── app.js               Express application setup
├── server.js            Entry point (HTTP + Socket.IO bootstrap)
├── config/
│   ├── database.js      MongoDB connection
│   └── redis.js         Redis connection (optional)
├── controllers/         Route handlers
├── middlewares/
│   ├── auth.middleware.js   JWT protect + authorize
│   ├── upload.middleware.js Multer configuration
│   └── errorHandler.js     Global error handler
├── models/              Mongoose schemas
├── routes/              Express routers
├── sockets/             Socket.IO event handlers
└── utils/               logger, apiResponse, pagination, email
```

---

## Challenges & Design Decisions

- **JWT dual-token pattern**: Short-lived access tokens (15 min) stored in httpOnly cookies prevent XSS token theft; refresh tokens rotate on each use to detect replay attacks.
- **Soft deletes everywhere**: Messages and conversations are never hard-deleted — `isDeleted` / `isActive` flags preserve audit trails.
- **Redis optional**: Socket.IO falls back to the in-memory adapter when Redis is unavailable, allowing single-node development without Docker.
- **Unread counts via Map**: `Conversation.unreadCounts` is a `Map<userId, number>` so O(1) lookup per participant rather than a collection scan.
- **CORS + WordPress**: The `WORDPRESS_URL` origin is explicitly allowed so the WP plugin's REST proxy works cross-origin.