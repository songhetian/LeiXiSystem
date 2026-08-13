import { Controller, Get } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

@Controller()
export class HealthController {
  constructor(private readonly redis: RedisService) {}

  @Get('health')
  async health() {
    let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';
    if (this.redis.isEnabled) {
      try {
        const pong = await this.redis.ping();
        redisStatus = pong === 'PONG' ? 'up' : 'down';
      } catch {
        redisStatus = 'down';
      }
    }
    return { code: 0, message: 'ok', data: { status: 'up', redis: redisStatus } };
  }
}
