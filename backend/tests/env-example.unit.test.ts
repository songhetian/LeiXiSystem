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
});
