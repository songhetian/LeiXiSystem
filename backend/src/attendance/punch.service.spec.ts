import { PunchService } from './punch.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LockAcquisitionError } from '../common/distributed-lock.service';

// Mock 分布式锁：默认直接执行 fn，可用 toHaveBeenCalledWith 断言调用
function createMockLockService() {
  return {
    withLock: jest.fn((_key: string, _ttl: number, fn: () => Promise<any>) => fn()),
  };
}

// Mock PrismaService（对齐 src/system/broadcast.service.spec.ts 的 mock 模式）
function createMockPrisma() {
  return {
    employee: {
      findFirst: jest.fn(),
    },
    schedule: {
      findFirst: jest.fn(),
    },
    attendanceDaily: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    systemSetting: {
      findUnique: jest.fn(),
    },
    punchLog: {
      create: jest.fn(),
    },
  } as any;
}

describe('PunchService', () => {
  let service: PunchService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let lockService: ReturnType<typeof createMockLockService>;

  beforeEach(() => {
    // 使用假时钟，默认 2026-08-15 09:00（本地时间），保证时间相关判定可复现
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 15, 9, 0, 0));
    prisma = createMockPrisma();
    lockService = createMockLockService();
    service = new PunchService(prisma, lockService as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  // =================================================================
  // clockIn
  // =================================================================
  describe('clockIn', () => {
    const employee = { id: 1, employeeNo: 'E001', name: '张三', userId: 10 };
    const shift = {
      id: 5,
      name: '早班',
      startTime: '09:00',
      endTime: '18:00',
      isNextDay: false,
      lateThreshold: 30,
      earlyThreshold: 30,
      useGlobalThreshold: false,
    };
    const schedule = { id: 100, employeeId: 1, shiftId: 5, workDate: new Date(2026, 7, 15), shift };

    // -----------------------------------------------------------------
    // 1. 无打卡记录时创建 AttendanceDaily 并写入 firstPunch
    // -----------------------------------------------------------------
    it('无打卡记录时创建 AttendanceDaily 并写入 firstPunch', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);
      prisma.attendanceDaily.upsert.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      const result = await service.clockIn(10);

      expect(result.status).toBe('normal');
      expect(result.clockInTime).toBeInstanceOf(Date);
      expect(result.shiftName).toBe('早班');
      expect(prisma.attendanceDaily.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId_workDate: { employeeId: 1, workDate: expect.any(Date) },
          },
          create: expect.objectContaining({
            employeeId: 1,
            shiftId: 5,
            scheduleId: 100,
            firstPunch: expect.any(Date),
            punchCount: 1,
            status: 'normal',
          }),
          update: expect.objectContaining({
            firstPunch: expect.any(Date),
            status: 'normal',
          }),
        }),
      );
      // 每次打卡都应写入 PunchLog（source='api'）
      expect(prisma.punchLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeNo: 'E001',
            source: 'api',
            punchType: 'in',
          }),
        }),
      );
    });

    // -----------------------------------------------------------------
    // 2. 今天已打过上班卡时抛出 BadRequestException
    // -----------------------------------------------------------------
    it('今天已打过上班卡时抛出 BadRequestException', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.attendanceDaily.findUnique.mockResolvedValue({
        id: 99,
        firstPunch: new Date(2026, 7, 15, 8, 50, 0),
        lastPunch: null,
        status: 'normal',
      });

      await expect(service.clockIn(10)).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceDaily.upsert).not.toHaveBeenCalled();
      expect(prisma.punchLog.create).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------
    // 3. 打卡时间超过 班次开始+迟到阈值 时判定 late
    // -----------------------------------------------------------------
    it('打卡时间超过 班次开始+迟到阈值 时判定 late', async () => {
      // 09:31 打卡，班次 09:00 开始，迟到阈值 30 分钟 → 31 > 30 → late
      jest.setSystemTime(new Date(2026, 7, 15, 9, 31, 0));
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);
      prisma.attendanceDaily.upsert.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      const result = await service.clockIn(10);

      expect(result.status).toBe('late');
      expect(prisma.attendanceDaily.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'late',
            lateMinutes: 31,
          }),
        }),
      );
    });

    // -----------------------------------------------------------------
    // 4. useGlobalThreshold=true 时使用全局设置阈值
    // -----------------------------------------------------------------
    it('useGlobalThreshold=true 时使用 SystemSetting 全局阈值', async () => {
      // 09:31 打卡，班次 09:00 开始，shift.lateThreshold=0（若用班次则必迟到）
      // 但 useGlobalThreshold=true → 读取全局 attendance.late_threshold=60 → 31 < 60 → normal
      jest.setSystemTime(new Date(2026, 7, 15, 9, 31, 0));
      const globalShift = { ...shift, lateThreshold: 0, useGlobalThreshold: true };
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue({ ...schedule, shift: globalShift });
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'attendance.late_threshold',
        value: '60',
      });
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);
      prisma.attendanceDaily.upsert.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      const result = await service.clockIn(10);

      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: 'attendance.late_threshold' },
      });
      // 用了全局 60 分钟阈值而非班次的 0 → 31 < 60 → normal
      expect(result.status).toBe('normal');
    });

    // -----------------------------------------------------------------
    // 辅助：员工不存在时抛出 NotFoundException
    // -----------------------------------------------------------------
    it('员工不存在时抛出 NotFoundException', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);

      await expect(service.clockIn(999)).rejects.toThrow(NotFoundException);
    });

    // -----------------------------------------------------------------
    // 时间准入限制（对齐旧项目 AttendanceHome）
    // -----------------------------------------------------------------

    // 无排班时不允许打卡（旧项目：请先排班后再打卡）
    it('无排班时拒绝打卡并提示先排班', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(null);

      await expect(service.clockIn(10)).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceDaily.upsert).not.toHaveBeenCalled();
      expect(prisma.punchLog.create).not.toHaveBeenCalled();
    });

    // 休息班次（isRest=true）当天无需打卡（旧项目：今日为休息日，无需打卡）
    it('休息班次时拒绝打卡', async () => {
      const restSchedule = {
        id: 100,
        employeeId: 1,
        shiftId: 5,
        workDate: new Date(2026, 7, 15),
        shift: { ...shift, isRest: true },
      };
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(restSchedule);

      await expect(service.clockIn(10)).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceDaily.upsert).not.toHaveBeenCalled();
    });

    // 早于「班次开始 - 提前打卡窗口」时拒绝（旧项目：需在上班前 N 分钟内打卡）
    it('早于提前打卡窗口时拒绝（默认窗口 60 分钟）', async () => {
      jest.setSystemTime(new Date(2026, 7, 15, 7, 30, 0)); // 班次 09:00，提前窗口 60 → 最早 08:00，7:30 过早
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'attendance.early_clock_in_minutes',
        value: '60',
      });

      await expect(service.clockIn(10)).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceDaily.upsert).not.toHaveBeenCalled();
    });

    // 到达提前窗口（班次开始 - 提前窗口）时允许打卡
    it('到达提前窗口（班次开始-60min）时允许打卡', async () => {
      jest.setSystemTime(new Date(2026, 7, 15, 8, 0, 0));
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'attendance.early_clock_in_minutes',
        value: '60',
      });
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);
      prisma.attendanceDaily.upsert.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      const result = await service.clockIn(10);
      // 8:00 早于班次 09:00，但在提前窗口（08:00）内允许打卡；早于班次开始不算迟到 → normal
      expect(result.status).toBe('normal');
    });
  });

  // =================================================================
  // clockOut
  // =================================================================
  describe('clockOut', () => {
    const employee = { id: 1, employeeNo: 'E001', name: '张三', userId: 10 };
    const shift = {
      id: 5,
      name: '早班',
      startTime: '09:00',
      endTime: '18:00',
      isNextDay: false,
      lateThreshold: 30,
      earlyThreshold: 30,
      useGlobalThreshold: false,
    };

    // -----------------------------------------------------------------
    // 5. 已打卡上班但未打卡下班时更新 lastPunch
    // -----------------------------------------------------------------
    it('已打卡上班但未打卡下班时更新 lastPunch', async () => {
      // 18:30 下班打卡，班次结束 18:00 → 不早退，status 维持 normal
      jest.setSystemTime(new Date(2026, 7, 15, 18, 30, 0));
      const firstPunch = new Date(2026, 7, 15, 9, 0, 0);
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.attendanceDaily.findUnique.mockResolvedValue({
        id: 99,
        employeeId: 1,
        firstPunch,
        lastPunch: null,
        status: 'normal',
        earlyMinutes: 0,
        shiftId: 5,
        shift,
      });
      prisma.attendanceDaily.update.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      const result = await service.clockOut(10);

      expect(result.status).toBe('normal');
      expect(result.clockOutTime).toBeInstanceOf(Date);
      expect(result.workHours).toBe(9.5);
      expect(prisma.attendanceDaily.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 99 },
          data: expect.objectContaining({
            lastPunch: expect.any(Date),
            status: 'normal',
          }),
        }),
      );
      expect(prisma.punchLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            employeeNo: 'E001',
            source: 'api',
            punchType: 'out',
          }),
        }),
      );
    });

    // -----------------------------------------------------------------
    // 6. 未打卡上班时打卡下班抛出 BadRequestException
    // -----------------------------------------------------------------
    it('未打卡上班时打卡下班抛出 BadRequestException', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);

      await expect(service.clockOut(10)).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceDaily.update).not.toHaveBeenCalled();
      expect(prisma.punchLog.create).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------
    // 7. 已打卡下班时再次打卡抛出 BadRequestException
    // -----------------------------------------------------------------
    it('已打卡下班时再次打卡抛出 BadRequestException', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.attendanceDaily.findUnique.mockResolvedValue({
        id: 99,
        firstPunch: new Date(2026, 7, 15, 9, 0, 0),
        lastPunch: new Date(2026, 7, 15, 18, 0, 0),
        status: 'normal',
        shift: null,
      });

      await expect(service.clockOut(10)).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceDaily.update).not.toHaveBeenCalled();
      expect(prisma.punchLog.create).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------
    // 8. 早于「班次结束-早退阈值」时不允许签退（旧项目：尚未到达签退时间）
    // -----------------------------------------------------------------
    it('早于签退准入时间时拒绝签退', async () => {
      // 17:00 下班打卡，班次结束 18:00，早退阈值 30 → 最早签退 17:30，17:00 过早 → 拒绝
      jest.setSystemTime(new Date(2026, 7, 15, 17, 0, 0));
      const firstPunch = new Date(2026, 7, 15, 9, 0, 0);
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.attendanceDaily.findUnique.mockResolvedValue({
        id: 99,
        employeeId: 1,
        firstPunch,
        lastPunch: null,
        status: 'normal',
        earlyMinutes: 0,
        shiftId: 5,
        shift,
      });

      await expect(service.clockOut(10)).rejects.toThrow(BadRequestException);
      expect(prisma.attendanceDaily.update).not.toHaveBeenCalled();
      expect(prisma.punchLog.create).not.toHaveBeenCalled();
    });

    // 8b. 到达签退准入时间（班次结束-早退阈值）时允许签退且不判早退
    it('到达签退准入时间（班次结束-早退阈值）时允许签退', async () => {
      // 17:30 下班打卡，班次结束 18:00，早退阈值 30 → 17:30 = 准入边界 → 允许，不早退
      jest.setSystemTime(new Date(2026, 7, 15, 17, 30, 0));
      const firstPunch = new Date(2026, 7, 15, 9, 0, 0);
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.attendanceDaily.findUnique.mockResolvedValue({
        id: 99,
        employeeId: 1,
        firstPunch,
        lastPunch: null,
        status: 'normal',
        earlyMinutes: 0,
        shiftId: 5,
        shift,
      });
      prisma.attendanceDaily.update.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      const result = await service.clockOut(10);
      expect(result.status).toBe('normal');
      expect(prisma.attendanceDaily.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'normal', earlyMinutes: 0 }),
        }),
      );
    });
  });

  // =================================================================
  // getToday（返回今日打卡记录 + 准入信息，供前端渲染状态/禁态）
  // =================================================================
  describe('getToday', () => {
    const employee = { id: 1, employeeNo: 'E001', name: '张三', userId: 10 };
    const shift = { id: 5, name: '早班', startTime: '09:00', endTime: '18:00', isNextDay: false, color: '#3B82F6', isRest: false };

    // 有排班但未打卡：返回记录与准入信息（今日 09:00，班次 09:00，早退窗口内可打卡）
    it('有排班未打卡时返回可上班打卡的准入信息', async () => {
      const schedule = { id: 100, employeeId: 1, shiftId: 5, workDate: new Date(2026, 7, 15), shift };
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);
      prisma.systemSetting.findUnique.mockResolvedValue({
        key: 'attendance.early_clock_in_minutes',
        value: '60',
      });

      const result = await service.getToday(10);

      expect(result).not.toBeNull();
      expect(result.shift?.name).toBe('早班');
      expect(result.hasSchedule).toBe(true);
      expect(result.clockIn.allowed).toBe(true); // 09:00 >= 09:00-60min → 可打卡
      expect(result.clockOut.allowed).toBe(false);
      expect(result.firstPunch).toBeNull();
      // 接入层仍按班次 select 需要 isRest 等字段
      expect(prisma.schedule.findFirst).toHaveBeenCalled();
    });

    // 无排班不允许打卡（旧项目：请先排班后再打卡）
    it('无排班时 clockIn.allowed=false 且提示先排班', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(null);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);

      const result = await service.getToday(10);

      expect(result.clockIn.allowed).toBe(false);
      expect(result.clockIn.message).toContain('排班');
      expect(result.hasSchedule).toBe(false);
    });

    // 休息班次：休息日无需打卡，打卡/签退均不允许
    it('排班为休息班次时 clockIn/clockOut 均不允许并提示休息日', async () => {
      const restShift = { ...shift, isRest: true, startTime: '00:00', endTime: '00:00' };
      const schedule = { id: 100, employeeId: 1, shiftId: 5, workDate: new Date(2026, 7, 15), shift: restShift };
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);

      const result = await service.getToday(10);

      expect(result.clockIn.allowed).toBe(false);
      expect(result.clockIn.message).toContain('休息');
      expect(result.clockOut.allowed).toBe(false);
      expect(result.shift?.isRest).toBe(true);
    });

    // 已上班未下班：不可再上班打卡；下班过早则不可签退
    it('已上班未下班时不可再上班打卡，且下班在准入前不可签退', async () => {
      const schedule = { id: 100, employeeId: 1, shiftId: 5, workDate: new Date(2026, 7, 15), shift };
      const record = {
        id: 99,
        employeeId: 1,
        workDate: new Date(2026, 7, 15),
        firstPunch: new Date(2026, 7, 15, 9, 0, 0),
        lastPunch: null,
        punchCount: 1,
        lateMinutes: 0,
        earlyMinutes: 0,
        status: 'normal',
        shift,
      };
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.attendanceDaily.findUnique.mockResolvedValue(record);

      const result = await service.getToday(10);

      expect(result.clockIn.allowed).toBe(false); // 已打过上班卡
      expect(result.clockOut.allowed).toBe(false); // 17:30 前不可签退（早退阈值 30 → 最早 17:30；当前 09:00）
      expect(result.clockOut.message).toContain('下班');
    });

    // 无记录且查不到排班时返回带 hasSchedule=false 与排班提示的非空对象
    it('无任何记录时不返回 null，而返回可操作的准入对象', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(null);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);

      const result = await service.getToday(10);
      expect(result).not.toBeNull();
      expect(result.clockIn.allowed).toBe(false);
      expect(result.clockOut.allowed).toBe(false);
    });

    it('员工不存在时抛出 NotFoundException', async () => {
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(service.getToday(999)).rejects.toThrow(NotFoundException);
    });
  });

  // =================================================================
  // 分布式锁（幂等）
  // =================================================================
  describe('分布式锁（幂等）', () => {
    const employee = { id: 1, employeeNo: 'E001', name: '张三', userId: 10 };
    const shift = { id: 5, name: '早班', startTime: '09:00', endTime: '18:00', isNextDay: false, lateThreshold: 30, earlyThreshold: 30, useGlobalThreshold: false };
    const schedule = { id: 100, employeeId: 1, shiftId: 5, workDate: new Date(2026, 7, 15), shift };

    // -----------------------------------------------------------------
    // L1. clockIn 在写入前获取同一员工同天的分布式锁
    // -----------------------------------------------------------------
    it('clockIn 在写 AttendanceDaily / PunchLog 前获取分布式锁', async () => {
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.schedule.findFirst.mockResolvedValue(schedule);
      prisma.attendanceDaily.findUnique.mockResolvedValue(null);
      prisma.attendanceDaily.upsert.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      await service.clockIn(10);

      expect(lockService.withLock).toHaveBeenCalledTimes(1);
      const [key] = lockService.withLock.mock.calls[0];
      // 锁 key 应包含员工 id 与日期，串行化同一员工同天打卡
      expect(key).toMatch(/^punch:in:1:/);
      // 关键写入必须在锁内执行
      expect(prisma.attendanceDaily.upsert).toHaveBeenCalled();
      expect(prisma.punchLog.create).toHaveBeenCalled();
    });

    // -----------------------------------------------------------------
    // L2. clockIn 锁获取失败时传播 LockAcquisitionError，不产生任何写入
    // -----------------------------------------------------------------
    it('clockIn 锁获取失败时传播 LockAcquisitionError 且不产生写入', async () => {
      lockService.withLock.mockRejectedValue(
        new LockAcquisitionError('punch:in:1'),
      );
      prisma.employee.findFirst.mockResolvedValue(employee);

      await expect(service.clockIn(10)).rejects.toThrow(LockAcquisitionError);
      expect(prisma.attendanceDaily.upsert).not.toHaveBeenCalled();
      expect(prisma.punchLog.create).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------
    // L3. clockOut 在写 AttendanceDaily / PunchLog 前获取分布式锁
    // -----------------------------------------------------------------
    it('clockOut 在写 lastPunch 前获取分布式锁', async () => {
      // 需在班次结束-早退阈值之后签退：18:00 结束、阈值 30 → 最早 17:30，取 18:30
      jest.setSystemTime(new Date(2026, 7, 15, 18, 30, 0));
      const firstPunch = new Date(2026, 7, 15, 9, 0, 0);
      prisma.employee.findFirst.mockResolvedValue(employee);
      prisma.attendanceDaily.findUnique.mockResolvedValue({
        id: 99,
        employeeId: 1,
        firstPunch,
        lastPunch: null,
        status: 'normal',
        earlyMinutes: 0,
        shiftId: 5,
        shift,
      });
      prisma.attendanceDaily.update.mockResolvedValue({});
      prisma.punchLog.create.mockResolvedValue({});

      await service.clockOut(10);

      expect(lockService.withLock).toHaveBeenCalledTimes(1);
      const [key] = lockService.withLock.mock.calls[0];
      expect(key).toMatch(/^punch:out:1:/);
      expect(prisma.attendanceDaily.update).toHaveBeenCalled();
    });
  });
});
