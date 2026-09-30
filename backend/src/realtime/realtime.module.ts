import { Module } from '@nestjs/common';
import { RedisModule } from '../common/redis/redis.module';
import { RealtimeGateway } from './realtime.gateway';

// 本模块不 import NotificationModule：网关是通过 `notification.created` 事件解耦的
// （@OnEvent），并不注入 NotificationService，保留该 import 只会制造假依赖。
@Module({
  imports: [RedisModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
