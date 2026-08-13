import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { RedisModule } from '../src/common/redis/redis.module';
import { RedisService } from '../src/common/redis/redis.service';

// 最小模块：只挂 RedisModule，验证真实连接
@Module({ imports: [RedisModule] })
class TestModule {}

describe('T22.1 RedisModule + RedisService', () => {
  const OLD = process.env.REDIS_URL;

  afterEach(() => {
    if (OLD === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = OLD;
  });

  it('RED→GREEN: REDIS_URL 存在时，ping 返回 PONG 且 isEnabled=true', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    const app = await NestFactory.create(TestModule, new FastifyAdapter());
    const redis = app.get(RedisService);
    expect(redis.isEnabled).toBe(true);
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
    await app.close();
  });

  it('REDIS_URL 缺失时：isEnabled=false、ping 返回 null、启动不崩', async () => {
    delete process.env.REDIS_URL;
    const app = await NestFactory.create(TestModule, new FastifyAdapter());
    const redis = app.get(RedisService);
    expect(redis.isEnabled).toBe(false);
    const pong = await redis.ping();
    expect(pong).toBeNull();
    await app.close();
  });
});
