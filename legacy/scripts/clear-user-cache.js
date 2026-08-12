const Redis = require('ioredis');
const path = require('path');
const config = require('../server/config');

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
});

async function clear() {
  const keys = await redis.keys('user:profile:*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log('✅ 已清理 ' + keys.length + ' 个用户缓存键');
  } else {
    console.log('💡 未发现需要清理的缓存键');
  }
  process.exit(0);
}

clear().catch(err => {
  console.error('❌ 清理失败:', err);
  process.exit(1);
});
