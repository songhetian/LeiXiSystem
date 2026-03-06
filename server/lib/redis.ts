import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // BullMQ 强制要求
};

export const connection = new Redis(redisConfig);

connection.on('error', (err) => {
  console.error('❌ Redis Connection Error:', err);
});

connection.on('connect', () => {
  console.log('✅ Redis Connected for Async Queues');
});
