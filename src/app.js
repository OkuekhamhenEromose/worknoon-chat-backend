const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const compression  = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const authWpRoutes       = require('./routes/auth-wordpress.routes');
const userRoutes         = require('./routes/user.routes');
const conversationRoutes = require('./routes/conversation.routes');
const messageRoutes      = require('./routes/message.routes');
const notificationRoutes = require('./routes/notification.routes');
const uploadRoutes       = require('./routes/upload.routes');
const wooRoutes          = require('./routes/woo.routes');

require('dotenv').config();

const app = express();

// ─── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.WORDPRESS_URL || 'http://localhost:8080',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Worknoon-Secret'],
}));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  message:  { success: false, message: 'Too many requests — please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { success: false, message: 'Too many auth attempts — please try again later.' },
});
app.use('/api/auth/', authLimiter);

// ─── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── HTTP Request Logging ─────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success:     true,
    message:     'Worknoon Chat API is running',
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);          // register, login, logout, me, refresh
app.use('/api/auth',          authWpRoutes);         // POST /api/auth/wordpress-sso
app.use('/api/users',         userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/uploads',       uploadRoutes);
app.use('/api/woo',           wooRoutes);            // POST /api/woo/order-sync, /order-created

// ─── 404 + Global Error Handler ───────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;