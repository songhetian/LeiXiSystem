import { envSchema } from '../src/common/config/env.validation';

describe('envSchema (T19.1)', () => {
  it('合法 env：返回解析后的对象（DATABASE_URL / JWT_SECRET 为字符串）', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change',
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
      JWT_SECRET: 'dev-secret-please-change',
    };
    expect(() => envSchema.parse(input)).toThrow();
  });

  it('T22.2: 含可选 REDIS_URL 的合法 env：解析后保留该字段', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change',
      REDIS_URL: 'redis://127.0.0.1:6379',
    };
    const result = envSchema.parse(input);
    expect(result.REDIS_URL).toBe('redis://127.0.0.1:6379');
  });

  it('T22.2: 不含 REDIS_URL 的合法 env：仍通过校验', () => {
    const input = {
      DATABASE_URL: 'mysql://root:root@127.0.0.1:3306/leixin_v2',
      JWT_SECRET: 'dev-secret-please-change',
    };
    const result = envSchema.parse(input);
    expect(result.REDIS_URL).toBeUndefined();
  });
});
