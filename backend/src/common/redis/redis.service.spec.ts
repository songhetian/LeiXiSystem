/**
 * RedisService 的降级契约测试。
 *
 * 重点不是「连上之后能不能用」，而是「连不上时会不会把业务请求拖死」：
 * 真实事故是 Redis 容器故障后，登录接口在 `redis.get()` 处挂住 45s 不返回
 * （命令留在离线队列，等下一次重连才被处理）。这里锁住两条不变量：
 *   1. 客户端必须配置命令级硬超时 `commandTimeout`；
 *   2. 命令失败时 get/set/del/incr 返回空值而不是抛错，让调用方走降级分支。
 */
const mockInstances: any[] = [];

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation((_url: string, options: Record<string, unknown>) => {
    const handlers: Record<string, Array<(...args: any[]) => void>> = {};
    const client: any = {
      options,
      status: 'connecting',
      handlers,
      on: jest.fn((event: string, cb: (...args: any[]) => void): any => {
        (handlers[event] ||= []).push(cb);
        return client;
      }),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ping: jest.fn(),
      quit: jest.fn(),
    };
    mockInstances.push(client);
    return client;
  });
});

import { RedisService } from './redis.service';

describe('RedisService（故障降级）', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalPrefix = process.env.REDIS_KEY_PREFIX;

  beforeEach(() => {
    mockInstances.length = 0;
    process.env.REDIS_URL = 'redis://:pass@127.0.0.1:6379';
    process.env.REDIS_KEY_PREFIX = 'test:';
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
    if (originalPrefix === undefined) delete process.env.REDIS_KEY_PREFIX;
    else process.env.REDIS_KEY_PREFIX = originalPrefix;
  });

  it('客户端必须配置命令级超时，否则断连期间命令会无限排队', () => {
    new RedisService();

    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0].options).toEqual(
      expect.objectContaining({
        commandTimeout: 2000,
        maxRetriesPerRequest: 2,
        keyPrefix: 'test:',
      }),
    );
  });

  it('get 失败时返回 null，不向上抛错', async () => {
    const service = new RedisService();
    mockInstances[0].handlers.ready.forEach((cb: () => void) => cb());
    mockInstances[0].get.mockRejectedValue(new Error('Command timed out'));

    await expect(service.get('user:session:1')).resolves.toBeNull();
  });

  it('连接未就绪时直接降级，不把命令排进离线队列', async () => {
    const service = new RedisService();
    // 模拟重连中：healthy=false
    mockInstances[0].handlers.close.forEach((cb: () => void) => cb());

    await expect(service.get('user:session:1')).resolves.toBeNull();
    await expect(service.set('k', 'v')).resolves.toBeUndefined();
    expect(mockInstances[0].get).not.toHaveBeenCalled();
    expect(mockInstances[0].set).not.toHaveBeenCalled();
  });

  it('set / del / incr 失败时静默降级', async () => {
    const service = new RedisService();
    mockInstances[0].handlers.ready.forEach((cb: () => void) => cb());
    mockInstances[0].set.mockRejectedValue(new Error('Command timed out'));
    mockInstances[0].del.mockRejectedValue(new Error('Command timed out'));
    mockInstances[0].incr.mockRejectedValue(new Error('Command timed out'));

    await expect(service.set('k', 'v', 60)).resolves.toBeUndefined();
    await expect(service.del('k')).resolves.toBeUndefined();
    await expect(service.incr('k')).resolves.toBe(0);
  });

  it('未配置 REDIS_URL 时不建连接，isEnabled 为 false', () => {
    delete process.env.REDIS_URL;
    const service = new RedisService();

    expect(mockInstances).toHaveLength(0);
    expect(service.isEnabled).toBe(false);
    expect(service.isAvailable()).toBe(false);
  });
});
