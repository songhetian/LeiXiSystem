import { AttendanceDailyStatus, Prisma } from '@prisma/client';

/** 判定当日状态所需的最小字段集（AttendanceDaily 的裁剪视图 + 日历/补卡上下文） */
export interface DailyStatusInput {
  punchCount: number;
  lateMinutes: number;
  earlyMinutes: number;
  absentMinutes: number;
  leaveDays: Prisma.Decimal;
  /**
   * 是否整天请假。缺省时按 `leaveDays >= 1` 判定 —— 与日报生成同口径，
   * 保证「半天假不改变当天状态（不会把迟到洗成请假）」在两条路径上一致。
   */
  fullDayLeave?: boolean;
  /** 日历：当天为休息日（周末，或日历登记的 rest / 调休放假） */
  isWeekend?: boolean;
  /** 日历：当天为法定节假日 */
  isHoliday?: boolean;
  /** 当天已通过的补卡数 */
  makeupCount?: number;
}

/**
 * 由考勤明细推出当日状态 —— **全仓唯一口径**。
 *
 * 调用方：
 *  - 日报生成（attendance-daily.service → mergeLeaveMakeupIntoDaily 委托本函数）
 *  - 考勤审批监听器（补卡通过/撤回/驳回后重算）
 *  - 员工事务服务（考勤申诉通过后重算）
 *
 * 此前有两条语义不同的写入路径：生成侧认识 makeup/weekend/holiday 且会覆盖 absent，
 * 重算侧只认打卡推算 —— 于是周末行经重算会被洗成 absent，推高月报 absentDays，
 * 最终让算薪按缺勤多扣。现在覆盖类状态并入本函数，两条路径按构造一致。
 *
 * 优先级（与日报生成完全一致）：法定 > 休息日 > 整天请假 > 补卡 > 打卡推算。
 *
 * 注意 `absentMinutes`：引擎 upsert 从不写正值，故它一旦为 0 并不能推出「人到了」，
 * 缺勤只能由 `punchCount` 反推。
 */
export function resolveDailyStatus(daily: DailyStatusInput): AttendanceDailyStatus {
  if (daily.isHoliday) return AttendanceDailyStatus.holiday;
  if (daily.isWeekend) return AttendanceDailyStatus.weekend;

  const fullDayLeave = daily.fullDayLeave ?? isFullDayLeave(daily.leaveDays);
  if (fullDayLeave) return AttendanceDailyStatus.leave;

  if (daily.makeupCount && daily.makeupCount > 0) return AttendanceDailyStatus.makeup;

  if (daily.absentMinutes && daily.absentMinutes > 0) return AttendanceDailyStatus.absent;
  // 撤回/驳回补卡后打卡次数会归零，而 absent_minutes 全库无人写正值
  // （引擎 upsert 不写该列），故缺勤只能由 punchCount 推导，否则会被洗成 normal。
  if (!daily.punchCount || daily.punchCount <= 0) return AttendanceDailyStatus.absent;
  // 与引擎 buildDaily 同口径：单日打卡 > 4 次视为异常
  if (daily.punchCount > 4) return AttendanceDailyStatus.abnormal;
  const hasLate = daily.lateMinutes > 0;
  const hasEarly = daily.earlyMinutes > 0;
  if (hasLate && hasEarly) return AttendanceDailyStatus.late_early;
  if (hasLate) return AttendanceDailyStatus.late;
  if (hasEarly) return AttendanceDailyStatus.early;
  return AttendanceDailyStatus.normal;
}

/** 整天请假判定：请假按天累计，≥ 1 天即整天（半天假不改变当天状态） */
export function isFullDayLeave(leaveDays: Prisma.Decimal | null | undefined): boolean {
  return !!leaveDays && leaveDays.gte(1);
}
