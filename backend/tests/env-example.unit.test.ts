import { readFileSync } from 'fs';
import { join } from 'path';

const ENV_EXAMPLE = join(__dirname, '..', '.env.example');

describe('.env.example (T19.3)', () => {
  it('存在且声明必填变量 DATABASE_URL / JWT_SECRET', () => {
    const content = readFileSync(ENV_EXAMPLE, 'utf-8');
    expect(content).toMatch(/^DATABASE_URL=/m);
    expect(content).toMatch(/^JWT_SECRET=/m);
  });

  it('DATABASE_URL 示例为占位 mysql:// 地址', () => {
    const content = readFileSync(ENV_EXAMPLE, 'utf-8');
    const match = content.match(/^DATABASE_URL=(.+)$/m);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('mysql://');
  });

  it('安全基线: 声明 JWT_EXPIRES_IN（JWT 过期时间可配）', () => {
    const content = readFileSync(ENV_EXAMPLE, 'utf-8');
    expect(content).toMatch(/^JWT_EXPIRES_IN=/m);
  });

  it('安全基线: 声明 PREVIEW_SECRET（预览签名密钥，不再用弱默认值）', () => {
    const content = readFileSync(ENV_EXAMPLE, 'utf-8');
    expect(content).toMatch(/^PREVIEW_SECRET=/m);
  });
});
