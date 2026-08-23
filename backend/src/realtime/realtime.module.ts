import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { RedisModule } from '../common/redis/redis.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [NotificationModule, RedisModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
