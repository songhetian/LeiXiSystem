/**
 * 前端代理配置测试 (T19.4)
 *
 * 验证 next.config.mjs 的 rewrite 规则正确构造后端代理 URL。
 * 关键：destination 必须包含 :path* 通配符，否则请求路径会丢失。
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const NEXT_CONFIG = join(__dirname, '..', '..', 'frontend', 'next.config.mjs');
const DOT_ENV = join(__dirname, '..', '..', 'frontend', '.env');

describe('前端 dev 代理 (T19.4)', () => {
  describe('next.config.mjs', () => {
    const content = readFileSync(NEXT_CONFIG, 'utf-8');

    it('声明 rewrites 函数', () => {
      expect(content).toMatch(/rewrites\s*\(/);
    });

    it('destination 包含 :path* 通配符，确保路径不会丢失', () => {
      // 无论 env var 如何设置，最终 destination 必须包含 :path*
      // 否则 /api/v1/auth/login 会被代理到 http://localhost:4001/api/v1（丢失 /auth/login）
      expect(content).toMatch(/:path\*/);
    });

    it('在运行时使用 API_PROXY_TARGET 构建 destination 时追加 :path*', () => {
      // 必须保证：无论 env var 是否设置，destination 都以 :path* 结尾
      const lines = content.split('\n');
      const destLine = lines.find(l => l.includes('API_PROXY_TARGET'));
      expect(destLine).toBeTruthy();
      // env var 必须与 fallback 结合，最终 destination 包含 :path*
      expect(content).toMatch(/destination.*:path\*/);
    });
  });

  describe('.env 配置', () => {
    const content = readFileSync(DOT_ENV, 'utf-8');

    it('API_PROXY_TARGET 不包含路径前缀（只含 base URL）', () => {
      // 如果 API_PROXY_TARGET 包含 /api/v1 路径，则与 rewrite 的 :path* 冲突
      const line = content.split('\n').find(l => l.startsWith('API_PROXY_TARGET'));
      expect(line).toBeTruthy();
      // 只允许 base URL，不允许已有路径前缀
      expect(line!).not.toMatch(/\/api/);
    });
  });
});