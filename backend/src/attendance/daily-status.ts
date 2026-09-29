import { AttendanceDailyStatus, Prisma } from '@prisma/client';

/** 判定当日状态所需的最小字段集（AttendanceDaily 的裁剪视图） */
export interface DailyStatusInput {
  punchCount: number;
  lateMinutes: number;
  earlyMinutes: number;
  absentMinutes: number;
  leaveDays: Prisma.Decimal;
}

/**
 * 由考勤明细推出当日状态 —— **全仓唯一口径**。
 *
 * 调用方：考勤审批监听器（补卡撤回/驳回后重算）、员工事务服务（考勤申诉通过后重算）。
 * 两处写入的都是同一列 `attendance_daily.status`，因此必须共用本实现；此前各写一份，
 * 员工事务侧缺了「打卡次数为 0 → 缺勤」「打卡 > 4 次 → 异常」两条，会把缺勤日洗成 normal。
 *
 * 注意 `absentMinutes`：引擎 upsert 从不写正值，故它一旦为 0 并不能推出「人到了」，
 * 缺勤只能由 `punchCount` 反推。
 */
export function resolveDailyStatus(daily: DailyStatusInput): AttendanceDailyStatus {
  if (daily.leaveDays && daily.leaveDays.gt(0)) return AttendanceDailyStatus.leave;
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
