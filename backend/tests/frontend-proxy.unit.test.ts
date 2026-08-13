import { readFileSync } from 'fs';
import { join } from 'path';

const NEXT_CONFIG = join(__dirname, '..', '..', 'frontend', 'next.config.mjs');

describe('前端 dev 代理 (T19.4)', () => {
  const content = readFileSync(NEXT_CONFIG, 'utf-8');

  it('next.config 声明 rewrites 函数', () => {
    expect(content).toMatch(/rewrites\s*\(/);
  });

  it('rewrites 将 /api/v1/* 代理到后端 http://localhost:3001/api/v1', () => {
    expect(content).toMatch(/\/api\/v1(\/|:|\/\*|\/:path\*)?/);
    expect(content).toMatch(/localhost:3001/);
    // destination 必须保留 /api/v1 前缀，否则后端路由前缀丢失
    expect(content).toMatch(/3001\/api\/v1/);
  });
});
