// 考勤日报 · 加班按日类型拆分 + 无排班日加班 + min(申请,实际) 封顶 + 无薪假天数
// （缺陷 P0-2 / P2-9 的服务层落地）
//
// 规格：
//  - 加班分钟 = min(已批加班申请, 实际超时)；无已批申请 → 0（严格按规格）
//  - 平日/休息日/法定节假日分桶，供算薪取 1.5/2/3 倍
//  - 无排班的休息日/法定节假日到岗也要生成日报（否则加班费漏发）
//  - 日报记 unpaidLeaveDays（无薪假天数），月报/算薪据此只让无薪假取消全勤奖
import { Prisma } from '@prisma/client';
import { AttendanceDailyService } from '../src/attendance/attendance-daily.service';

function createMockPrisma() {
  return {
    schedule: { findMany: jest.fn() },
    employee: { findMany: jest.fn(), findUnique: jest.fn() },
    leaveRecord: { findMany: jest.fn() },
    punchLog: { findMany: jest.fn() },
    punchMakeup: { findMany: jest.fn() },
    overtimeRecord: { findMany: jest.fn() },
    holiday: { findMany: jest.fn() },
    attendanceDaily: { upsert: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };
}

const EMP = { id: 1, employeeNo: 'EMP0001' };
const SHIFT = { id: 1, startTime: '09:00', endTime: '18:00', isNextDay: false };

function schedule(workDate: string) {
  return {
    id: 1,
    employeeId: 1,
    shiftId: 1,
    workDate: new Date(workDate),
    employee: EMP,
    shift: SHIFT,
  };
}

/** 北京时间某日的 HH:mm → 真实时刻（UTC+8） */
function bj(date: string, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(`${date}T${String(h - 8).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
}

describe('AttendanceDailyService · 加班日类型与封顶（P0-2）', () => {
  let service: AttendanceDailyService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dataScope: { visibleScope: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrisma();
    dataScope = { visibleScope: jest.fn().mockResolvedValue({ all: true }) };
    service = new AttendanceDailyService(
      prisma as any,
      dataScope as any,
      { checkDateRangeHasConfirmedMonthly: jest.fn().mockResolvedValue(undefined) } as any,
    );
    prisma.punchMakeup.findMany.mockResolvedValue([]);
    prisma.overtimeRecord.findMany.mockResolvedValue([]);
    prisma.holiday.findMany.mockResolvedValue([]);
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.attendanceDaily.upsert.mockResolvedValue({ id: 1 });
    prisma.leaveRecord.findMany.mockResolvedValue([]);
  });

  it('平日加班：实际 90 分钟、已批 60 分钟 → 计 60 分钟（严格 min）', async () => {
    prisma.schedule.findMany.mockResolvedValue([schedule('2026-08-10')]);
    prisma.punchLog.findMany.mockResolvedValue([
      { employeeNo: 'EMP0001', punchTime: bj('2026-08-10', '08:55') },
      { employeeNo: 'EMP0001', punchTime: bj('2026-08-10', '19:30') },
    ]);
    prisma.overtimeRecord.findMany.mockResolvedValue([
      { employeeId: 1, overtimeDate: new Date('2026-08-10'), hours: new Prisma.Decimal(1) },
    ]);

    await service.recalculate({ startDate: '2026-08-10', endDate: '2026-08-10', userId: 1 });

    const data = prisma.attendanceDaily.upsert.mock.calls[0][0].update;
    expect(data.overtimeMinutes).toBe(60);
    expect(data.overtimeWeekdayMinutes).toBe(60);
    expect(data.overtimeWeekendMinutes).toBe(0);
    expect(data.overtimeHolidayMinutes).toBe(0);
  });

  it('平日加班：实际 90 分钟但无已批加班申请 → 计 0 分钟', async () => {
    prisma.schedule.findMany.mockResolvedValue([schedule('2026-08-10')]);
    prisma.punchLog.findMany.mockResolvedValue([
      { employeeNo: 'EMP0001', punchTime: bj('2026-08-10', '08:55') },
      { employeeNo: 'EMP0001', punchTime: bj('2026-08-10', '19:30') },
    ]);

    await service.recalculate({ startDate: '2026-08-10', endDate: '2026-08-10', userId: 1 });

    const data = prisma.attendanceDaily.upsert.mock.calls[0][0].update;
    expect(data.overtimeMinutes).toBe(0);
    expect(data.overtimeWeekdayMinutes).toBe(0);
  });

  it('休息日（周末）无排班到岗 → 生成日报，加班计入休息日桶', async () => {
    // 2026-08-02 为周日，无排班
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.employee.findMany.mockResolvedValue([EMP]);
    prisma.punchLog.findMany.mockResolvedValue([
      { employeeNo: 'EMP0001', punchTime: bj('2026-08-02', '09:00') },
      { employeeNo: 'EMP0001', punchTime: bj('2026-08-02', '17:33') },
    ]);
    prisma.overtimeRecord.findMany.mockResolvedValue([
      { employeeId: 1, overtimeDate: new Date('2026-08-02'), hours: new Prisma.Decimal(10) },
    ]);

    await service.recalculate({ startDate: '2026-08-02', endDate: '2026-08-02', userId: 1 });

    expect(prisma.attendanceDaily.upsert).toHaveBeenCalled();
    const call = prisma.attendanceDaily.upsert.mock.calls[0][0];
    expect(call.where.employeeId_workDate.workDate).toEqual(new Date('2026-08-02'));
    expect(call.create.status).toBe('weekend');
    expect(call.create.overtimeWeekendMinutes).toBe(513);
    expect(call.create.overtimeWeekdayMinutes).toBe(0);
    expect(call.create.overtimeHolidayMinutes).toBe(0);
  });

  it('法定节假日无排班到岗 → 加班计入法定桶（3 倍）', async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.employee.findMany.mockResolvedValue([EMP]);
    prisma.holiday.findMany.mockResolvedValue([
      { date: new Date('2026-10-01'), dayType: 'holiday' },
    ]);
    prisma.punchLog.findMany.mockResolvedValue([
      { employeeNo: 'EMP0001', punchTime: bj('2026-10-01', '09:00') },
      { employeeNo: 'EMP0001', punchTime: bj('2026-10-01', '12:00') },
    ]);
    prisma.overtimeRecord.findMany.mockResolvedValue([
      { employeeId: 1, overtimeDate: new Date('2026-10-01'), hours: new Prisma.Decimal(3) },
    ]);

    await service.recalculate({ startDate: '2026-10-01', endDate: '2026-10-01', userId: 1 });

    const call = prisma.attendanceDaily.upsert.mock.calls[0][0];
    expect(call.create.status).toBe('holiday');
    expect(call.create.overtimeHolidayMinutes).toBe(180);
    expect(call.create.overtimeWeekdayMinutes).toBe(0);
    expect(call.create.overtimeWeekendMinutes).toBe(0);
  });

  it('无薪假 → unpaidLeaveDays 记录天数', async () => {
    prisma.schedule.findMany.mockResolvedValue([schedule('2026-08-10')]);
    prisma.punchLog.findMany.mockResolvedValue([]);
    prisma.leaveRecord.findMany.mockResolvedValue([
      {
        employeeId: 1,
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-10'),
        days: new Prisma.Decimal(1),
        status: 'approved',
        vacationType: { isPaid: false },
      },
    ]);

    await service.recalculate({ startDate: '2026-08-10', endDate: '2026-08-10', userId: 1 });

    const data = prisma.attendanceDaily.upsert.mock.calls[0][0].update;
    expect(data.status).toBe('leave');
    expect(Number(data.unpaidLeaveDays)).toBe(1);
  });

  it('有薪假 → unpaidLeaveDays 为 0（不影响全勤奖）', async () => {
    prisma.schedule.findMany.mockResolvedValue([schedule('2026-08-10')]);
    prisma.punchLog.findMany.mockResolvedValue([]);
    prisma.leaveRecord.findMany.mockResolvedValue([
      {
        employeeId: 1,
        startDate: new Date('2026-08-10'),
        endDate: new Date('2026-08-10'),
        days: new Prisma.Decimal(1),
        status: 'approved',
        vacationType: { isPaid: true },
      },
    ]);

    await service.recalculate({ startDate: '2026-08-10', endDate: '2026-08-10', userId: 1 });

    const data = prisma.attendanceDaily.upsert.mock.calls[0][0].update;
    expect(data.status).toBe('leave');
    expect(Number(data.unpaidLeaveDays)).toBe(0);
  });
});
