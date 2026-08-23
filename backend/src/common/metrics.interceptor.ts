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
    const route = (req.routerPath as string) || req.url || 'unknown';

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
