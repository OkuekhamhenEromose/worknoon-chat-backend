require('dotenv').config();

const http = require('http');
const app = require('./app');
const { initSocket } = require('./sockets');
const connectDB = require('./config/database');
const { connectRedis } = require('./config/redis');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5001;

async function bootstrap() {
  try {
    await connectDB();
    logger.info('✅ MongoDB connected');

    // Redis is optional — swallow ALL errors here, never let them propagate
    await connectRedis().catch((err) => {
      logger.warn(`⚠️  Redis unavailable (${err.message}) — falling back to in-memory adapter.`);
    });

    const server = http.createServer(app);
    initSocket(server);
    logger.info('✅ Socket.IO initialized');

    server.listen(PORT, () => {
      logger.info(`🚀 Worknoon Chat API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

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