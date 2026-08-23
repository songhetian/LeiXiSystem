import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

const START_TIME = Date.now();

function getVersion(): string {
  try {
    return process.env.npm_package_version || 'unknown';
  } catch {
    return 'unknown';
  }
}

@Controller()
export class HealthController {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('live')
  live() {
    return {
      code: 0,
      message: 'ok',
      data: {
        status: 'up',
        version: getVersion(),
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
      },
    };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    const { status, checks } = await this.check();
    if (status === 'down') reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      code: 0,
      message: 'ok',
      data: {
        status,
        version: getVersion(),
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        checks,
      },
    };
  }

  @Get('health')
  async health(@Res({ passthrough: true }) reply: FastifyReply) {
    const { status, checks } = await this.check();
    if (status === 'down') reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      code: 0,
      message: 'ok',
      data: {
        status,
        version: getVersion(),
        uptime: Math.floor((Date.now() - START_TIME) / 1000),
        checks,
      },
    };
  }

  private async check() {
    const checks: Record<string, { status: 'up' | 'down' | 'disabled'; responseTimeMs?: number }> = {};

    let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';
    let redisTime: number | undefined;
    if (this.redis.isEnabled) {
      const start = Date.now();
      try {
        const pong = await this.redis.ping();
        redisStatus = pong === 'PONG' ? 'up' : 'down';
      } catch {
        redisStatus = 'down';
      }
      redisTime = Date.now() - start;
    }
    checks.redis = { status: redisStatus, responseTimeMs: redisTime };

    let dbStatus: 'up' | 'down' = 'up';
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }
    checks.database = { status: dbStatus, responseTimeMs: Date.now() - dbStart };

    const status = redisStatus === 'down' || dbStatus === 'down' ? 'down' : 'up';
    return { status, checks };
  }
}
