/**
 * Worknoon Chat Backend — Entry Point
 * Production-grade Node.js / Express / Socket.IO server
 */

const http = require('http');
const app = require('./app');
const { initSocket } = require('./sockets');
const connectDB = require('./config/database');
const connectRedis = require('./config/redis');
const logger = require('./utils/logger');

require('dotenv').config();

const PORT = process.env.PORT || 5000;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    // 1. Connect to MongoDB
    await connectDB();
    logger.info('✅ MongoDB connected');

    // 2. Connect to Redis (optional — graceful fallback)
    try {
      await connectRedis();
      logger.info('✅ Redis connected');
    } catch (err) {
      logger.warn('⚠️  Redis unavailable — socket scaling disabled. Falling back to in-memory adapter.');
    }

    // 3. Create HTTP server
    const server = http.createServer(app);

    // 4. Initialize Socket.IO
    initSocket(server);
    logger.info('✅ Socket.IO initialized');

    // 5. Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 Worknoon Chat API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    // ─── Graceful Shutdown ───────────────────────────────────────────────────
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Promise Rejection:', reason);
      process.exit(1);
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();
