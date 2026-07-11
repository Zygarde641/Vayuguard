const redis = require('redis');
const logger = require('./logger');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    reconnectStrategy: (retries) => Math.min(retries * 200, 5000)
  }
});

let errorLogged = false;
client.on('error', (err) => {
  if (!errorLogged) {
    logger.error(`Redis unavailable, caching disabled until reconnect: ${err.message}`);
    errorLogged = true;
  }
});

client.on('ready', () => {
  errorLogged = false;
  logger.info('Redis connected');
});

client.connect().catch(() => {}); // failures surface via the error event

// Cache must never take the API down — every operation falls back to "no cache"
module.exports = {
  async get(key) {
    if (!client.isReady) return null;
    try {
      return await client.get(key);
    } catch (err) {
      logger.warn(`Redis GET failed for ${key}: ${err.message}`);
      return null;
    }
  },

  async setex(key, ttlSeconds, value) {
    if (!client.isReady) return;
    try {
      await client.setEx(key, ttlSeconds, value);
    } catch (err) {
      logger.warn(`Redis SETEX failed for ${key}: ${err.message}`);
    }
  }
};
