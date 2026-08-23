import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginRateLimitService } from '../src/auth/login-rate-limit.service';
import { ERROR_CODES } from '../src/common/error-codes';

function makeService(isEnabled: boolean, store: Record<string, string> = {}) {
  const redisMock: any = {
    isEnabled,
    get: jest.fn((k: string) => Promise.resolve(k in store ? store[k] : null)),
    incr: jest.fn((k: string) => {
      store[k] = String((Number(store[k] ?? 0)) + 1);
      return Promise.resolve(Number(store[k]));
    }),
    expire: jest.fn(() => Promise.resolve()),
    del: jest.fn((k: string) => {
      delete store[k];
      return Promise.resolve();
    }),
  };
  return { svc: new LoginRateLimitService(redisMock), redisMock, store };
}

describe('T22.3 LoginRateLimitService', () => {
  it('连续失败达到上限后，下一次 assertNotBlocked 抛 429 + code 5006', async () => {
    const { svc } = makeService(true, { 'login:fail:user:alice': '5' });
    let thrown: HttpException | null = null;
    try {
      await svc.assertNotBlocked('alice');
    } catch (e) {
      thrown = e as HttpException;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((thrown!.getResponse() as any).code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
  });

  it('失败次数未达上限：assertNotBlocked 不抛', async () => {
    const { svc } = makeService(true, { 'login:fail:user:bob': '2' });
    await expect(svc.assertNotBlocked('bob')).resolves.toBeUndefined();
  });

  it('首次失败：registerFailure 写入计数并设置窗口过期(900s)', async () => {
    const { svc, redisMock } = makeService(true);
    await svc.registerFailure('carol');
    expect(redisMock.incr).toHaveBeenCalledWith('login:fail:user:carol');
    expect(redisMock.expire).toHaveBeenCalledWith('login:fail:user:carol', 900);
    // 再次失败：已存在，不应再设置过期
    await svc.registerFailure('carol');
    expect(redisMock.expire).toHaveBeenCalledTimes(1);
  });

  it('登录成功：reset 清除计数', async () => {
    const { svc, redisMock } = makeService(true, { 'login:fail:user:dave': '3' });
    await svc.reset('dave');
    expect(redisMock.del).toHaveBeenCalledWith('login:fail:user:dave');
  });

  it('Redis 未启用(isEnabled=false)：所有方法直通、不抛、不调用', async () => {
    const { svc, redisMock } = makeService(false);
    await expect(svc.assertNotBlocked('x')).resolves.toBeUndefined();
    await svc.registerFailure('x');
    await svc.reset('x');
    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.incr).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});
