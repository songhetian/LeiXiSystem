import { Prisma } from '@prisma/client';
import type { DailyResult as BaseDailyResult } from './attendance-engine';
import { isFullDayLeave, resolveDailyStatus } from '../daily-status';

export type DailyStatus =
  | 'normal'
  | 'late'
  | 'early'
  | 'late_early'
  | 'abnormal'
  | 'absent'
  | 'half_absent'
  | 'makeup'
  | 'holiday'
  | 'leave'
  | 'weekend';

export interface DailyResult extends Omit<BaseDailyResult, 'status'> {
  status: DailyStatus;
  leaveDays: number;
  fullDayLeave: boolean;
  makeupCount: number;
}

export interface LeaveRecordInput {
  status: 'pending' | 'approved' | 'rejected';
  days: number;
  isFullDay: boolean;
}

export interface MakeupRecordInput {
  status: 'pending' | 'approved' | 'rejected';
  punchTime: string;
}

export interface MergeOptions {
  isHoliday?: boolean;
  isWeekend?: boolean;
}

/**
 * 把请假/补卡/日历并入引擎产出的基础日报。
 *
 * **状态一律委托 `resolveDailyStatus`** —— 这是全仓唯一口径。此前的实现自己在
 * 这里又写了一套 if 链（makeup → leave → weekend → holiday 顺序覆盖），与重算路径
 * `resolveDailyStatus` 不同步，导致同一行经两条路径得出不同 status（P1-4）。
 * 现在两路径按构造一致，无法再漂移。
 */
export function mergeLeaveMakeupIntoDaily(
  base: BaseDailyResult,
  leaves: LeaveRecordInput[],
  makeups: MakeupRecordInput[],
  options: MergeOptions = {},
): DailyResult {
  const approvedLeaves = leaves.filter((l) => l.status === 'approved');
  const leaveDays = approvedLeaves.reduce((sum, l) => sum + l.days, 0);
  const leaveDecimal = new Prisma.Decimal(leaveDays);
  const fullDayLeave = isFullDayLeave(leaveDecimal);

  const makeupCount = makeups.filter((m) => m.status === 'approved').length;

  const status = resolveDailyStatus({
    punchCount: base.punchCount,
    lateMinutes: base.lateMinutes,
    earlyMinutes: base.earlyMinutes,
    // 引擎 upsert 从不写正值缺勤分钟，故恒为 0（缺勤由 punchCount 反推）
    absentMinutes: 0,
    leaveDays: leaveDecimal,
    fullDayLeave,
    isWeekend: options.isWeekend,
    isHoliday: options.isHoliday,
    makeupCount,
  }) as DailyStatus;

  return {
    ...base,
    status,
    leaveDays,
    fullDayLeave,
    makeupCount,
  };
}
