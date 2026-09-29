import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';
import type { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = process.hrtime.bigint();
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const method = req.method;
    // 取匹配到的路由模板（如 /api/v1/employees/:id）而非原始 URL，避免指标被 id 打散基数。
    // 必须用 routeOptions.url：req.routerPath 在 Fastify 4.28 起已弃用
    // （FSTDEP017，声明将于 fastify@5 移除），每次首访都会刷一条 DeprecationWarning。
    const route = req.routeOptions?.url || req.url || 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<FastifyReply>();
          const status = res.statusCode || 200;
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          this.metrics.recordHttpRequest(method, route, status, durationMs);
        },
        error: () => {
          const res = context.switchToHttp().getResponse<FastifyReply>();
          const status = res.statusCode || 500;
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          this.metrics.recordHttpRequest(method, route, status, durationMs);
        },
      }),
    );
  }
}
