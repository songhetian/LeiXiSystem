// 成功响应拦截器：把 {code:0, data} 补齐为统一信封 {code:0, message:'ok', data}
// 对齐 docs/api/core-contracts.md §1 统一响应示例
// 仅处理形如 {code:0, ...} 的响应；非信封结构（如 health 的 {status:'ok'}）原样透传
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface Envelope {
  code: number;
  message?: string;
  data?: unknown;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((res) => {
        if (res && typeof res === 'object' && (res as Envelope).code === 0) {
          const env = res as Envelope;
          if (env.message === undefined) env.message = 'ok';
          return env;
        }
        return res;
      }),
    );
  }
}
