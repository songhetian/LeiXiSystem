import 'reflect-metadata';
import { describe, it, expect, afterEach } from '@jest/globals';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { HealthController } from '../src/health/health.controller';
import { RedisModule } from '../src/common/redis/redis.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Mock PrismaService so the health check DB test always succeeds in this e2e
// suite, which is focused on Redis status behaviour.
const mockPrismaService = {
  $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
};

@Module({
  imports: [RedisModule],
  controllers: [HealthController],
  providers: [{ provide: PrismaService, useValue: mockPrismaService }],
})
class HealthTestModule {}

const inject = (app: NestFastifyApplication, opts: any) =>
  app.getHttpAdapter().getInstance().inject(opts);

describe('T22.5 /health 含 redis 状态', () => {
  const OLD = process.env.REDIS_URL;

  afterEach(() => {
    if (OLD === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = OLD;
  });

  it('RED: REDIS_URL 存在时，/health 返回 data.redis === "up"', async () => {
    process.env.REDIS_URL = 'redis://:123456@127.0.0.1:6379';
    const app = await NestFactory.create<NestFastifyApplication>(HealthTestModule, new FastifyAdapter());
    await app.init();
    const res = await inject(app, { method: 'GET', url: '/health' });
    const body = JSON.parse(res.payload);
    expect(body.data).toHaveProperty('redis');
    expect(body.data.redis).toBe('up');
    await app.close();
  });

  it('REDIS_URL 缺失时：/health 返回 data.redis === "disabled"', async () => {
    delete process.env.REDIS_URL;
    const app = await NestFactory.create<NestFastifyApplication>(HealthTestModule, new FastifyAdapter());
    await app.init();
    const res = await inject(app, { method: 'GET', url: '/health' });
    const body = JSON.parse(res.payload);
    expect(body.data.redis).toBe('disabled');
    await app.close();
  });
});
