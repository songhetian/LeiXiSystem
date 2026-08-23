import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceDailyStatus } from '@prisma/client';
import { DistributedLockService } from '../common/distributed-lock.service';

// API 打卡服务（Q9/Q14）：上班/下班打卡，写 AttendanceDaily + PunchLog
// 对齐旧项目 server/routes/attendance-clock.js 的迟到/早退判定逻辑
@Injectable()
export class PunchService {
  private readonly LOCK_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lockService: DistributedLockService,
  ) {}

  private lateThresholdCache: { value: number; expiresAt: number } | null = null;
  private earlyThresholdCache: { value: number; expiresAt: number } | null = null;

  private readonly CACHE_TTL = 5 * 60 * 1000;

  /**
   * 上班打卡
   * - 按 userId 查员工 → 今日排班(含班次) → 校验是否已打卡 → 写 firstPunch + PunchLog
   * - 迟到判定：打卡时间 > 班次开始 + 迟到阈值（阈值来源：班次或全局设置）
   */
  async clockIn(userId: number): Promise<{
    status: AttendanceDailyStatus;
    clockInTime: Date;
    shiftName: string | null;
  }> {
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (!employee) {
      throw new NotFoundException({ code: 1002, message: '员工不存在' });
    }

    const today = this.today();

    // 分布式锁串行化同一员工同天打卡，防并发双击产生的重复 PunchLog
    const lockKey = `punch:in:${employee.id}:${today.toISOString()}`;
    return this.lockService.withLock(lockKey, this.LOCK_TTL_MS, async () => {
      // 今日排班（含班次信息），用于迟到判定
      const schedule = await this.prisma.schedule.findFirst({
        where: { employeeId: employee.id, workDate: today },
        include: { shift: true },
      });

      // 校验是否已打过上班卡
      const existing = await this.prisma.attendanceDaily.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: today } },
      });
      if (existing && existing.firstPunch) {
        throw new BadRequestException('今天已经打过上班卡了');
      }

      const clockInTime = new Date();
      let status: AttendanceDailyStatus = 'normal';
      let lateMinutes = 0;
      let shiftName: string | null = null;

      if (schedule && schedule.shift) {
        const shift = schedule.shift;
        shiftName = shift.name;
        const lateThreshold = await this.resolveLateThreshold(shift);
        const shiftStart = this.combineTime(today, shift.startTime);
        // 迟到：打卡时间超过 班次开始 + 阈值
        if (clockInTime.getTime() - shiftStart.getTime() > lateThreshold * 60 * 1000) {
          status = 'late';
          lateMinutes = Math.max(0, Math.floor((clockInTime.getTime() - shiftStart.getTime()) / 60000));
        }
      }

      await this.prisma.attendanceDaily.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: today } },
        create: {
          employeeId: employee.id,
          workDate: today,
          shiftId: schedule?.shiftId ?? null,
          scheduleId: schedule?.id ?? null,
          firstPunch: clockInTime,
          punchCount: 1,
          lateMinutes,
          status,
        },
        update: {
          firstPunch: clockInTime,
          punchCount: { increment: 1 },
          lateMinutes,
          status,
        },
      });

      // 每次打卡写入 PunchLog（source='api'）
      await this.prisma.punchLog.create({
        data: {
          employeeNo: employee.employeeNo,
          deviceNo: 'api',
          punchTime: clockInTime,
          punchType: 'in',
          source: 'api',
          status: 'matched',
        },
      });

      return { status, clockInTime, shiftName };
    });
  }

  /**
   * 下班打卡
   * - 按 userId 查员工 → 今日 AttendanceDaily(含班次) → 校验已打卡上班/未打卡下班 → 写 lastPunch + PunchLog
   * - 早退判定：下班时间 < 班次结束 - 早退阈值（阈值来源：班次或全局设置）
   * - 若上班已迟到且早退 → 状态置为 late_early
   */
  async clockOut(userId: number): Promise<{
    status: AttendanceDailyStatus;
    clockOutTime: Date;
    workHours: number;
  }> {
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (!employee) {
      throw new NotFoundException({ code: 1002, message: '员工不存在' });
    }

    const today = this.today();

    // 分布式锁串行化同一员工同天打卡，防并发双击产生的重复 PunchLog
    const lockKey = `punch:out:${employee.id}:${today.toISOString()}`;
    return this.lockService.withLock(lockKey, this.LOCK_TTL_MS, async () => {
      const existing = await this.prisma.attendanceDaily.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate: today } },
        include: { shift: true },
      });

      if (!existing || !existing.firstPunch) {
        throw new BadRequestException('请先打上班卡');
      }
      if (existing.lastPunch) {
        throw new BadRequestException('今天已经打过下班卡了');
      }

      const clockOutTime = new Date();
      const clockInTime = existing.firstPunch;
      // 实际工作时长（小时，保留一位小数）
      const workHours = Number(
        ((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60)).toFixed(1),
      );

      let status = existing.status as AttendanceDailyStatus;
      let earlyMinutes = existing.earlyMinutes;

      if (existing.shift) {
        const shift = existing.shift;
        const earlyThreshold = await this.resolveEarlyThreshold(shift);
        const shiftEnd = this.combineTime(today, shift.endTime, shift.isNextDay);
        // 早退：下班时间早于 班次结束 - 阈值
        if (shiftEnd.getTime() - clockOutTime.getTime() > earlyThreshold * 60 * 1000) {
          status = status === 'late' ? 'late_early' : 'early';
          earlyMinutes = Math.max(0, Math.floor((shiftEnd.getTime() - clockOutTime.getTime()) / 60000));
        }
      }

      await this.prisma.attendanceDaily.update({
        where: { id: existing.id },
        data: {
          lastPunch: clockOutTime,
          status,
          earlyMinutes,
        },
      });

      await this.prisma.punchLog.create({
        data: {
          employeeNo: employee.employeeNo,
          deviceNo: 'api',
          punchTime: clockOutTime,
          punchType: 'out',
          source: 'api',
          status: 'matched',
        },
      });

      return { status, clockOutTime, workHours };
    });
  }

  /**
   * 员工自助设置今日排班
   * - 员工可以给自己设置今日的班次（用于无排班时的灵活打卡）
   */
  async selfSchedule(userId: number, shiftId: number) {
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (!employee) {
      throw new NotFoundException({ code: 1002, message: '员工不存在' });
    }

    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundException({ code: 2001, message: '班次不存在' });
    }

    const today = this.today();

    // 查找今日排班
    let schedule = await this.prisma.schedule.findFirst({
      where: { employeeId: employee.id, workDate: today },
    });

    if (schedule) {
      // 更新已有排班
      schedule = await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: { shiftId },
      });
    } else {
      // 创建新排班
      schedule = await this.prisma.schedule.create({
        data: {
          employeeId: employee.id,
          shiftId,
          workDate: today,
        },
      });
    }

    // 如果已有今日打卡记录，同步更新 shiftId
    const daily = await this.prisma.attendanceDaily.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate: today } },
    });
    if (daily) {
      await this.prisma.attendanceDaily.update({
        where: { id: daily.id },
        data: { shiftId, scheduleId: schedule.id },
      });
    }

    return { schedule, shift };
  }

  /**
   * 查询今日打卡状态
   * - 按 userId 查员工 → 今日 AttendanceDaily（含班次），无记录返回 null
   */
  async getToday(userId: number) {
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (!employee) {
      throw new NotFoundException({ code: 1002, message: '员工不存在' });
    }

    const today = this.today();
    const record = await this.prisma.attendanceDaily.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate: today } },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, isNextDay: true, color: true } },
        employee: { select: { id: true, employeeNo: true, name: true } },
      },
    });

    return record;
  }

  // -----------------------------------------------------------------
  // 私有辅助方法
  // -----------------------------------------------------------------

  /** 服务器本地日期的 0 点（用于 workDate 匹配） */
  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** 将 "HH:mm" 解析为指定日期上的 Date（可跨天） */
  private combineTime(date: Date, timeStr: string, isNextDay = false): Date {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(date);
    if (isNextDay) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(h, m, 0, 0);
    return d;
  }

  /** 迟到阈值（分钟）：useGlobalThreshold 时读 SystemSetting，默认 30 */
  private async resolveLateThreshold(shift: {
    useGlobalThreshold: boolean;
    lateThreshold: number;
  }): Promise<number> {
    if (shift.useGlobalThreshold) {
      const now = Date.now();
      if (this.lateThresholdCache && this.lateThresholdCache.expiresAt > now) {
        return this.lateThresholdCache.value;
      }
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'attendance.late_threshold' },
      });
      const value = setting ? Number(setting.value) : 30;
      this.lateThresholdCache = { value, expiresAt: now + this.CACHE_TTL };
      return value;
    }
    return shift.lateThreshold ?? 0;
  }

  /** 早退阈值（分钟）：useGlobalThreshold 时读 SystemSetting，默认 30 */
  private async resolveEarlyThreshold(shift: {
    useGlobalThreshold: boolean;
    earlyThreshold: number;
  }): Promise<number> {
    if (shift.useGlobalThreshold) {
      const now = Date.now();
      if (this.earlyThresholdCache && this.earlyThresholdCache.expiresAt > now) {
        return this.earlyThresholdCache.value;
      }
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'attendance.early_threshold' },
      });
      const value = setting ? Number(setting.value) : 30;
      this.earlyThresholdCache = { value, expiresAt: now + this.CACHE_TTL };
      return value;
    }
    return shift.earlyThreshold ?? 0;
  }
}
