// 打卡同步的并发幂等（缺陷 P2-7）
// 背景：syncFromDevice 只做 tx.punchLog.create，无锁、不捕 P2002。
// 定时任务与手动 syncNow 并发时，两条链路都可能读到「尚不存在」→ 写库撞唯一约束
// (@@unique([employeeNo, punchTime, deviceNo]))，P2002 让整台设备批次回滚。
// 修法：按设备加锁 + 写库用 createMany({ skipDuplicates: true })（由唯一约束兜底去重）。
import { describe, it, expect, jest } from '@jest/globals';
import { PunchSyncService } from '../src/attendance/punch-sync.service';

function makeService(opts: { createMany?: jest.Mock } = {}) {
  const lockKeys: string[] = [];
  const createMany = opts.createMany ?? jest.fn(async () => ({ count: 1 }));

  const tx = { punchLog: { createMany } };
  const prisma = {
    punchDevice: {
      findMany: jest.fn(async () => [
        { deviceNo: 'D1', ipAddress: '10.0.0.9', port: 80, apiKey: null, enabled: true },
      ]),
    },
    punchSyncState: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async () => ({})),
    },
    employee: {
      findMany: jest.fn(async () => [{ employeeNo: 'E1' }]),
    },
    punchLog: {
      findMany: jest.fn(async () => []), // 无历史记录
      createMany,
    },
    $transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(tx)),
  };

  const lockService = {
    withLock: jest.fn(async (key: string, _ttl: number, fn: () => Promise<unknown>) => {
      lockKeys.push(key);
      return fn();
    }),
  };

  const service = new PunchSyncService(prisma as never, lockService as never);
  // 设备返回一条记录（走真实 parseXFaceRecords）
  jest
    .spyOn(service, 'fetchFromDevice')
    .mockResolvedValue({ ret: 0, rows: [{ emp_code: 'E1', punch_time: '2026-09-01 09:00:00', device_sn: 'D1' }] });

  return { service, createMany, lockKeys, prisma };
}

describe('打卡同步 · 并发幂等（P2-7）', () => {
  it('同步按设备加锁（同一设备不会被两条链路同时写）', async () => {
    const { service, lockKeys } = makeService();

    await service.syncNow();

    expect(lockKeys.some((k) => k.includes('D1'))).toBe(true);
  });

  it('写库必须声明 skipDuplicates，交给唯一约束去重（并发撞车不整批回滚）', async () => {
    const { service, createMany } = makeService();

    await service.syncNow();

    expect(createMany).toHaveBeenCalledTimes(1);
    const args = createMany.mock.calls[0][0] as unknown as { skipDuplicates?: boolean; data: unknown[] };
    expect(args.skipDuplicates).toBe(true);
    expect(args.data).toHaveLength(1);
  });

  it('万一仍抛 P2002（重复记录）→ 不向上抛，整批同步不失败', async () => {
    const createMany = jest.fn(async () => {
      throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    });

    const { service } = makeService({ createMany });

    await expect(service.syncNow()).resolves.toBeDefined();
  });
});
