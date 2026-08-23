import { MetricsService } from '../src/common/metrics.service';

describe('MetricsService', () => {
  it('可以记录 HTTP 请求计数并返回指标文本', async () => {
    const metrics = new MetricsService();
    metrics.recordHttpRequest('GET', '/api/v1/users', 200, 15);
    metrics.recordHttpRequest('POST', '/api/v1/login', 401, 23);
    metrics.recordHttpRequest('GET', '/api/v1/users', 200, 8);

    const text = await metrics.getMetrics();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('# HELP');
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
  });

  it('计数器按 method + route + status 维度累加', async () => {
    const metrics = new MetricsService();
    metrics.recordHttpRequest('GET', '/api/v1/x', 200, 10);
    metrics.recordHttpRequest('GET', '/api/v1/x', 200, 10);
    metrics.recordHttpRequest('GET', '/api/v1/x', 500, 10);

    const text = await metrics.getMetrics();
    const lines = text.split('\n').filter((l) => l.startsWith('http_requests_total') && l.includes('/api/v1/x'));
    const line200 = lines.find((l) => l.includes('status="200"'));
    const line500 = lines.find((l) => l.includes('status="500"'));
    expect(line200).toContain('2');
    expect(line500).toContain('1');
  });

  it('记录分布式锁获取结果', async () => {
    const metrics = new MetricsService();
    metrics.recordLockAcquire('payroll:create:2026-07', true);
    metrics.recordLockAcquire('payroll:create:2026-07', false);
    const text = await metrics.getMetrics();
    expect(text).toContain('distributed_lock_acquisitions_total');
  });

  it('记录缓存命中率', async () => {
    const metrics = new MetricsService();
    metrics.recordCacheHit('permission');
    metrics.recordCacheHit('permission');
    metrics.recordCacheMiss('permission');
    const text = await metrics.getMetrics();
    expect(text).toContain('cache_hits_total');
    expect(text).toContain('cache_misses_total');
  });

  it('空状态下也返回有效的指标格式', async () => {
    const metrics = new MetricsService();
    const text = await metrics.getMetrics();
    expect(text).toContain('# HELP');
    expect(text).toContain('# TYPE');
  });
});
