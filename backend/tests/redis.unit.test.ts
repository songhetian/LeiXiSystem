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
    process.env.REDIS_URL = 'redis://:123456@127.0.0.1:6379';
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

describe('T22.1b RedisService 运行时容错降级', () => {
  const OLD = process.env.REDIS_URL;

  afterEach(() => {
    if (OLD === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = OLD;
  });

  function makeFaultyRedis() {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    const redis = new RedisService();
    const fakeClient = {
      get: jest.fn().mockRejectedValue(new Error('Connection refused')),
      set: jest.fn().mockRejectedValue(new Error('Connection refused')),
      del: jest.fn().mockRejectedValue(new Error('Connection refused')),
      incr: jest.fn().mockRejectedValue(new Error('Connection refused')),
      expire: jest.fn().mockRejectedValue(new Error('Connection refused')),
      ping: jest.fn().mockRejectedValue(new Error('Connection refused')),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
    };
    (redis as any).client = fakeClient;
    (redis as any).isEnabled = true;
    return { redis, fakeClient };
  }

  it('get() 抛错时返回 null 而不抛出异常', async () => {
    const { redis } = makeFaultyRedis();
    const result = await redis.get('some-key');
    expect(result).toBeNull();
  });

  it('set() 抛错时静默吞掉，不影响业务', async () => {
    const { redis } = makeFaultyRedis();
    await expect(redis.set('some-key', 'value')).resolves.not.toThrow();
  });

  it('del() 抛错时静默吞掉', async () => {
    const { redis } = makeFaultyRedis();
    await expect(redis.del('some-key')).resolves.not.toThrow();
  });

  it('incr() 抛错时返回 0', async () => {
    const { redis } = makeFaultyRedis();
    const result = await redis.incr('some-key');
    expect(result).toBe(0);
  });

  it('expire() 抛错时静默吞掉', async () => {
    const { redis } = makeFaultyRedis();
    await expect(redis.expire('some-key', 60)).resolves.not.toThrow();
  });

  it('ping() 抛错时返回 null', async () => {
    const { redis } = makeFaultyRedis();
    const result = await redis.ping();
    expect(result).toBeNull();
  });
});
