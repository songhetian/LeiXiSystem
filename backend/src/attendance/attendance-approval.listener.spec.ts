import { Prisma } from '@prisma/client';
import { AttendanceApprovalListener } from './attendance-approval.listener';

// Mock PrismaService：仅覆盖请假审批分支所需的模型
function createMockPrisma() {
  const mockTx = {
    leaveRecord: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    vacationBalance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    vacationBalanceChange: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    punchMakeup: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    attendanceDaily: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    vacationType: {
      findUnique: jest.fn(),
    },
    systemSetting: {
      findUnique: jest.fn(),
    },
    overtimeRecord: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  return {
    leaveRecord: {
      findFirst: jest.fn(),
    },
    vacationBalance: {
      findUnique: jest.fn(),
    },
    punchMakeup: {
      findFirst: jest.fn(),
    },
    vacationType: {
      findUnique: jest.fn(),
    },
    systemSetting: {
      findUnique: jest.fn(),
    },
    overtimeRecord: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockTx)),
    _mockTx: mockTx,
  } as any;
}

describe('AttendanceApprovalListener - 请假审批通过扣减额度', () => {
  let listener: AttendanceApprovalListener;
  let prisma: ReturnType<typeof createMockPrisma>;

  const leaveRecord = {
    id: 1,
    employeeId: 2,
    vacationTypeId: 3,
    month: 8,
    days: new Prisma.Decimal(5),
    startDate: new Date('2026-08-10'),
    endDate: new Date('2026-08-14'),
    status: 'approving',
    vacationType: { id: 3, code: 'annual' },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    listener = new AttendanceApprovalListener(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('扣减与流水统一使用「剩余天」口径（totalDays - usedDays）', async () => {
    prisma.leaveRecord.findFirst.mockResolvedValue(leaveRecord);
    prisma._mockTx.leaveRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma._mockTx.vacationBalance.findUnique.mockResolvedValue({
      id: 9,
      totalDays: new Prisma.Decimal(10),
      usedDays: new Prisma.Decimal(2),
    });
    prisma._mockTx.vacationBalance.update.mockResolvedValue({});
    prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({});
    prisma._mockTx.leaveRecord.findUnique.mockResolvedValue({ id: 1, status: 'approved' });

    await listener.handleApproved({ instanceId: 50, workflowCode: 'leave' });

    // usedDays 2 + 5 = 7
    expect(prisma._mockTx.vacationBalance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9 },
        data: { usedDays: expect.anything() },
      }),
    );
    // 与 VacationService.deductLeaveBalance 同口径：调整前 10-2=8，调整后 10-7=3
    const change = prisma._mockTx.vacationBalanceChange.create.mock.calls[0][0].data;
    expect(Number(change.balanceBefore)).toBe(8);
    expect(Number(change.balanceAfter)).toBe(3);
    expect(change.balanceId).toBe(9);
    expect(change.referenceType).toBe('leave_record');
  });

  it('额度行不存在时不伪造 0 额度记录，跳过扣减避免出现负数余额', async () => {
    prisma.leaveRecord.findFirst.mockResolvedValue(leaveRecord);
    prisma._mockTx.leaveRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(null);

    await listener.handleApproved({ instanceId: 50, workflowCode: 'leave' });

    expect(prisma._mockTx.vacationBalance.create).not.toHaveBeenCalled();
    expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
    expect(prisma._mockTx.vacationBalanceChange.create).not.toHaveBeenCalled();
    // 状态迁移仍应完成，审批不会被阻断
    expect(prisma._mockTx.leaveRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, status: 'approving' },
        data: expect.objectContaining({ status: 'approved' }),
      }),
    );
  });

  it('幂等：未抢到「approving → approved」令牌时不执行扣减', async () => {
    prisma.leaveRecord.findFirst.mockResolvedValue(leaveRecord);
    prisma._mockTx.leaveRecord.updateMany.mockResolvedValue({ count: 0 });

    await listener.handleApproved({ instanceId: 50, workflowCode: 'leave' });

    expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
    expect(prisma._mockTx.vacationBalanceChange.create).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// 补卡审批：只在该方向确实缺卡时生效/回滚，不得抹掉真实打卡
// ------------------------------------------------------------------
describe('AttendanceApprovalListener - 补卡审批对考勤日报的影响', () => {
  let listener: AttendanceApprovalListener;
  let prisma: ReturnType<typeof createMockPrisma>;

  const makeupTime = new Date('2026-08-10T01:00:00.000Z');
  const realPunchTime = new Date('2026-08-10T01:31:00.000Z');

  function baseDaily(overrides: Record<string, unknown> = {}) {
    return {
      id: 33,
      firstPunch: null,
      lastPunch: null,
      punchCount: 0,
      lateMinutes: 0,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(0),
      status: 'normal',
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = createMockPrisma();
    listener = new AttendanceApprovalListener(prisma);
    // 默认抢到「approving → approved」一次性令牌
    prisma._mockTx.punchMakeup.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('通过：该方向缺卡时写入补卡时间、punchCount+1 并清零迟到分钟', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      reason: '忘记打卡',
      status: 'approving',
    });
    prisma._mockTx.punchMakeup.update.mockResolvedValue({});
    prisma._mockTx.attendanceDaily.findUnique.mockResolvedValue(baseDaily({ absentMinutes: 480, status: 'absent' }));
    prisma._mockTx.attendanceDaily.update.mockResolvedValue({
      punchCount: 1,
      lateMinutes: 0,
      earlyMinutes: 0,
      absentMinutes: 480,
      leaveDays: new Prisma.Decimal(0),
      status: 'absent',
    });

    await listener.handleApproved({ instanceId: 60, workflowCode: 'punch_makeup' });

    const data = prisma._mockTx.attendanceDaily.update.mock.calls[0][0].data;
    expect(data.firstPunch).toEqual(makeupTime);
    expect(data.punchCount).toEqual({ increment: 1 });
    expect(data.lateMinutes).toBe(0);
  });

  it('通过：该方向已有真实打卡时不覆盖打卡、不清零真实迟到分钟', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      reason: '忘记打卡',
      status: 'approving',
    });
    prisma._mockTx.punchMakeup.update.mockResolvedValue({});
    prisma._mockTx.attendanceDaily.findUnique.mockResolvedValue(
      baseDaily({ firstPunch: realPunchTime, punchCount: 1, lateMinutes: 16, status: 'late' }),
    );
    prisma._mockTx.attendanceDaily.update.mockResolvedValue({
      punchCount: 1,
      lateMinutes: 16,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(0),
      status: 'late',
    });

    await listener.handleApproved({ instanceId: 60, workflowCode: 'punch_makeup' });

    const data = prisma._mockTx.attendanceDaily.update.mock.calls[0][0].data;
    expect(data.firstPunch).toBeUndefined();
    expect(data.punchCount).toBeUndefined();
    expect(data.lateMinutes).toBeUndefined();
    expect(data.makeupReason).toBe('忘记打卡');
  });

  it('通过：重复投递时未抢到「approving → approved」令牌的一方不得再次写卡', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      reason: '忘记打卡',
      status: 'approving',
    });
    // 另一份重复事件已抢先完成状态迁移与写卡
    prisma._mockTx.punchMakeup.updateMany.mockResolvedValue({ count: 0 });

    await listener.handleApproved({ instanceId: 60, workflowCode: 'punch_makeup' });

    expect(prisma._mockTx.punchMakeup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7, status: 'approving' } }),
    );
    expect(prisma._mockTx.attendanceDaily.update).not.toHaveBeenCalled();
  });

  it('撤回：打卡确由本补卡写入时清空并递减 punchCount', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    prisma._mockTx.punchMakeup.findUnique.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    prisma._mockTx.attendanceDaily.findUnique.mockResolvedValue(
      baseDaily({ firstPunch: makeupTime, punchCount: 2, lateMinutes: 0 }),
    );
    prisma._mockTx.attendanceDaily.update.mockResolvedValue({
      punchCount: 1,
      lateMinutes: 0,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(0),
      status: 'normal',
    });

    await listener.handleWithdrawn({ instanceId: 60, workflowCode: 'punch_makeup' });

    const data = prisma._mockTx.attendanceDaily.update.mock.calls[0][0].data;
    expect(data.firstPunch).toBeNull();
    expect(data.punchCount).toEqual({ decrement: 1 });
  });

  // 缺勤日的 punchCount=0、absentMinutes 恒为 0（引擎从不写该列），
  // 故「撤回后是否仍缺勤」只能由 punchCount 推导，否则会被洗成 normal。
  it('撤回：当日打卡全部来自本补卡时，撤回后应回落到缺勤（不能洗成 normal）', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    prisma._mockTx.punchMakeup.findUnique.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    // 补卡通过后写入 0 → 1 次打卡，日报被改成 normal
    prisma._mockTx.attendanceDaily.findUnique.mockResolvedValue(
      baseDaily({ firstPunch: makeupTime, punchCount: 1, status: 'normal' }),
    );
    prisma._mockTx.attendanceDaily.update
      .mockResolvedValueOnce({
        punchCount: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        absentMinutes: 0,
        leaveDays: new Prisma.Decimal(0),
        status: 'normal',
      })
      .mockResolvedValueOnce({});

    await listener.handleWithdrawn({ instanceId: 60, workflowCode: 'punch_makeup' });

    expect(prisma._mockTx.attendanceDaily.update.mock.calls[1][0].data).toEqual({ status: 'absent' });
  });

  it('驳回：当日打卡全部来自本补卡时，驳回后应回落到缺勤（不能洗成 normal）', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approving',
    });
    prisma._mockTx.punchMakeup.findUnique.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    prisma._mockTx.attendanceDaily.findUnique.mockResolvedValue(
      baseDaily({ firstPunch: makeupTime, punchCount: 1, status: 'normal' }),
    );
    prisma._mockTx.attendanceDaily.update
      .mockResolvedValueOnce({
        punchCount: 0,
        lateMinutes: 0,
        earlyMinutes: 0,
        absentMinutes: 0,
        leaveDays: new Prisma.Decimal(0),
        status: 'normal',
      })
      .mockResolvedValueOnce({});

    await listener.handleRejected({ instanceId: 60, workflowCode: 'punch_makeup' });

    expect(prisma._mockTx.attendanceDaily.update.mock.calls[1][0].data).toEqual({ status: 'absent' });
  });

  it('撤回：该方向是真实打卡时不得抹掉，也不得递减 punchCount', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    prisma._mockTx.punchMakeup.findUnique.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    prisma._mockTx.attendanceDaily.findUnique.mockResolvedValue(
      baseDaily({ firstPunch: realPunchTime, punchCount: 1, lateMinutes: 16, status: 'late' }),
    );

    await listener.handleWithdrawn({ instanceId: 60, workflowCode: 'punch_makeup' });

    expect(prisma._mockTx.punchMakeup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, status: 'approved' },
        data: expect.objectContaining({ status: 'draft' }),
      }),
    );
    expect(prisma._mockTx.attendanceDaily.update).not.toHaveBeenCalled();
  });

  it('驳回：事务内状态已是 approved（事务外快照仍是 approving）时必须连同已写入的打卡一起撤回', async () => {
    // 事务外读到的还是 approving，但事务内该补卡已被「通过」路径写成 approved 并落了卡
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approving',
    });
    prisma._mockTx.punchMakeup.findUnique.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approved',
    });
    prisma._mockTx.punchMakeup.updateMany.mockResolvedValue({ count: 1 });
    prisma._mockTx.attendanceDaily.findUnique.mockResolvedValue(
      baseDaily({ firstPunch: makeupTime, punchCount: 1, lateMinutes: 0 }),
    );
    prisma._mockTx.attendanceDaily.update.mockResolvedValue({
      punchCount: 1,
      lateMinutes: 0,
      earlyMinutes: 0,
      absentMinutes: 0,
      leaveDays: new Prisma.Decimal(0),
      status: 'normal',
    });

    await listener.handleRejected({ instanceId: 60, workflowCode: 'punch_makeup' });

    expect(prisma._mockTx.punchMakeup.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7, status: 'approved' },
        data: expect.objectContaining({ status: 'rejected' }),
      }),
    );
    const data = prisma._mockTx.attendanceDaily.update.mock.calls[0][0].data;
    expect(data.firstPunch).toBeNull();
    expect(data.punchCount).toEqual({ decrement: 1 });
  });

  it('驳回：事务内状态已被终结（draft/rejected）时不改写状态、不回滚打卡', async () => {
    prisma.punchMakeup.findFirst.mockResolvedValue({
      id: 7,
      employeeId: 2,
      punchDate: new Date('2026-08-10'),
      punchType: 'check_in',
      makeupTime,
      status: 'approving',
    });
    prisma._mockTx.punchMakeup.findUnique.mockResolvedValue({
      id: 7,
      status: 'draft',
    });

    await listener.handleRejected({ instanceId: 60, workflowCode: 'punch_makeup' });

    expect(prisma._mockTx.punchMakeup.updateMany).not.toHaveBeenCalled();
    expect(prisma._mockTx.attendanceDaily.update).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// 加班转调休：折算比率必须读系统设置 overtime_to_leave_hours（默认 8），
// 且「审批通过折算」与「驳回/撤回扣回」两条路径共用同一口径。
// ------------------------------------------------------------------
describe('AttendanceApprovalListener - 加班转调休折算比率', () => {
  let listener: AttendanceApprovalListener;
  let prisma: ReturnType<typeof createMockPrisma>;

  const overtimeRecord = {
    id: 11,
    employeeId: 2,
    hours: new Prisma.Decimal(10),
    overtimeDate: new Date('2026-08-10'),
    status: 'approving',
    isCompensated: false,
    approvalInstanceId: 70,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    listener = new AttendanceApprovalListener(prisma);
    // 系统设置：10 小时 = 1 天调休（非默认 8）
    prisma.systemSetting.findUnique.mockResolvedValue({ key: 'overtime_to_leave_hours', value: '10' });
    prisma._mockTx.systemSetting.findUnique.mockResolvedValue({
      key: 'overtime_to_leave_hours',
      value: '10',
    });
    prisma.vacationType.findUnique.mockResolvedValue({ id: 5, code: 'compensatory', monthlyDays: null });
    prisma._mockTx.vacationType.findUnique.mockResolvedValue({
      id: 5,
      code: 'compensatory',
      monthlyDays: null,
    });
    // 状态迁移/扣回默认都抢到一次性令牌
    prisma._mockTx.overtimeRecord.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('审批通过：按 overtime_to_leave_hours 折算（10 小时 → 1 天，而非 ÷8 的 1.25 天）', async () => {
    prisma.overtimeRecord.findFirst.mockResolvedValue(overtimeRecord);
    prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue(overtimeRecord);
    prisma._mockTx.overtimeRecord.update.mockResolvedValue({});
    prisma._mockTx.vacationBalance.findUnique.mockResolvedValue({
      id: 21,
      totalDays: new Prisma.Decimal(3),
      usedDays: new Prisma.Decimal(0),
    });
    prisma._mockTx.vacationBalance.update.mockResolvedValue({});
    prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({});

    await listener.handleApproved({ instanceId: 70, workflowCode: 'overtime' });

    expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
      where: { key: 'overtime_to_leave_hours' },
    });
    const change = prisma._mockTx.vacationBalanceChange.create.mock.calls[0][0].data;
    expect(Number(change.amount)).toBe(1);
    expect(change.changeType).toBe('conversion');
    const balanceUpdate = prisma._mockTx.vacationBalance.update.mock.calls[0][0].data;
    expect(Number(balanceUpdate.totalDays)).toBe(4);
  });

  it('撤回已转调休的加班：按同一比率扣回（10 小时 → 扣 1 天）', async () => {
    prisma.overtimeRecord.findFirst.mockResolvedValue({
      ...overtimeRecord,
      status: 'approved',
      isCompensated: true,
    });
    prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue({
      ...overtimeRecord,
      status: 'approved',
      isCompensated: true,
    });
    prisma._mockTx.overtimeRecord.update.mockResolvedValue({});
    prisma._mockTx.vacationBalance.findUnique.mockResolvedValue({
      id: 21,
      totalDays: new Prisma.Decimal(4),
      usedDays: new Prisma.Decimal(0),
    });
    prisma._mockTx.vacationBalance.update.mockResolvedValue({});
    prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({});

    await listener.handleWithdrawn({ instanceId: 70, workflowCode: 'overtime' });

    const change = prisma._mockTx.vacationBalanceChange.create.mock.calls[0][0].data;
    expect(Number(change.amount)).toBe(1);
    expect(change.changeType).toBe('deduction');
    const balanceUpdate = prisma._mockTx.vacationBalance.update.mock.calls[0][0].data;
    expect(Number(balanceUpdate.totalDays)).toBe(3);
  });
});

// ------------------------------------------------------------------
// 审批事件竞态与幂等：事件是 fire-and-forget 且可能重复投递，
// 决策必须以「事务内最新状态」为准，并以条件更新（CAS）作为一次性令牌。
// ------------------------------------------------------------------
describe('AttendanceApprovalListener - 审批事件竞态与幂等', () => {
  let listener: AttendanceApprovalListener;
  let prisma: ReturnType<typeof createMockPrisma>;

  const leaveRecord = {
    id: 1,
    employeeId: 2,
    vacationTypeId: 3,
    month: 8,
    days: new Prisma.Decimal(5),
    startDate: new Date('2026-08-10'),
    endDate: new Date('2026-08-14'),
    status: 'approving',
    vacationType: { id: 3, code: 'annual' },
  };

  const overtimeRecord = {
    id: 11,
    employeeId: 2,
    hours: new Prisma.Decimal(10),
    overtimeDate: new Date('2026-08-10'),
    status: 'approving',
    isCompensated: false,
    approvalInstanceId: 70,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    listener = new AttendanceApprovalListener(prisma);
    prisma.systemSetting.findUnique.mockResolvedValue({ key: 'overtime_to_leave_hours', value: '10' });
    prisma._mockTx.systemSetting.findUnique.mockResolvedValue({
      key: 'overtime_to_leave_hours',
      value: '10',
    });
    prisma.vacationType.findUnique.mockResolvedValue({ id: 5, code: 'compensatory', monthlyDays: null });
    prisma._mockTx.vacationType.findUnique.mockResolvedValue({
      id: 5,
      code: 'compensatory',
      monthlyDays: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('请假驳回：事务外快照仍是 approving，但事务内已是 approved 时必须退回额度', async () => {
    // 事件在「通过」事务提交前读取到 approving，提交后却又成功抢到驳回
    prisma.leaveRecord.findFirst.mockResolvedValue({ ...leaveRecord, status: 'approving' });
    prisma._mockTx.leaveRecord.findUnique.mockResolvedValue({ ...leaveRecord, status: 'approved' });
    prisma._mockTx.leaveRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma._mockTx.vacationBalance.findUnique.mockResolvedValue({
      id: 9,
      totalDays: new Prisma.Decimal(10),
      usedDays: new Prisma.Decimal(7),
    });
    prisma._mockTx.vacationBalance.update.mockResolvedValue({});
    prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({});

    await listener.handleRejected({ instanceId: 50, workflowCode: 'leave' });

    // 只能从「事务内实际状态」迁移，不能盲迁
    expect(prisma._mockTx.leaveRecord.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'approved' },
      data: { status: 'rejected' },
    });
    // 已通过就必须退回：usedDays 7 - 5 = 2
    expect(prisma._mockTx.vacationBalance.update).toHaveBeenCalled();
    expect(Number(prisma._mockTx.vacationBalance.update.mock.calls[0][0].data.usedDays)).toBe(2);
  });

  it('请假驳回：事务内状态已被终结（draft/rejected）时不改写状态、不退款', async () => {
    prisma.leaveRecord.findFirst.mockResolvedValue({ ...leaveRecord, status: 'approving' });
    prisma._mockTx.leaveRecord.findUnique.mockResolvedValue({ ...leaveRecord, status: 'rejected' });

    await listener.handleRejected({ instanceId: 50, workflowCode: 'leave' });

    expect(prisma._mockTx.leaveRecord.updateMany).not.toHaveBeenCalled();
    expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
    expect(prisma._mockTx.vacationBalanceChange.create).not.toHaveBeenCalled();
  });

  it('请假撤回：事务内已是 approved 时按事务内状态退回额度', async () => {
    prisma.leaveRecord.findFirst.mockResolvedValue({ ...leaveRecord, status: 'approving' });
    prisma._mockTx.leaveRecord.findUnique.mockResolvedValue({ ...leaveRecord, status: 'approved' });
    prisma._mockTx.leaveRecord.updateMany.mockResolvedValue({ count: 1 });
    prisma._mockTx.vacationBalance.findUnique.mockResolvedValue({
      id: 9,
      totalDays: new Prisma.Decimal(10),
      usedDays: new Prisma.Decimal(7),
    });
    prisma._mockTx.vacationBalance.update.mockResolvedValue({});
    prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({});

    await listener.handleWithdrawn({ instanceId: 50, workflowCode: 'leave' });

    expect(prisma._mockTx.leaveRecord.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'approved' },
      data: { status: 'draft', approvalInstanceId: null },
    });
    expect(Number(prisma._mockTx.vacationBalance.update.mock.calls[0][0].data.usedDays)).toBe(2);
  });

  it('加班通过：重复投递时未抢到「isCompensated: false」令牌的一方不得再次入账', async () => {
    prisma.overtimeRecord.findFirst.mockResolvedValue(overtimeRecord);
    prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue(overtimeRecord);
    // 另一条路径（另一份重复事件/审批回调）已抢先兑换
    prisma._mockTx.overtimeRecord.updateMany.mockResolvedValue({ count: 0 });

    await listener.handleApproved({ instanceId: 70, workflowCode: 'overtime' });

    expect(prisma._mockTx.overtimeRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 11, isCompensated: false } }),
    );
    expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
    expect(prisma._mockTx.vacationBalanceChange.create).not.toHaveBeenCalled();
  });

  it('加班撤回：扣回一次性令牌已被消费时不得重复扣回调休', async () => {
    prisma.overtimeRecord.findFirst.mockResolvedValue({
      ...overtimeRecord,
      status: 'approved',
      isCompensated: true,
    });
    prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue({
      ...overtimeRecord,
      status: 'approved',
      isCompensated: true,
    });
    prisma._mockTx.overtimeRecord.updateMany
      .mockResolvedValueOnce({ count: 1 }) // 状态迁移抢到
      .mockResolvedValueOnce({ count: 0 }); // 扣回令牌已被别的路径消费

    await listener.handleWithdrawn({ instanceId: 70, workflowCode: 'overtime' });

    // 第二次（扣回）令牌必须以 isCompensated:true 为条件
    expect(prisma._mockTx.overtimeRecord.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 11, isCompensated: true },
      data: { isCompensated: false, compensatedAt: null },
    });
    expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
    expect(prisma._mockTx.vacationBalanceChange.create).not.toHaveBeenCalled();
  });
});