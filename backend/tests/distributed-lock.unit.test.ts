import { DistributedLockService, LockAcquisitionError } from '../src/common/distributed-lock.service';

function makeRedisMock(store: Record<string, string> = {}) {
  const storeObj = { ...store };
  const client = {
    set: jest.fn((k: string, v: string, mode?: string, duration?: number, flag?: string) => {
      if (flag === 'NX' && k in storeObj) {
        return Promise.resolve(null);
      }
      storeObj[k] = v;
      return Promise.resolve('OK');
    }),
    eval: jest.fn((_script: string, _numKeys: number, key: string, owner: string) => {
      if (storeObj[key] === owner) {
        delete storeObj[key];
        return Promise.resolve(1);
      }
      return Promise.resolve(0);
    }),
    get: jest.fn((k: string) => Promise.resolve(storeObj[k] || null)),
    pexpire: jest.fn(() => Promise.resolve(1)),
  };
  const redisMock = {
    isEnabled: true,
    getClient: jest.fn(() => client),
  };
  return { redisMock, client, store: storeObj };
}

describe('DistributedLockService', () => {
  describe('tryAcquire', () => {
    it('锁空闲时成功获取，返回 true 并写入锁值', async () => {
      const { redisMock, client } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      const result = await lock.tryAcquire('payroll:2026-07', 'worker-1', 30000);
      expect(result).toBe(true);
      expect(client.set).toHaveBeenCalledWith(
        'lock:payroll:2026-07',
        'worker-1',
        'PX',
        30000,
        'NX',
      );
    });

    it('锁已被其他持有者占用时，返回 false', async () => {
      const { redisMock } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      await lock.tryAcquire('payroll:2026-07', 'worker-1', 30000);
      const result = await lock.tryAcquire('payroll:2026-07', 'worker-2', 30000);
      expect(result).toBe(false);
    });

    it('同一持有者重复获取也返回 false（不可重入）', async () => {
      const { redisMock } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      await lock.tryAcquire('payroll:2026-07', 'worker-1', 30000);
      const result = await lock.tryAcquire('payroll:2026-07', 'worker-1', 30000);
      expect(result).toBe(false);
    });

    it('Redis 未启用时，默认 fail-closed 返回 false', async () => {
      const { redisMock, client } = makeRedisMock();
      redisMock.isEnabled = false;
      const lock = new DistributedLockService(redisMock as any);
      const result = await lock.tryAcquire('payroll:2026-07', 'worker-1', 30000);
      expect(result).toBe(false);
      expect(client.set).not.toHaveBeenCalled();
    });

    it('Redis 未启用且 failClosed=false 时，返回 true（放行）', async () => {
      const { redisMock, client } = makeRedisMock();
      redisMock.isEnabled = false;
      const lock = new DistributedLockService(redisMock as any);
      const result = await lock.tryAcquire('payroll:2026-07', 'worker-1', 30000, false);
      expect(result).toBe(true);
      expect(client.set).not.toHaveBeenCalled();
    });

    it('Redis 抛错时默认 fail-closed 返回 false', async () => {
      const { redisMock, client } = makeRedisMock();
      client.set.mockRejectedValue(new Error('Redis connection lost'));
      const lock = new DistributedLockService(redisMock as any);
      const result = await lock.tryAcquire('payroll:2026-07', 'worker-1', 30000);
      expect(result).toBe(false);
    });
  });

  describe('release', () => {
    it('持有锁的调用者可以正常释放', async () => {
      const { redisMock, client, store } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      store['lock:payroll:2026-07'] = 'real-owner';
      const result = await lock.release('payroll:2026-07', 'real-owner');
      expect(result).toBe(true);
      expect(client.eval).toHaveBeenCalled();
    });

    it('非持有者无法释放别人的锁', async () => {
      const { redisMock, store } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      store['lock:payroll:2026-07'] = 'real-owner';
      const result = await lock.release('payroll:2026-07', 'intruder');
      expect(result).toBe(false);
    });

    it('Redis 未启用时，release 返回 true（直通）', async () => {
      const { redisMock, client } = makeRedisMock();
      redisMock.isEnabled = false;
      const lock = new DistributedLockService(redisMock as any);
      const result = await lock.release('payroll:2026-07', 'anyone');
      expect(result).toBe(true);
      expect(client.eval).not.toHaveBeenCalled();
    });
  });

  describe('withLock', () => {
    it('成功获取锁时执行回调并返回结果', async () => {
      const { redisMock } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      const result = await lock.withLock('payroll:2026-07', 30000, async () => {
        return 'computed-result';
      });
      expect(result).toBe('computed-result');
    });

    it('获取锁失败时抛出 LockAcquisitionError', async () => {
      const { redisMock } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      await lock.tryAcquire('payroll:2026-07', 'other-worker', 30000);
      await expect(
        lock.withLock('payroll:2026-07', 30000, async () => 'x'),
      ).rejects.toThrow(LockAcquisitionError);
    });

    it('回调执行后自动释放锁', async () => {
      const { redisMock, store } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      await lock.withLock('payroll:2026-07', 30000, async () => {
        expect(store['lock:payroll:2026-07']).toBeDefined();
      });
      expect(store['lock:payroll:2026-07']).toBeUndefined();
    });

    it('回调抛错时也能释放锁', async () => {
      const { redisMock, store } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      await expect(
        lock.withLock('payroll:2026-07', 30000, async () => {
          throw new Error('callback error');
        }),
      ).rejects.toThrow('callback error');
      expect(store['lock:payroll:2026-07']).toBeUndefined();
    });

    it('长 TTL 任务会自动续期', async () => {
      jest.useFakeTimers();
      const { redisMock, client } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      let resolveFn: () => void;
      const longTask = new Promise<void>((r) => {
        resolveFn = r;
      });

      const resultPromise = lock.withLock('payroll:2026-07', 30000, async () => {
        await longTask;
        return 'done';
      });

      await Promise.resolve();
      await Promise.resolve();

      const callsBefore = client.pexpire.mock.calls.length;
      jest.advanceTimersByTime(11000);
      await Promise.resolve();
      await Promise.resolve();
      const callsAfter = client.pexpire.mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);

      resolveFn!();
      const result = await resultPromise;
      expect(result).toBe('done');

      jest.useRealTimers();
    });

    it('回调完成后续期定时器被清理', async () => {
      jest.useFakeTimers();
      const { redisMock, client } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);

      await lock.withLock('payroll:2026-07', 30000, async () => 'fast');
      await Promise.resolve();

      client.pexpire.mockClear();
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(client.pexpire).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('generateOwnerId', () => {
    it('生成的 ownerId 包含 pid 和时间戳，且足够唯一', () => {
      const { redisMock } = makeRedisMock();
      const lock = new DistributedLockService(redisMock as any);
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(lock.generateOwnerId());
      }
      expect(ids.size).toBe(1000);
      const sample = ids.values().next().value;
      expect(sample).toMatch(/^\d+-\d+-[a-f0-9]{16}$/);
    });
  });
});
