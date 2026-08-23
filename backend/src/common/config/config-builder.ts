/**
 * 配置构建器：从分离的环境变量（DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
 * 和 REDIS_HOST/REDIS_PORT/REDIS_PASSWORD）拼接完整的连接 URL。
 *
 * 向后兼容：若已有 DATABASE_URL / REDIS_URL 则直接返回，不覆盖。
 * 在 NestJS 启动前由 config.options.ts 的 validate 函数调用，
 * 确保 Prisma 和 RedisService 能读到 process.env.DATABASE_URL / REDIS_URL。
 */

/**
 * 从 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME 构建 mysql:// URL。
 * 优先级：DATABASE_URL > 分离变量。
 * @throws Error 当 DB_HOST 和 DATABASE_URL 均缺失时
 */
export function buildDatabaseUrl(): string {
  // 向后兼容：已有 DATABASE_URL 直接返回
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST;
  if (!host) {
    throw new Error(
      '数据库配置缺失：请设置 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME 或直接设置 DATABASE_URL',
    );
  }

  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'leixin_v2';

  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * 从 REDIS_HOST/REDIS_PORT/REDIS_PASSWORD 构建 redis:// URL。
 * 优先级：REDIS_URL > 分离变量。
 * @returns 完整 URL 或 null（当 Redis 未配置时）
 */
export function buildRedisUrl(): string | null {
  // 向后兼容：已有 REDIS_URL 直接返回
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST;
  if (!host) {
    return null;
  }

  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;

  if (password) {
    return `redis://:${password}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

/**
 * 在 NestJS 启动前同步 process.env，确保 DATABASE_URL 和 REDIS_URL 就绪。
 * 由 config.options.ts 的 validate 函数在 Zod 校验前调用。
 */
export function syncEnvUrls(): void {
  const dbUrl = buildDatabaseUrl();
  process.env.DATABASE_URL = dbUrl;

  const redisUrl = buildRedisUrl();
  if (redisUrl) {
    process.env.REDIS_URL = redisUrl;
  }
}
