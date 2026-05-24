/**
 * MongoDB Connection Configuration
 * Handles connection pooling, retry logic, and graceful disconnection
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/worknoon_chat';

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
};

async function connectDB() {
  try {
    const conn = await mongoose.connect(MONGO_URI, options);
    logger.info(`MongoDB connected: ${conn.connection.host} — DB: ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — attempting reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return conn;
  } catch (err) {
    logger.error('MongoDB initial connection failed:', err.message);
    throw err;
  }
}

module.exports = connectDB;
