/**
 * @jest-environment ./jest-utc-environment
 */
import 'reflect-metadata';
import { PunchMakeupService } from './punch-makeup.service';
import { messageOf } from '../common/error-messages';

// 补卡的「应打卡时间/实际打卡时间」是「业务日 + HH:mm」拼出的真实时刻。
// 业务日以 UTC 午夜存储，Asia/Shanghai 恒为 UTC+8，故北京 08:55 应落库为 00:55Z。
//
// 本文件刻意在 UTC 时区下运行（见 jest-utc-environment）：这样「本地时区解析」
// 与「北京时间解析」的结果不再重合，才能暴露 8 小时偏移。
describe('PunchMakeupService · 补卡时间按北京时间解析', () => {
  let service: PunchMakeupService;
  let prisma: any;
  let settings: any;

  beforeEach(() => {
    prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 11, userId: 7 }) },
      punchMakeup: { create: jest.fn().mockImplementation(({ data }: any) => ({ id: 1, ...data })) },
    };
    settings = { getSettings: jest.fn().mockResolvedValue({ makeupDaysLimit: 30 }) };
    service = new PunchMakeupService(prisma, {} as any, {} as any, settings);
  });

  it('create：北京 08:55 的补卡落库为 00:55Z', async () => {
    // 日期动态取「今天 - 5 天」：硬编码日期会随真实时间流逝跌出 30 天补卡窗口（时间炸弹）
    const day = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    await service.create({
      userId: 7,
      punchDate: day,
      punchType: 'check_in',
      originalTime: '08:55',
      makeupTime: '09:02',
      reason: '地铁延误',
    });

    const data = prisma.punchMakeup.create.mock.calls[0][0].data;
    expect(data.originalTime.toISOString()).toBe(`${day}T00:55:00.000Z`);
    expect(data.makeupTime.toISOString()).toBe(`${day}T01:02:00.000Z`);
    // 业务日仍为 UTC 午夜
    expect(data.punchDate.toISOString()).toBe(`${day}T00:00:00.000Z`);
  });

  it('update：未重填日期时，时间沿用该业务日的北京时间', async () => {
    prisma.punchMakeup.findUnique = jest.fn().mockResolvedValue({
      id: 1,
      employeeId: 11,
      status: 'pending',
      punchDate: new Date('2026-09-24'),
    });
    prisma.employee.findUnique = jest.fn().mockResolvedValue({ id: 11, userId: 7 });
    prisma.punchMakeup.update = jest.fn().mockImplementation(({ data }: any) => ({ id: 1, ...data }));

    await service.update(1, 7, { originalTime: '18:30' });

    const data = prisma.punchMakeup.update.mock.calls[0][0].data;
    expect(data.originalTime.toISOString()).toBe('2026-09-24T10:30:00.000Z');
  });
});

// 补卡日期/次数校验的错误码此前是裸数字 2110~2112，未登记进 error-codes.ts。
// 一旦这些号段被别的语义占用，中央文案就会把补卡提示覆盖成无关文案。
describe('PunchMakeupService · 补卡校验错误码必须在中央表注册', () => {
  async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
    try {
      await fn();
    } catch (e: any) {
      return e.getResponse?.() ?? e.response ?? e;
    }
    throw new Error('预期抛出异常，但未抛出');
  }

  function createService(makeupDaysLimit: number) {
    const prisma: any = {
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 11, userId: 7 }) },
      punchMakeup: { create: jest.fn() },
    };
    const settings: any = {
      getSettings: jest.fn().mockResolvedValue({ makeupDaysLimit }),
    };
    return new PunchMakeupService(prisma, {} as any, {} as any, settings);
  }

  it('补卡日期超出可补天数：2110 已注册', async () => {
    const service = createService(3);

    const payload = await catchPayload(() =>
      service.create({
        userId: 7,
        punchDate: '2020-01-01',
        punchType: 'check_in',
        reason: '地铁延误',
      }),
    );

    expect(payload.code).toBe(2110);
    expect(messageOf(payload.code)).toBeDefined();
  });

  it('补未来日期的卡：2111 已注册且文案为「不能补未来日期的卡」', async () => {
    const service = createService(30);
    const future = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const payload = await catchPayload(() =>
      service.create({
        userId: 7,
        punchDate: future,
        punchType: 'check_in',
        reason: '地铁延误',
      }),
    );

    expect(payload.code).toBe(2111);
    expect(messageOf(payload.code)).toBe('不能补未来日期的卡');
  });

  it('当月补卡次数超限：2112 已注册', () => {
    expect(messageOf(2112)).toBe('当月补卡次数已达上限');
  });
});

// 「终审通过」只有一条写入路径：approval.approved 监听器。
// 补卡落库（写 attendanceDaily）只在该监听器里发生，因此监听器必须以
// 「approving → approved」条件更新抢一次性令牌；若服务层抢先无条件改写状态，
// 监听器就会因令牌失效而直接返回，补卡将永远不会写进考勤日报。
describe('PunchMakeupService · 审批终审职责归属', () => {
  function createService() {
    const prisma: any = {
      punchMakeup: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          status: 'approving',
          approvalInstanceId: 88,
        }),
        update: jest.fn().mockResolvedValue({ id: 7, status: 'approved' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 1, realName: '张三' }) },
    };
    const approvalService: any = { approve: jest.fn().mockResolvedValue({ status: 'approved' }) };
    return { prisma, approvalService, service: new PunchMakeupService(prisma, {} as any, approvalService, {} as any) };
  }

  it('approve 只驱动审批接口，不得自行终审改写状态', async () => {
    const { prisma, approvalService, service } = createService();

    await service.approve(7, 1, '同意');

    expect(approvalService.approve).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 88, userId: 1, comment: '同意' }),
    );
    expect(prisma.punchMakeup.update).not.toHaveBeenCalled();
  });
});