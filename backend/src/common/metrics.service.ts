import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  register,
  collectDefaultMetrics,
} from 'prom-client';

const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService {
  private readonly httpRequestCounter: Counter<string>;
  private readonly httpDurationHistogram: Histogram<string>;
  private readonly lockAcquireCounter: Counter<string>;
  private readonly cacheHitCounter: Counter<string>;
  private readonly cacheMissCounter: Counter<string>;

  constructor() {
    register.clear();

    this.httpRequestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    });

    this.httpDurationHistogram = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: HTTP_DURATION_BUCKETS,
    });

    this.lockAcquireCounter = new Counter({
      name: 'distributed_lock_acquisitions_total',
      help: 'Total number of distributed lock acquisitions',
      labelNames: ['resource', 'result'],
    });

    this.cacheHitCounter = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache'],
    });

    this.cacheMissCounter = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache'],
    });

    try {
      collectDefaultMetrics({
        prefix: 'leixi_',
        eventLoopMonitoringPrecision: 10,
      });
    } catch {
      // collectDefaultMetrics 在多实例下可能重复注册，忽略
    }
  }

  recordHttpRequest(method: string, route: string, status: number, durationMs: number) {
    const statusStr = String(status);
    this.httpRequestCounter.inc({ method, route, status: statusStr });
    this.httpDurationHistogram.observe({ method, route, status: statusStr }, durationMs / 1000);
  }

  recordLockAcquire(resource: string, success: boolean) {
    this.lockAcquireCounter.inc({ resource, result: success ? 'success' : 'failure' });
  }

  recordCacheHit(cacheName: string) {
    this.cacheHitCounter.inc({ cache: cacheName });
  }

  recordCacheMiss(cacheName: string) {
    this.cacheMissCounter.inc({ cache: cacheName });
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }
}
