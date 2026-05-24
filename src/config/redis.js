/**
 * Redis Configuration
 * Used for Socket.IO adapter scaling across multiple server instances
 */

const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;
let redisPublisher = null;
let redisSubscriber = null;

async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  const clientConfig = {
    url,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 2000) },
  };

  if (process.env.REDIS_PASSWORD) {
    clientConfig.password = process.env.REDIS_PASSWORD;
  }

  redisClient = createClient(clientConfig);
  redisPublisher = redisClient.duplicate();
  redisSubscriber = redisClient.duplicate();

  redisClient.on('error', (err) => logger.error('Redis client error:', err));
  redisPublisher.on('error', (err) => logger.error('Redis publisher error:', err));
  redisSubscriber.on('error', (err) => logger.error('Redis subscriber error:', err));

  await Promise.all([
    redisClient.connect(),
    redisPublisher.connect(),
    redisSubscriber.connect(),
  ]);

  return { redisClient, redisPublisher, redisSubscriber };
}

function getRedisClient() { return redisClient; }
function getRedisPublisher() { return redisPublisher; }
function getRedisSubscriber() { return redisSubscriber; }

module.exports = {
  connectRedis,
  getRedisClient,
  getRedisPublisher,
  getRedisSubscriber,
};
