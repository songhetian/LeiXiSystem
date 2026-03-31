import 'dotenv/config';

/**
 * 全局配置中枢 - 处理环境差异
 * 
 * 核心逻辑：从 .env 读取原始数据，并根据当前 NODE_ENV 或 STORAGE_TYPE 进行转换
 */

const env = process.env;
const port = Number(env.SERVER_PORT || env.PORT) || 3002;
const host = env.HOST || '0.0.0.0';
const dbHost = env.DB_HOST || 'localhost';
const dbPort = Number(env.DB_PORT) || 3306;
const dbUser = env.DB_USER || 'root';
const dbPass = env.DB_PASS || env.DB_PASSWORD || '';
const dbName = env.DB_NAME || 'leixi_system';

if (!env.SERVER_PORT && env.PORT) {
  env.SERVER_PORT = env.PORT;
}

if (!env.DATABASE_URL) {
  env.DATABASE_URL = `mysql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${dbName}`;
}

export const config = {
  // --- 基础配置 ---
  env: env.NODE_ENV || 'development',
  port,
  host,
  jwtSecret: env.JWT_SECRET || 'leixi-v2-fallback-secret',

  // --- 数据库分项配置 (方便管理) ---
  db: {
    host: dbHost,
    port: dbPort,
    user: dbUser,
    pass: dbPass,
    name: dbName,
    url: env.DATABASE_URL,
  },

  // --- Redis 配置 ---
  redis: {
    host: env.REDIS_HOST || '127.0.0.1',
    port: Number(env.REDIS_PORT) || 6379,
    password: env.REDIS_PASSWORD || '',
  },

  // --- 智能存储方案 (根据 STORAGE_TYPE 自动切换) ---
  storage: {
    type: (env.STORAGE_TYPE as 'local' | 'oss') || 'local',
    
    // 如果是本地模式
    local: {
      path: env.UPLOAD_LOCAL_PATH || './uploads',
      publicUrl: env.PUBLIC_URL || `http://localhost:${port}/uploads`,
    },

    // 如果是 OSS 模式
    oss: {
      region: env.OSS_REGION,
      accessKeyId: env.OSS_ACCESS_KEY_ID,
      accessKeySecret: env.OSS_ACCESS_KEY_SECRET,
      bucket: env.OSS_BUCKET,
      endpoint: env.OSS_ENDPOINT,
    },
  },

  // 是否生产环境
  isProd: env.NODE_ENV === 'production',
};

// 简单的配置完整性校验
if (config.storage.type === 'oss' && !config.storage.oss.bucket) {
  console.warn('⚠️ 警告: 配置了 OSS 模式但缺少必要的参数，请检查 .env 文件。');
}

export default config;
