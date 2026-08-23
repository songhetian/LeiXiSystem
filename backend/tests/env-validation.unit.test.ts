import { envSchema } from '../src/common/config/env.validation';

describe('envSchema (T19.1)', () => {
  it('合法 env：返回解析后的对象（DATABASE_URL / JWT_SECRET 为字符串）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
    };
    const result = envSchema.parse(input);
    expect(result.DATABASE_URL).toBe(input.DATABASE_URL);
    expect(result.JWT_SECRET).toBe(input.JWT_SECRET);
  });

  it('缺 DATABASE_URL：校验失败并抛出', () => {
    const input = { JWT_SECRET: 'dev-secret-please-change' };
    expect(() => envSchema.parse(input)).toThrow();
  });

  it('缺 JWT_SECRET：校验失败并抛出', () => {
    const input = { DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2' };
    expect(() => envSchema.parse(input)).toThrow();
  });

  it('JWT_SECRET 长度 < 8：校验失败并抛出', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'short',
    };
    expect(() => envSchema.parse(input)).toThrow();
  });

  it('DATABASE_URL 非 mysql:// 协议：校验失败并抛出', () => {
    const input = {
      DATABASE_URL: 'postgres://localhost:5432/db',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
    };
    expect(() => envSchema.parse(input)).toThrow();
  });

  it('T22.2: 含可选 REDIS_URL 的合法 env：解析后保留该字段', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      REDIS_URL: 'redis://127.0.0.1:6379',
    };
    const result = envSchema.parse(input);
    expect(result.REDIS_URL).toBe('redis://127.0.0.1:6379');
  });

  it('T22.2: 不含 REDIS_URL 的合法 env：仍通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
    };
    const result = envSchema.parse(input);
    expect(result.REDIS_URL).toBeUndefined();
  });

  // ---- Phase1 安全基线：JWT_EXPIRES_IN + PREVIEW_SECRET ----

  it('安全基线: JWT_EXPIRES_IN 缺失时仍通过校验（可选变量）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
    };
    const result = envSchema.parse(input);
    expect(result.JWT_EXPIRES_IN).toBeUndefined();
  });

  it('安全基线: JWT_EXPIRES_IN 提供时保留该值', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      JWT_EXPIRES_IN: '8h',
    };
    const result = envSchema.parse(input);
    expect(result.JWT_EXPIRES_IN).toBe('8h');
  });

  it('安全基线: PREVIEW_SECRET 缺失时仍通过校验（可选变量）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
    };
    const result = envSchema.parse(input);
    expect(result.PREVIEW_SECRET).toBeUndefined();
  });

  it('安全基线: PREVIEW_SECRET < 16 字符时校验失败（防止弱密钥）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      PREVIEW_SECRET: 'short-secret',
    };
    expect(() => envSchema.parse(input)).toThrow();
  });

  it('安全基线: PREVIEW_SECRET >= 16 字符时通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      PREVIEW_SECRET: 'a-strong-preview-secret-key-2026',
    };
    const result = envSchema.parse(input);
    expect(result.PREVIEW_SECRET).toBe('a-strong-preview-secret-key-2026');
  });

  // ---- Phase2 环境治理：Redis 密码 / NODE_ENV / CORS / OSS / SMTP ----

  it('Phase2: REDIS_URL 含密码格式 redis://:password@host:port 通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      REDIS_URL: 'redis://:123456@127.0.0.1:6379',
    };
    const result = envSchema.parse(input);
    expect(result.REDIS_URL).toBe('redis://:123456@127.0.0.1:6379');
  });

  it('Phase2: NODE_ENV 缺失时仍通过校验（可选变量）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
    };
    const result = envSchema.parse(input);
    expect(result.NODE_ENV).toBeUndefined();
  });

  it('Phase2: NODE_ENV=development 通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      NODE_ENV: 'development',
    };
    const result = envSchema.parse(input);
    expect(result.NODE_ENV).toBe('development');
  });

  it('Phase2: NODE_ENV=production 通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      NODE_ENV: 'production',
    };
    const result = envSchema.parse(input);
    expect(result.NODE_ENV).toBe('production');
  });

  it('Phase2: NODE_ENV=test 通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      NODE_ENV: 'test',
    };
    const result = envSchema.parse(input);
    expect(result.NODE_ENV).toBe('test');
  });

  it('Phase2: NODE_ENV=invalid 非法值校验失败', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      NODE_ENV: 'staging',
    };
    expect(() => envSchema.parse(input)).toThrow();
  });

  it('Phase2: CORS_ORIGIN 提供时保留该值（逗号分隔多域名）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      CORS_ORIGIN: 'http://localhost:8088,http://localhost:3000',
    };
    const result = envSchema.parse(input);
    expect(result.CORS_ORIGIN).toBe('http://localhost:8088,http://localhost:3000');
  });

  it('Phase2: OSS 配置全部提供时通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      OSS_REGION: 'oss-cn-hangzhou',
      OSS_BUCKET: 'leixi-prod',
      OSS_ACCESS_KEY: 'LTAI5tXXXXXX',
      OSS_ACCESS_SECRET: 'XXXXXXXXXXXXXX',
      OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
    };
    const result = envSchema.parse(input);
    expect(result.OSS_REGION).toBe('oss-cn-hangzhou');
    expect(result.OSS_BUCKET).toBe('leixi-prod');
  });

  it('Phase2: OSS 配置全部缺失时仍通过校验（可选变量）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
    };
    const result = envSchema.parse(input);
    expect(result.OSS_REGION).toBeUndefined();
    expect(result.OSS_BUCKET).toBeUndefined();
  });

  it('Phase2: SMTP 配置全部提供时通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change-0123456789abcdefgh',
      SMTP_HOST: 'smtp.qq.com',
      SMTP_PORT: '465',
      SMTP_USER: 'noreply@example.com',
      SMTP_PASS: 'password123',
    };
    const result = envSchema.parse(input);
    expect(result.SMTP_HOST).toBe('smtp.qq.com');
    expect(result.SMTP_PORT).toBe('465');
  });

  it('Phase2: 完整生产环境 env 通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://leixi_prod:StrongPwd2026@rm-xxxx.mysql.rds.aliyuncs.com:3306/leixin_v2',
      JWT_SECRET: 'ae3746b46ab581d10abd543ee04be35b918c665192853d785d9dc4d6690b08bd',
      JWT_EXPIRES_IN: '8h',
      PREVIEW_SECRET: '83c5010efeabf97e4c3985db8b82487167e7949cbe824037',
      REDIS_URL: 'redis://:LeiXiRedis2026@r-xxxx.redis.rds.aliyuncs.com:6379',
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://leixi.example.com',
      OSS_REGION: 'oss-cn-hangzhou',
      OSS_BUCKET: 'leixi-prod',
      OSS_ACCESS_KEY: 'LTAI5tXXXXXX',
      OSS_ACCESS_SECRET: 'XXXXXXXXXXXXXX',
      OSS_ENDPOINT: 'https://oss-cn-hangzhou.aliyuncs.com',
      SMTP_HOST: 'smtp.qq.com',
      SMTP_PORT: '465',
      SMTP_USER: 'noreply@example.com',
      SMTP_PASS: 'password123',
    };
    const result = envSchema.parse(input);
    expect(result.NODE_ENV).toBe('production');
    expect(result.REDIS_URL).toContain(':LeiXiRedis2026@');
    expect(result.OSS_BUCKET).toBe('leixi-prod');
    expect(result.SMTP_HOST).toBe('smtp.qq.com');
  });
});
