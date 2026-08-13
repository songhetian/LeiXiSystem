import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 全局模块（T22.1）。注册为 @Global，任意模块可直接注入 RedisService。
 * 可选组件：REDIS_URL 缺失时 RedisService 自动降级 no-op。
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
