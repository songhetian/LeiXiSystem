/**
 * /metrics 端点访问控制测试（W4）
 *
 * prometheus 指标端点不得对公网开放，且不应引入 JWT（抓取端无法携带业务凭据）。
 * 收口方式：nginx 层 IP 白名单 —— allow 私网段若干 + deny all。
 * 关键点：nginx 的 allow/deny 按书写顺序匹配，deny all 必须位于所有 allow 之后，
 * 否则白名单会被整条拒绝覆盖，导致指标永远抓不到。
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const NGINX_CONF = join(__dirname, '..', '..', 'docker', 'nginx.local.conf');

// 截取 /metrics 的 location 块（至下一个 location 或文件结束）
// 允许 `location = /metrics`（精确匹配）与 `location /metrics`（前缀匹配）两种写法
function extractMetricsBlock(content: string): string {
  const match = content.match(/location\s+(?:=\s*)?~?\s*\/metrics\b[\s\S]*?(?=\n\s*location\s|\n\})/);
  return match ? match[0] : '';
}

describe('nginx /metrics 访问控制（W4）', () => {
  const content = readFileSync(NGINX_CONF, 'utf-8');
  const block = extractMetricsBlock(content);

  it('声明 /metrics location', () => {
    expect(block).toBeTruthy();
  });

  it('精确匹配 /metrics（白名单面收窄到唯一路径，不放行 /metrics 子路径）', () => {
    expect(block).toMatch(/location\s+=\s*\/metrics/);
  });

  it('代理到 backend:4001（指标由后端 /metrics 提供）', () => {
    expect(block).toMatch(/proxy_pass\s+http:\/\/backend:4001/);
  });

  it('代理目标带上后端全局前缀 /api/v1/metrics', () => {
    // 后端 main.ts: setGlobalPrefix('api/v1')，MetricsController 实际路径是
    // /api/v1/metrics。只写到 http://backend:4001 会把 /metrics 原样透传，
    // 匹配不到任何路由（实测返回 4000 参数校验失败），指标永远抓不到。
    expect(block).toMatch(/proxy_pass\s+http:\/\/backend:4001\/api\/v1\/metrics;/);
  });

  it('白名单覆盖回环与三类私网段', () => {
    expect(block).toMatch(/allow\s+127\.0\.0\.1;/);
    expect(block).toMatch(/allow\s+10\.0\.0\.0\/8;/);
    expect(block).toMatch(/allow\s+172\.16\.0\.0\/12;/);
    expect(block).toMatch(/allow\s+192\.168\.0\.0\/16;/);
  });

  it('以 deny all 兜底，拒绝非白名单来源', () => {
    expect(block).toMatch(/deny\s+all;/);
  });

  it('deny all 位于所有 allow 之后（nginx 按序匹配，顺序错则白名单失效）', () => {
    const denyIndex = block.indexOf('deny  all;') >= 0 ? block.indexOf('deny  all;') : block.indexOf('deny all;');
    expect(denyIndex).toBeGreaterThan(-1);
    const lastAllowIndex = block.lastIndexOf('allow ');
    expect(lastAllowIndex).toBeGreaterThan(-1);
    expect(denyIndex).toBeGreaterThan(lastAllowIndex);
  });

  it('不引入 JWT 类鉴权指令（抓取端无法携带业务凭据）', () => {
    expect(block).not.toMatch(/auth_request|auth_jwt|proxy_set_header\s+Authorization/);
  });
});