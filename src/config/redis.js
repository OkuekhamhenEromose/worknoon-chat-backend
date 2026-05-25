/**
 * Redis Configuration
 * Optional — graceful fallback to in-memory if Redis is unavailable
 */

const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient     = null;
let redisPublisher  = null;
let redisSubscriber = null;

async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  const makeClient = () => {
    const cfg = {
      url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries >= 3) return new Error('Redis max retries reached');
          return Math.min(retries * 200, 1000);
        },
        connectTimeout: 3000,
      },
    };
    if (process.env.REDIS_PASSWORD) cfg.password = process.env.REDIS_PASSWORD;
    return createClient(cfg);
  };

  // Create clients but DO NOT assign to module-level vars yet
  const c = makeClient();
  const p = makeClient();
  const s = makeClient();

  // Suppress error events BEFORE connecting — prevents unhandled error crashes
  c.on('error', () => {});
  p.on('error', () => {});
  s.on('error', () => {});

  try {
    await Promise.all([c.connect(), p.connect(), s.connect()]);
  } catch (err) {
    // Clean up whichever clients managed to connect before failure
    await Promise.allSettled([c.quit(), p.quit(), s.quit()]);
    // Module-level vars stay null — getRedis*() returns null — adapter skipped
    throw err;
  }

  // Only assign after ALL three succeed
  redisClient     = c;
  redisPublisher  = p;
  redisSubscriber = s;

  logger.info('Redis connected');
  return { redisClient, redisPublisher, redisSubscriber };
}

async function disconnectRedis() {
  await Promise.allSettled([
    redisClient?.quit(),
    redisPublisher?.quit(),
    redisSubscriber?.quit(),
  ]);
  redisClient = redisPublisher = redisSubscriber = null;
}

function getRedisClient()     { return redisClient; }
function getRedisPublisher()  { return redisPublisher; }
function getRedisSubscriber() { return redisSubscriber; }

module.exports = {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  getRedisPublisher,
  getRedisSubscriber,
};