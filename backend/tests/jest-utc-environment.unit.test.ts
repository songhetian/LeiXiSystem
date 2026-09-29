/**
 * 自定义 UTC 沙箱（jest-utc-environment.js）的时区还原契约。
 *
 * 该环境在构造期把「真实进程」的 TZ 改成 UTC，而 Node 20+ 会在 process.env.TZ
 * 被赋值时立刻重载时区数据。`jest --runInBand`（以及复用 worker）时同一进程会连续
 * 执行多个 spec 文件：若文件级 teardown 不还原时区，UTC 就会泄漏给后续文件，
 * 使按宿主时区构造时刻的用例（如 punch.service.spec.ts 用
 * `new Date(2026, 7, 15, 9, 0, 0)` 与北京时间的班次时刻比对）随机失败。
 *
 * 已实证：`TZ=UTC jest --runTestsByPath src/attendance/punch.service.spec.ts`
 * 恰好挂 8 条；同文件在宿主 GMT+8 下全绿。
 */
// 业务侧解析不到 jest-environment-node（pnpm 严格布局），用虚拟 mock 顶替基类
jest.mock('jest-environment-node', () => class MockNodeEnvironment {}, { virtual: true });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const UtcEnvironment = require('../jest-utc-environment');

describe('jest-utc-environment', () => {
  it('构造期确实改写真实进程时区（这正是必须还原的原因）', () => {
    const original = process.env.TZ;
    process.env.TZ = 'Asia/Shanghai';
    try {
      // eslint-disable-next-line no-new
      new UtcEnvironment({}, { testPath: 'x' });
      expect(process.env.TZ).toBe('UTC');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('teardown 还原进程时区，不把 UTC 泄漏给同进程的后续 spec 文件', async () => {
    const original = process.env.TZ;
    process.env.TZ = 'Asia/Shanghai';
    try {
      const env = new UtcEnvironment({}, { testPath: 'x' });
      expect(process.env.TZ).toBe('UTC');

      await env.teardown?.();

      expect(process.env.TZ).toBe('Asia/Shanghai');
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('原进程未设置 TZ 时，teardown 恢复为「未设置」而非残留 UTC', async () => {
    const original = process.env.TZ;
    delete process.env.TZ;
    try {
      const env = new UtcEnvironment({}, { testPath: 'x' });
      expect(process.env.TZ).toBe('UTC');

      await env.teardown?.();

      expect(process.env.TZ).toBeUndefined();
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  /**
   * 只把 process.env.TZ 的值删掉是不够的：`delete process.env.TZ` **不会**触发
   * V8 的时区重载（实测 delete 后 `getHours()` 仍按 UTC 取值），于是宿主未设置 TZ
   * 的场景（开发机默认）下，UTC 沙箱收尾后同进程的后续 spec 文件会一直停在 UTC，
   * 使按宿主时区构造时刻的用例成片失败（punch.service.spec.ts 会连挂 8 条）。
   * 因此 teardown 必须先用一次真实赋值把时区缓存拉回宿主时区，再删除变量。
   *
   * 说明：本用例运行在默认沙箱里，`process.env` 是副本，构造期的赋值不会真的改变
   * 沙箱时区，故只能断言「收尾期间发生了一次宿主时区赋值」这一可观测契约。
   */
  it('teardown 必须用「赋值」把时区缓存拉回宿主时区（delete 不触发重载）', async () => {
    const original = process.env.TZ;
    const hostTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    delete process.env.TZ;
    // 记录 teardown 期间对 TZ 的写值序列
    const writes: (string | undefined)[] = [];
    let stored: string | undefined;
    Object.defineProperty(process.env, 'TZ', {
      configurable: true,
      get: () => stored,
      set: (v: string) => {
        writes.push(v);
        stored = v;
      },
    });
    try {
      const env = new UtcEnvironment({}, { testPath: 'x' });
      expect(stored).toBe('UTC');
      writes.length = 0;

      await env.teardown?.();

      // 收尾期间必须发生一次宿主时区赋值；只 delete 的话这里会是空数组
      expect(writes).toContain(hostTz);
    } finally {
      delete process.env.TZ;
      if (original !== undefined) process.env.TZ = original;
    }
  });
});
