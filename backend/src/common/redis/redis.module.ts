import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { DistributedLockService } from '../distributed-lock.service';
import { PermissionCacheService } from '../permission-cache.service';
import { CsrfService } from '../csrf.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Redis 全局模块（T22.1）。注册为 @Global，任意模块可直接注入 RedisService。
 * 可选组件：REDIS_URL 缺失时 RedisService 自动降级 no-op。
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [RedisService, DistributedLockService, PermissionCacheService, CsrfService],
  exports: [RedisService, DistributedLockService, PermissionCacheService, CsrfService],
})
export class RedisModule {}
