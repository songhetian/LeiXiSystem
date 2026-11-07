import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceDailyStatus } from '@prisma/client';
import { DistributedLockService } from '../common/distributed-lock.service';
import { beijingBusinessDate, beijingDateTime } from '../common/date.util';
import { ERROR_CODES } from '../common/error-codes';

// API 打卡服务（Q9/Q14）：上班/下班打卡，写 AttendanceDaily + PunchLog
// 对齐旧项目 server/routes/attendance-clock.js 的迟到/早退判定逻辑
@Injectable()
export class PunchService {
  private readonly LOCK_TTL_MS = 30_000;

  /**
   * 夜班跨天签退的宽限窗口（小时）。
   * 班次结束并不意味着员工立刻离岗：收尾、交接、睡过头都会让签退晚于结束时刻，
   * 窗口内继续把打卡归属到「班次开始那天」；超过窗口视为新的一天，
   * 避免昨天忘签退的人把今天的打卡算到昨天。
   */
  private readonly NIGHT_FALLBACK_GRACE_HOURS = 6;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lockService: DistributedLockService,
  ) {}

  private lateThresholdCache: { value: number; expiresAt: number } | null = null;
  private earlyThresholdCache: { value: number; expiresAt: number } | null = null;
  private earlyClockInCache: { value: number; expiresAt: number } | null = null;

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
      throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_NOT_FOUND, message: '员工不存在' });
    }

    // 归属业务日（含跨天班次回退）在加锁前解析，锁 key 需要用它
    const { workDate, schedule } = await this.resolveBusinessContext(employee.id);

    // 分布式锁串行化同一员工同天打卡，防并发双击产生的重复 PunchLog
    const lockKey = `punch:in:${employee.id}:${workDate.toISOString()}`;
    return this.lockService.withLock(lockKey, this.LOCK_TTL_MS, async () => {
      // 校验是否已打过上班卡
      const existing = await this.prisma.attendanceDaily.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      });
      if (existing && existing.firstPunch) {
        throw new BadRequestException('今天已经打过上班卡了');
      }

      // ── 时间准入限制（对齐旧项目 AttendanceHome.checkClockInTime）──
      // 未排班 → 拒绝
      if (!schedule) {
        throw new BadRequestException('请先排班后再打卡');
      }
      const shift = schedule.shift;
      // 休息班次 → 拒绝
      if (shift && shift.isRest) {
        throw new BadRequestException('今日为休息日，无需打卡');
      }

      const clockInTime = new Date();
      let status: AttendanceDailyStatus = 'normal';
      let lateMinutes = 0;
      let shiftName: string | null = null;

      if (shift) {
        shiftName = shift.name;
        // 班次开始固定落在业务日当天：isNextDay 只表示「结束时间跨天」
        const shiftStart = beijingDateTime(workDate, shift.startTime);
        // 提前打卡窗口：now < 班次开始 - 提前窗口 时拒绝
        const advance = await this.resolveEarlyClockInMinutes();
        const earliest = new Date(shiftStart.getTime() - advance * 60 * 1000);
        if (clockInTime.getTime() < earliest.getTime()) {
          throw new BadRequestException(`需在上班前${advance}分钟内打卡`);
        }

        const lateThreshold = await this.resolveLateThreshold(shift);
        // 迟到：打卡时间超过 班次开始 + 阈值
        if (clockInTime.getTime() - shiftStart.getTime() > lateThreshold * 60 * 1000) {
          status = 'late';
          lateMinutes = Math.max(0, Math.floor((clockInTime.getTime() - shiftStart.getTime()) / 60000));
        }
      }

      await this.prisma.attendanceDaily.upsert({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
        create: {
          employeeId: employee.id,
          workDate,
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
      throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_NOT_FOUND, message: '员工不存在' });
    }

    // 归属业务日：夜班在次日凌晨签退时会回退到「昨日」，否则查不到上班记录
    const { workDate, schedule } = await this.resolveBusinessContext(employee.id);

    // 分布式锁串行化同一员工同天打卡，防并发双击产生的重复 PunchLog
    const lockKey = `punch:out:${employee.id}:${workDate.toISOString()}`;
    return this.lockService.withLock(lockKey, this.LOCK_TTL_MS, async () => {
      const existing = await this.prisma.attendanceDaily.findUnique({
        where: { employeeId_workDate: { employeeId: employee.id, workDate } },
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

      // 不直接沿用 existing.status：中途的排班变更重算或其它写入路径可能把
      // 「上班中」落成了 early/absent 之类的瞬时值。迟到标记从 lateMinutes 推导
      // 保留（迟到 + 早退 = late_early），其余以本次下班结果为准 —— 正常下班时
      // 顺带把脏状态修正回 normal。
      let status: AttendanceDailyStatus = existing.lateMinutes > 0 ? 'late' : 'normal';
      let earlyMinutes = existing.earlyMinutes;

      // 打卡记录已带班次时以它为准；否则回退到业务日排班的班次
      const shift = existing.shift ?? schedule?.shift ?? null;
      if (shift) {
        const earlyThreshold = await this.resolveEarlyThreshold(shift);
        // 结束时间才跨天：isNextDay 时顺延 1 天
        const shiftEnd = beijingDateTime(workDate, shift.endTime, shift.isNextDay ? 1 : 0);

        // ── 签退准入限制（对齐旧项目 AttendanceHome.checkClockOutTime）──
        // 未到「班次结束 - 早退阈值」时不允许签退
        const earliest = new Date(shiftEnd.getTime() - earlyThreshold * 60 * 1000);
        if (clockOutTime.getTime() < earliest.getTime()) {
          const diffMin = Math.ceil((earliest.getTime() - clockOutTime.getTime()) / 60000);
          throw new BadRequestException(
            earlyThreshold > 0
              ? `需在下班前${earlyThreshold}分钟内才允许签退`
              : `尚未到达下班时间，还需等待 ${diffMin} 分钟`,
          );
        }

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
   * - 仅限「今日无排班」时使用：排班是管理员的权威口径，已有排班时不允许员工
   *   自行改班次 —— 否则迟到的员工可以把班次改成很晚的时刻，下一次日报重算
   *   （引擎按首末卡对新班次重推，不做提前打卡窗口校验）就会把迟到洗掉。
   *   前端打卡页也只在无排班时给入口，此处是后端的最终防线。
   */
  async selfSchedule(userId: number, shiftId: number) {
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (!employee) {
      throw new NotFoundException({ code: ERROR_CODES.EMPLOYEE_NOT_FOUND, message: '员工不存在' });
    }

    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      throw new NotFoundException({ code: ERROR_CODES.SHIFT_NOT_FOUND, message: '班次不存在' });
    }

    const today = this.businessDate();

    const existing = await this.prisma.schedule.findFirst({
      where: { employeeId: employee.id, workDate: today },
    });
    if (existing) {
      throw new BadRequestException('今日已有排班，如需调整请联系考勤管理员');
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        employeeId: employee.id,
        shiftId,
        workDate: today,
      },
    });

    return { schedule, shift };
  }

  /**
   * 查询今日打卡状态（含准入信息，供前端渲染状态/禁态）
   * - 对齐旧项目 AttendanceHome.checkClockInTime / checkClockOutTime
   * - 返回：打卡记录字段 + hasSchedule / isRestDay / clockIn / clockOut 准入判定
   */
  async getToday(userId: number) {
    const employee = await this.prisma.employee.findFirst({ where: { userId } });
    if (!employee) {
      // 「账号没有绑定员工档案」是可表达的正常状态，不是异常：
      // 超级管理员等纯系统账号本来就可能没有档案。这里若抛 404，前端请求层会
      // 直接弹「员工不存在」的红色错误，用户看到的是一句无从下手的报错。
      // 返回空状态交给页面渲染引导（去员工档案里绑定本账号）更合适；
      // 真正要写数据的 clockIn/clockOut 仍会拦（见各自的 EMPLOYEE_NOT_FOUND）。
      return {
        noEmployeeProfile: true,
        workDate: this.businessDate(),
        firstPunch: null,
        lastPunch: null,
        shift: null,
        hasSchedule: false,
        isRestDay: false,
        clockIn: { allowed: false, message: '当前账号未绑定员工档案' },
        clockOut: { allowed: false, message: '当前账号未绑定员工档案' },
      };
    }

    // 与打卡保持一致：夜班跨天时凌晨仍归属昨日业务日
    const { workDate, schedule } = await this.resolveBusinessContext(employee.id);

    const record = await this.prisma.attendanceDaily.findUnique({
      where: { employeeId_workDate: { employeeId: employee.id, workDate } },
      include: {
        shift: { select: { id: true, name: true, startTime: true, endTime: true, isNextDay: true, color: true, isRest: true } },
        employee: { select: { id: true, employeeNo: true, name: true } },
      },
    });

    const shift = record?.shift ?? schedule?.shift ?? null;
    const now = new Date();

    return {
      ...(record ?? {}),
      workDate,
      // 无记录时明确置 null，避免前端取 undefined
      firstPunch: record?.firstPunch ?? null,
      lastPunch: record?.lastPunch ?? null,
      shift,
      hasSchedule: !!schedule,
      isRestDay: shift ? shift.isRest === true : false,
      clockIn: await this.computeClockInAdmission(shift, !!record?.firstPunch, now, workDate),
      clockOut: await this.computeClockOutAdmission(
        shift,
        !!record?.firstPunch,
        !!record?.lastPunch,
        now,
        workDate,
      ),
    };
  }

  // -----------------------------------------------------------------
  // 私有辅助方法
  // -----------------------------------------------------------------

  /** 上班准入判定（对齐旧项目 checkClockInTime） */
  private async computeClockInAdmission(
    shift: { isRest?: boolean; startTime: string; isNextDay?: boolean } | null,
    alreadyClockedIn: boolean,
    now: Date,
    workDate: Date,
  ): Promise<{ allowed: boolean; message: string }> {
    if (shift?.isRest) return { allowed: false, message: '今日为休息日，无需打卡' };
    if (!shift || !shift.startTime) return { allowed: false, message: '请先排班后再打卡' };
    if (alreadyClockedIn) return { allowed: false, message: '今天已经打过上班卡了' };

    const advance = await this.resolveEarlyClockInMinutes();
    // 开始时间固定落在业务日当天
    const shiftStart = beijingDateTime(workDate, shift.startTime);
    const earliest = new Date(shiftStart.getTime() - advance * 60 * 1000);
    if (now.getTime() < earliest.getTime()) {
      return { allowed: false, message: `需在上班前${advance}分钟内打卡` };
    }
    return { allowed: true, message: '' };
  }

  /** 下班准入判定（对齐旧项目 checkClockOutTime） */
  private async computeClockOutAdmission(
    shift: { isRest?: boolean; endTime: string; isNextDay?: boolean; useGlobalThreshold?: boolean; earlyThreshold?: number } | null,
    hasClockedIn: boolean,
    alreadyClockedOut: boolean,
    now: Date,
    workDate: Date,
  ): Promise<{ allowed: boolean; message: string }> {
    if (shift?.isRest) return { allowed: false, message: '今日为休息日' };
    if (!shift || !shift.endTime) return { allowed: false, message: '暂无排班' };
    if (!hasClockedIn) return { allowed: false, message: '请先打上班卡' };
    if (alreadyClockedOut) return { allowed: false, message: '今天已经打过下班卡了' };

    const earlyThreshold = await this.resolveEarlyThreshold(shift);
    // 结束时间才跨天
    const shiftEnd = beijingDateTime(workDate, shift.endTime, shift.isNextDay ? 1 : 0);
    const earliest = new Date(shiftEnd.getTime() - earlyThreshold * 60 * 1000);
    if (now.getTime() < earliest.getTime()) {
      const diffMin = Math.ceil((earliest.getTime() - now.getTime()) / 60000);
      return {
        allowed: false,
        message:
          earlyThreshold > 0
            ? `需在下班前${earlyThreshold}分钟内才允许签退`
            : `尚未到达下班时间，还需等待 ${diffMin} 分钟`,
      };
    }
    return { allowed: true, message: '' };
  }

  /** 北京时间的「今日业务日」，以 UTC 午夜表示（与 workDate 存储口径一致） */
  private businessDate(now: Date = new Date()): Date {
    return beijingBusinessDate(now);
  }

  /**
   * 解析本次操作归属的「业务日 + 排班」。
   *
   * 默认取北京时间的今日业务日。但如果「昨日的跨天班次（isNextDay）此刻尚未结束、
   * 或刚结束不久（宽限窗口内）」，且昨日的打卡记录已上班未下班、或今日根本无排班，
   * 则回退到昨日 —— 夜班员工在次日凌晨签退/补签到时仍应落到班次开始那天，
   * 否则会查不到记录而被误判为「请先打上班卡」。
   */
  private async resolveBusinessContext(
    employeeId: number,
    now: Date = new Date(),
  ): Promise<{ workDate: Date; schedule: any | null }> {
    const today = this.businessDate(now);
    const prevDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const prevSchedule = await this.prisma.schedule.findFirst({
      where: { employeeId, workDate: prevDate },
      include: { shift: true },
    });
    if (prevSchedule?.shift?.isNextDay && prevSchedule.shift.endTime) {
      const shiftEnd = beijingDateTime(prevDate, prevSchedule.shift.endTime, 1);
      // 结束时刻之后仍需留出宽限窗口，否则「22:00~06:00」的夜班只有 06:00 前
      // 那一小段能签退，06:01 签退就会被判成「今天没打上班卡」。
      const fallbackUntil = new Date(
        shiftEnd.getTime() + this.NIGHT_FALLBACK_GRACE_HOURS * 60 * 60 * 1000,
      );
      if (now.getTime() <= fallbackUntil.getTime()) {
        const prevRecord = await this.prisma.attendanceDaily.findUnique({
          where: { employeeId_workDate: { employeeId, workDate: prevDate } },
          select: { firstPunch: true, lastPunch: true },
        });
        // 仅当昨日「已上班未下班」时才回退到昨日业务日。
        // 旧实现附带 `|| !todaySchedule` 条件：当昨日已下班且今日无排班时也会回退到昨日，
        // 导致 clockOut 查到昨日 lastPunch 已有值而误报「今天已经打过下班卡了」。
        // 今日无排班时应让今日逻辑处理（clockIn 抛「请先排班后再打卡」、clockOut 抛「请先打上班卡」），
        // 而不是错误地复用昨日已闭合的打卡记录。
        if (prevRecord?.firstPunch && !prevRecord.lastPunch) {
          return { workDate: prevDate, schedule: prevSchedule };
        }
      }
    }

    const schedule = await this.prisma.schedule.findFirst({
      where: { employeeId, workDate: today },
      include: { shift: true },
    });
    return { workDate: today, schedule };
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
    useGlobalThreshold?: boolean;
    earlyThreshold?: number;
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

  /** 提前打卡窗口（分钟）：读 SystemSetting attendance.early_clock_in_minutes，默认 60 */
  private async resolveEarlyClockInMinutes(): Promise<number> {
    const now = Date.now();
    if (this.earlyClockInCache && this.earlyClockInCache.expiresAt > now) {
      return this.earlyClockInCache.value;
    }
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'attendance.early_clock_in_minutes' },
    });
    const value = setting ? Number(setting.value) : 60;
    this.earlyClockInCache = { value, expiresAt: now + this.CACHE_TTL };
    return value;
  }
}
