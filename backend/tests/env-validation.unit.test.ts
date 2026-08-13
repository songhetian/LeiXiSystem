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
});
