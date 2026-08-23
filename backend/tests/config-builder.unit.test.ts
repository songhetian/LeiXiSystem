import { buildDatabaseUrl, buildRedisUrl } from '../src/common/config/config-builder';

describe('config-builder', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('buildDatabaseUrl', () => {
    it('从分离变量构建完整 DATABASE_URL', () => {
      process.env.DB_HOST = '127.0.0.1';
      process.env.DB_PORT = '3306';
      process.env.DB_USER = 'root';
      process.env.DB_PASSWORD = 'root';
      process.env.DB_NAME = 'leixin_v2';
      delete process.env.DATABASE_URL;

      const url = buildDatabaseUrl();
      expect(url).toBe('mysql://root:root@127.0.0.1:3306/leixin_v2');
    });

    it('DB_PORT 缺失时默认 3306', () => {
      process.env.DB_HOST = '127.0.0.1';
      delete process.env.DB_PORT;
      process.env.DB_USER = 'root';
      process.env.DB_PASSWORD = 'root';
      process.env.DB_NAME = 'leixin_v2';
      delete process.env.DATABASE_URL;

      const url = buildDatabaseUrl();
      expect(url).toBe('mysql://root:root@127.0.0.1:3306/leixin_v2');
    });

    it('若已有 DATABASE_URL 则直接返回（向后兼容）', () => {
      process.env.DATABASE_URL = 'mysql://existing:url@host:3306/db';

      const url = buildDatabaseUrl();
      expect(url).toBe('mysql://existing:url@host:3306/db');
    });

    it('生产环境 RDS 地址带域名', () => {
      process.env.DB_HOST = 'rm-xxxx.mysql.rds.aliyuncs.com';
      process.env.DB_PORT = '3306';
      process.env.DB_USER = 'leixi_prod';
      process.env.DB_PASSWORD = 'StrongPwd2026';
      process.env.DB_NAME = 'leixin_v2';
      delete process.env.DATABASE_URL;

      const url = buildDatabaseUrl();
      expect(url).toBe('mysql://leixi_prod:StrongPwd2026@rm-xxxx.mysql.rds.aliyuncs.com:3306/leixin_v2');
    });

    it('DB_HOST 缺失且无 DATABASE_URL 时抛错', () => {
      delete process.env.DB_HOST;
      delete process.env.DATABASE_URL;

      expect(() => buildDatabaseUrl()).toThrow();
    });
  });

  describe('buildRedisUrl', () => {
    it('从分离变量构建完整 REDIS_URL（含密码）', () => {
      process.env.REDIS_HOST = '127.0.0.1';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = '123456';
      delete process.env.REDIS_URL;

      const url = buildRedisUrl();
      expect(url).toBe('redis://:123456@127.0.0.1:6379');
    });

    it('REDIS_PASSWORD 为空时构建无密码 URL', () => {
      process.env.REDIS_HOST = '127.0.0.1';
      process.env.REDIS_PORT = '6379';
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_URL;

      const url = buildRedisUrl();
      expect(url).toBe('redis://127.0.0.1:6379');
    });

    it('REDIS_PORT 缺失时默认 6379', () => {
      process.env.REDIS_HOST = '127.0.0.1';
      delete process.env.REDIS_PORT;
      process.env.REDIS_PASSWORD = '123456';
      delete process.env.REDIS_URL;

      const url = buildRedisUrl();
      expect(url).toBe('redis://:123456@127.0.0.1:6379');
    });

    it('REDIS_HOST 缺失且无 REDIS_URL 时返回 null', () => {
      delete process.env.REDIS_HOST;
      delete process.env.REDIS_URL;

      const url = buildRedisUrl();
      expect(url).toBeNull();
    });

    it('若已有 REDIS_URL 则直接返回（向后兼容）', () => {
      process.env.REDIS_URL = 'redis://existing@host:6379';

      const url = buildRedisUrl();
      expect(url).toBe('redis://existing@host:6379');
    });

    it('生产环境阿里云 Redis 带密码', () => {
      process.env.REDIS_HOST = 'r-xxxx.redis.rds.aliyuncs.com';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'LeiXiRedis2026';
      delete process.env.REDIS_URL;

      const url = buildRedisUrl();
      expect(url).toBe('redis://:LeiXiRedis2026@r-xxxx.redis.rds.aliyuncs.com:6379');
    });
  });
});
