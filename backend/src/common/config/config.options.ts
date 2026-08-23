import { ConfigModuleOptions } from '@nestjs/config';
import { envSchema } from './env.validation';

/**
 * ConfigModule 全局配置。
 * validate 在启动期对 env 做 fail-fast 校验：非法 env 直接抛错，不静默启动。
 * 在 Zod 校验前，先从分离变量（DB_HOST 等）拼接 DATABASE_URL / REDIS_URL，
 * 写入 config 对象和 process.env，供 Prisma 和 RedisService 读取。
 */
export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  envFilePath: ['../.env', '.env'],
  validate: (config) => {
    // 从 config 对象（由 dotenv 加载）中构建 URL
    const builtDbUrl = buildDbUrl(config);
    const builtRedisUrl = buildRedisUrl(config);
    if (builtDbUrl) {
      config.DATABASE_URL = builtDbUrl;
      process.env.DATABASE_URL = builtDbUrl; // 同步到 process.env 供 Prisma 读取
    }
    if (builtRedisUrl) {
      config.REDIS_URL = builtRedisUrl;
      process.env.REDIS_URL = builtRedisUrl; // 同步到 process.env 供 RedisService 读取
    }
    // 同步 PORT 到 process.env，供 main.ts 中 app.listen 读取
    if (config.PORT) {
      process.env.PORT = String(config.PORT);
    }
    // 同步 JWT 相关变量到 process.env，供 JwtModule 注册时读取
    if (config.JWT_SECRET) {
      process.env.JWT_SECRET = config.JWT_SECRET;
    }
    if (config.JWT_EXPIRES_IN) {
      process.env.JWT_EXPIRES_IN = config.JWT_EXPIRES_IN;
    }
    return envSchema.parse(config);
  },
};

/** 从 config 对象中读取分离变量并构建 DATABASE_URL */
function buildDbUrl(config: Record<string, any>): string | null {
  if (config.DATABASE_URL) return config.DATABASE_URL;
  const host = config.DB_HOST;
  if (!host) return null;
  const port = config.DB_PORT || '3306';
  const user = config.DB_USER || 'root';
  const password = config.DB_PASSWORD || '';
  const database = config.DB_NAME || 'leixin_v2';
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

/** 从 config 对象中读取分离变量并构建 REDIS_URL */
function buildRedisUrl(config: Record<string, any>): string | null {
  if (config.REDIS_URL) return config.REDIS_URL;
  const host = config.REDIS_HOST;
  if (!host) return null;
  const port = config.REDIS_PORT || '6379';
  const password = config.REDIS_PASSWORD;
  if (password) return `redis://:${password}@${host}:${port}`;
  return `redis://${host}:${port}`;
}
