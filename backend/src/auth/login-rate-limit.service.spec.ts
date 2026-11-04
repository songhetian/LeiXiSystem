import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginRateLimitService } from './login-rate-limit.service';
import { LocalFallbackStore } from '../common/local-fallback-store';
import { ERROR_CODES } from '../common/error-codes';

/** Redis 已配置但连接异常：health 为 false，读写恒返回 null / 0（与 RedisService 实测行为一致） */
function createFaultyRedis(): any {
  return {
    isEnabled: true,
    isAvailable: jest.fn().mockReturnValue(false),
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

/** Redis 未配置（REDIS_URL 缺失） */
function createDisabledRedis(): any {
  return {
    isEnabled: false,
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };
}

async function expectRateLimited(promise: Promise<unknown>): Promise<HttpException> {
  const err = await promise.catch((e) => e);
  expect(err).toBeInstanceOf(HttpException);
  expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  expect(((err as HttpException).getResponse() as any).code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
  return err as HttpException;
}

/**
 * A2 登录失败限流降级（S23 / D2 ①）：REDIS_URL 已配置但连接不可用时，
 * 计数不能「归零」（否则暴力破解防护完全失效），改用进程内固定窗口兜底。
 */
describe('LoginRateLimitService - Redis 故障时进程内窗口兜底', () => {
  const IP = '10.0.0.1';
  let local: LocalFallbackStore;
  let redis: any;
  let service: LoginRateLimitService;

  beforeEach(() => {
    local = new LocalFallbackStore();
    redis = createFaultyRedis();
    service = new LoginRateLimitService(redis, local);
  });

  afterEach(() => local.onModuleDestroy());

  it('阈值契约：用户名 5 次 / IP 20 次 / 窗口 15 分钟', () => {
    expect(service.usernameMaxAttempts).toBe(5);
    expect(service.ipMaxAttempts).toBe(20);
    expect(service.usernameWindowSec).toBe(15 * 60);
    expect(service.ipWindowSec).toBe(15 * 60);
  });

  it('同一用户名连续 5 次失败后，第 6 次预检被 429 拦截', async () => {
    for (let i = 0; i < service.usernameMaxAttempts; i += 1) {
      await service.registerFailure('admin', IP);
    }

    // 计数写进本地窗口，而不是随 Redis 故障归零
    expect(redis.incr).not.toHaveBeenCalled();
    expect(local.get('login:fail:user:admin')).toBe('5');
    await expectRateLimited(service.assertNotBlocked('admin', IP));
  });

  it('自增即拦截：第 5 次 checkAndRecordFailure 达到阈值直接抛 429', async () => {
    for (let i = 0; i < service.usernameMaxAttempts - 1; i += 1) {
      await service.checkAndRecordFailure('admin', IP);
    }

    await expectRateLimited(service.checkAndRecordFailure('admin', IP));
    expect(local.get('login:fail:user:admin')).toBe('5');
  });

  it('同一 IP 第 20 次失败后，来自该 IP 的新用户名也被 429 拦截', async () => {
    for (let i = 0; i < service.ipMaxAttempts; i += 1) {
      await service.registerFailure(`user${i}`, IP);
    }

    expect(local.get('login:fail:ip:10.0.0.1')).toBe('20');
    await expectRateLimited(service.assertNotBlocked('user-new', IP));
  });

  it('reset 后本地计数清零，可重新开始计数', async () => {
    await service.registerFailure('admin', IP);
    await service.registerFailure('admin', IP);
    await service.registerFailure('admin', IP);

    await service.reset('admin');

    expect(local.get('login:fail:user:admin')).toBeNull();
    await expect(service.assertNotBlocked('admin', IP)).resolves.toBeUndefined();

    const { userCount } = await service.registerFailure('admin', IP);
    expect(userCount).toBe(1);
  });
});

describe('LoginRateLimitService - Redis 未配置时同样使用进程内窗口', () => {
  let local: LocalFallbackStore;
  let redis: any;
  let service: LoginRateLimitService;

  beforeEach(() => {
    local = new LocalFallbackStore();
    redis = createDisabledRedis();
    service = new LoginRateLimitService(redis, local);
  });

  afterEach(() => local.onModuleDestroy());

  it('未配置 Redis 也不会放弃限流（不再直通）', async () => {
    for (let i = 0; i < service.usernameMaxAttempts; i += 1) {
      await service.registerFailure('admin');
    }

    expect(redis.get).not.toHaveBeenCalled();
    await expectRateLimited(service.assertNotBlocked('admin'));
  });
});

describe('LoginRateLimitService - Redis 可用时仍走 Redis', () => {
  let local: LocalFallbackStore;
  let redis: any;
  let service: LoginRateLimitService;
  let counter: number;

  beforeEach(() => {
    counter = 0;
    redis = {
      isEnabled: true,
      isAvailable: jest.fn().mockReturnValue(true),
      get: jest.fn(async (key: string) => (key.includes('user:admin') ? String(counter) : null)),
      incr: jest.fn(async () => {
        counter += 1;
        return counter;
      }),
      expire: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    local = new LocalFallbackStore();
    service = new LoginRateLimitService(redis, local);
  });

  afterEach(() => local.onModuleDestroy());

  it('registerFailure 走 Redis INCR，首次计数时设置窗口过期', async () => {
    const first = await service.registerFailure('admin');
    expect(redis.incr).toHaveBeenCalledWith('login:fail:user:admin');
    expect(redis.expire).toHaveBeenCalledWith('login:fail:user:admin', service.usernameWindowSec);
    expect(first.userCount).toBe(1);

    await service.registerFailure('admin');
    // 非首次自增不再刷新过期时间
    expect(redis.expire).toHaveBeenCalledTimes(1);
    // Redis 可用时不应写本地窗口
    expect(local.get('login:fail:user:admin')).toBeNull();
  });

  it('assertNotBlocked 从 Redis 读取计数，达阈值即 429', async () => {
    counter = service.usernameMaxAttempts;

    await expectRateLimited(service.assertNotBlocked('admin'));
    expect(redis.get).toHaveBeenCalledWith('login:fail:user:admin');
  });

  it('reset 同时清理 Redis key', async () => {
    await service.reset('admin');

    expect(redis.del).toHaveBeenCalledWith('login:fail:user:admin');
    expect(local.get('login:fail:user:admin')).toBeNull();
  });
});
