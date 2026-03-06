import 'dotenv/config';

/**
 * 全局配置中枢 - 处理环境差异
 * 
 * 核心逻辑：从 .env 读取原始数据，并根据当前 NODE_ENV 或 STORAGE_TYPE 进行转换
 */

const env = process.env;

export const config = {
  // --- 基础配置 ---
  env: env.NODE_ENV || 'development',
  port: Number(env.SERVER_PORT) || 3002,
  jwtSecret: env.JWT_SECRET || 'leixi-v2-fallback-secret',

  // --- 数据库分项配置 (方便管理) ---
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'root',
    pass: env.DB_PASS || '',
    name: env.DB_NAME || 'leixi_system',
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
      publicUrl: env.PUBLIC_URL || `http://localhost:${env.SERVER_PORT || 3002}/uploads`,
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
