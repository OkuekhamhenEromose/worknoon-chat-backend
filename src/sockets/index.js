/**
 * Socket.IO Initialization
 * Sets up the server with Redis adapter for horizontal scaling
 * and registers all socket event handlers
 */

const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');

let io = null;

// In-memory presence map: userId → Set of socketIds
// In production with Redis adapter, this is distributed
const presenceMap = new Map();

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:3000',
        process.env.WORDPRESS_URL || 'http://localhost:8080',
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // ── Try to attach Redis adapter ─────────────────────────────────────────
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { getRedisPublisher, getRedisSubscriber } = require('../config/redis');
    const pub = getRedisPublisher();
    const sub = getRedisSubscriber();
    if (pub && sub) {
      io.adapter(createAdapter(pub, sub));
      logger.info('Socket.IO using Redis adapter');
    }
  } catch (_) {
    logger.warn('Socket.IO using in-memory adapter (single instance only)');
  }

  // ── JWT Authentication Middleware ───────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication token required'));

      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('-password -refreshToken');

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.user = user;
      next();
    } catch (err) {
      logger.warn(`Socket auth failed: ${err.message}`);
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection Handler ──────────────────────────────────────────────────
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    logger.info(`Socket connected: ${socket.user.email} [${socket.id}]`);

    // Track presence
    if (!presenceMap.has(userId)) presenceMap.set(userId, new Set());
    presenceMap.get(userId).add(socket.id);

    // Update online status in DB
    await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

    // Join personal room for targeted events
    socket.join(`user:${userId}`);

    // Broadcast online status to contacts
    socket.broadcast.emit('user:online', {
      userId,
      name: socket.user.name,
      profileImage: socket.user.profileImage,
    });

    // ── Register event handlers ───────────────────────────────────────────
    require('./handlers/chat.handler')(io, socket, presenceMap);
    require('./handlers/typing.handler')(io, socket);
    require('./handlers/presence.handler')(io, socket, presenceMap);

    // ── Disconnect Handler ────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: ${socket.user.email} — ${reason}`);

      const sockets = presenceMap.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          presenceMap.delete(userId);

          // All sockets for this user gone — mark offline
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          socket.broadcast.emit('user:offline', {
            userId,
            lastSeen: new Date().toISOString(),
          });
        }
      }
    });

    socket.on('error', (err) => {
      logger.error(`Socket error [${socket.id}]:`, err.message);
    });
  });

  logger.info('Socket.IO server initialized');
  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized — call initSocket first');
  return io;
}

function getPresenceMap() {
  return presenceMap;
}

module.exports = { initSocket, getIO, getPresenceMap };
