import { LockAcquisitionError, DistributedLockService } from './distributed-lock.service';
import { ERROR_CODES } from './error-codes';

/**
 * RedisService 替身：
 * - `isEnabled=false` → 未配置 REDIS_URL（进程内互斥路径）
 * - 传 `client`       → `getClient()` 返回该 ioredis 客户端（`set` 的返回值决定抢锁结果）
 * - 不传 `client`     → `getClient()` 抛错，模拟「已配置但连接异常」
 */
function createRedis(opts: { isEnabled?: boolean; client?: any } = {}): any {
  return {
    isEnabled: opts.isEnabled ?? false,
    // 与生产实现一致：isAvailable 表示「已配置且连接就绪」
    isAvailable: jest.fn().mockReturnValue(opts.isEnabled ?? false),
    getClient: jest.fn(() => {
      if (opts.client) return opts.client;
      throw new Error('Redis 连接异常');
    }),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    eval: jest.fn(),
  };
}

function createMetrics(): any {
  return { recordLockAcquire: jest.fn() };
}

/**
 * A1 分布式锁降级（S23 / D1 ①）：Redis 故障时核心写操作降级为进程内互斥，
 * 而不是整体 409 不可用；`fallbackToLocal=false` 时才按 `failClosed` 决定拒绝/放行。
 */
describe('DistributedLockService - Redis 未配置时降级为进程内互斥', () => {
  let redis: any;
  let metrics: ReturnType<typeof createMetrics>;
  let service: DistributedLockService;

  beforeEach(() => {
    redis = createRedis({ isEnabled: false });
    metrics = createMetrics();
    service = new DistributedLockService(redis, metrics);
  });

  afterEach(() => jest.clearAllMocks());

  it('默认降级为进程内互斥并正常执行 fn', async () => {
    const result = await service.withLock('payroll:run:create', 5_000, async () => 'ok');

    expect(result).toBe('ok');
    // 未配置 Redis 时不应尝试连 Redis
    expect(redis.getClient).not.toHaveBeenCalled();
    expect(metrics.recordLockAcquire).toHaveBeenCalledWith('payroll:run:create', true);
  });

  it('同资源两个并发调用串行执行，同时执行数峰值为 1', async () => {
    let active = 0;
    let peak = 0;
    const critical = async (): Promise<string> => {
      active += 1;
      peak = Math.max(peak, active);
      // 制造重叠窗口：若本地互斥失效，第二个 fn 会同时进入，peak 变成 2
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return 'done';
    };

    const results = await Promise.all([
      service.withLock('attendance:monthly', 5_000, critical),
      service.withLock('attendance:monthly', 5_000, critical),
    ]);

    expect(peak).toBe(1);
    expect(results).toEqual(['done', 'done']);
  });

  it('fn 抛错时仍释放本地互斥，后续调用不会被永久阻塞', async () => {
    await expect(
      service.withLock('vacation:balance', 5_000, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    await expect(service.withLock('vacation:balance', 5_000, async () => 'ok')).resolves.toBe('ok');
  });
});

describe('DistributedLockService - Redis 已配置但连接故障', () => {
  let metrics: ReturnType<typeof createMetrics>;

  beforeEach(() => {
    metrics = createMetrics();
  });

  afterEach(() => jest.clearAllMocks());

  it('getClient 抛错时降级为进程内互斥并正常执行 fn', async () => {
    const redis = createRedis({ isEnabled: true });
    const service = new DistributedLockService(redis, metrics);

    await expect(service.withLock('punch:submit', 5_000, async () => 'ok')).resolves.toBe('ok');
    expect(metrics.recordLockAcquire).toHaveBeenCalledWith('punch:submit', true);
  });

  it('set reject（ECONNREFUSED）时降级为进程内互斥并正常执行 fn', async () => {
    const client = {
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      eval: jest.fn(),
    };
    const redis = createRedis({ isEnabled: true, client });
    const service = new DistributedLockService(redis, metrics);

    await expect(service.withLock('attendance:monthly', 5_000, async () => 42)).resolves.toBe(42);
  });

  it('fallbackToLocal=false + failClosed=true 时抛 LockAcquisitionError 且不执行 fn', async () => {
    const redis = createRedis({ isEnabled: true });
    const service = new DistributedLockService(redis, metrics);
    const fn = jest.fn().mockResolvedValue('never');

    const err = await service
      .withLock('payroll:run:confirm', 5_000, fn, { fallbackToLocal: false, failClosed: true })
      .catch((e) => e);

    expect(err).toBeInstanceOf(LockAcquisitionError);
    expect((err as LockAcquisitionError).resource).toBe('payroll:run:confirm');
    expect((err as LockAcquisitionError).code).toBe(ERROR_CODES.LOCK_ACQUISITION_FAILED);
    expect(fn).not.toHaveBeenCalled();
    expect(metrics.recordLockAcquire).toHaveBeenCalledWith('payroll:run:confirm', false);
  });

  it('fallbackToLocal=false + failClosed=false 时按 fail-open 放行 fn', async () => {
    const redis = createRedis({ isEnabled: true });
    const service = new DistributedLockService(redis, metrics);

    const result = await service.withLock('punch:submit', 5_000, async () => 'ok', {
      fallbackToLocal: false,
      failClosed: false,
    });

    expect(result).toBe('ok');
    // fail-open 不占用锁，也不记录抢锁指标
    expect(metrics.recordLockAcquire).not.toHaveBeenCalled();
  });
});

describe('DistributedLockService - Redis 抢锁与释放', () => {
  let metrics: ReturnType<typeof createMetrics>;

  beforeEach(() => {
    metrics = createMetrics();
  });

  afterEach(() => jest.clearAllMocks());

  it('set 返回 null（锁被其他实例持有）时抛 LockAcquisitionError 且不执行 fn', async () => {
    const client = { set: jest.fn().mockResolvedValue(null), eval: jest.fn() };
    const redis = createRedis({ isEnabled: true, client });
    const service = new DistributedLockService(redis, metrics);
    const fn = jest.fn().mockResolvedValue('never');

    await expect(service.withLock('payroll:run:create', 5_000, fn)).rejects.toBeInstanceOf(
      LockAcquisitionError,
    );
    expect(fn).not.toHaveBeenCalled();
    expect(metrics.recordLockAcquire).toHaveBeenCalledWith('payroll:run:create', false);
  });

  it('抢到锁后执行 fn，并用 Lua 脚本按 ownerId 安全释放', async () => {
    const client = { set: jest.fn().mockResolvedValue('OK'), eval: jest.fn().mockResolvedValue(1) };
    const redis = createRedis({ isEnabled: true, client });
    const service = new DistributedLockService(redis, metrics);

    const result = await service.withLock('attendance:monthly', 5_000, async () => 'ok');

    expect(result).toBe('ok');
    const ownerId = (client.set as jest.Mock).mock.calls[0][1];
    expect(client.set).toHaveBeenCalledWith('lock:attendance:monthly', ownerId, 'PX', 5_000, 'NX');
    expect(client.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get'"),
      1,
      'lock:attendance:monthly',
      ownerId,
    );
    expect(metrics.recordLockAcquire).toHaveBeenCalledWith('attendance:monthly', true);
  });

  it('fn 抛错时仍在 finally 中释放 Redis 锁', async () => {
    const client = { set: jest.fn().mockResolvedValue('OK'), eval: jest.fn().mockResolvedValue(1) };
    const redis = createRedis({ isEnabled: true, client });
    const service = new DistributedLockService(redis, metrics);

    await expect(
      service.withLock('payroll:run:create', 5_000, async () => {
        throw new Error('业务失败');
      }),
    ).rejects.toThrow('业务失败');

    expect(client.eval).toHaveBeenCalledTimes(1);
  });
});

describe('DistributedLockService - tryAcquire 不可用时的 fail-closed / fail-open', () => {
  it('Redis 未配置：默认 failClosed 返回 false', async () => {
    const service = new DistributedLockService(createRedis({ isEnabled: false }));

    await expect(service.tryAcquire('r1', 'owner', 5_000)).resolves.toBe(false);
  });

  it('Redis 未配置 + failClosed=false：放行返回 true', async () => {
    const service = new DistributedLockService(createRedis({ isEnabled: false }));

    await expect(service.tryAcquire('r1', 'owner', 5_000, false)).resolves.toBe(true);
  });

  it('Redis 连接异常：failClosed=true 返回 false，failClosed=false 返回 true', async () => {
    const service = new DistributedLockService(createRedis({ isEnabled: true }));

    await expect(service.tryAcquire('r1', 'owner', 5_000, true)).resolves.toBe(false);
    await expect(service.tryAcquire('r1', 'owner', 5_000, false)).resolves.toBe(true);
  });

  it('Redis 可用时按实际抢锁结果返回', async () => {
    const heldClient = { set: jest.fn().mockResolvedValue(null) };
    await expect(
      new DistributedLockService(createRedis({ isEnabled: true, client: heldClient })).tryAcquire(
        'r1',
        'owner',
        5_000,
      ),
    ).resolves.toBe(false);

    const freeClient = { set: jest.fn().mockResolvedValue('OK') };
    await expect(
      new DistributedLockService(createRedis({ isEnabled: true, client: freeClient })).tryAcquire(
        'r1',
        'owner',
        5_000,
      ),
    ).resolves.toBe(true);
  });
});
