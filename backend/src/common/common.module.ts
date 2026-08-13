// 横切关注点全局模块：统一响应信封（过滤器 + 拦截器）全局注册
// 对齐 docs/api/core-contracts.md §1 统一响应
import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './interceptors/response-envelope.interceptor';

@Global()
@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class CommonModule {}
