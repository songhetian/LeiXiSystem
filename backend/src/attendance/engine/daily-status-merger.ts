import type { DailyResult as BaseDailyResult } from './attendance-engine';

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

export function mergeLeaveMakeupIntoDaily(
  base: BaseDailyResult,
  leaves: LeaveRecordInput[],
  makeups: MakeupRecordInput[],
  options: MergeOptions = {},
): DailyResult {
  const approvedLeaves = leaves.filter((l) => l.status === 'approved');
  const leaveDays = approvedLeaves.reduce((sum, l) => sum + l.days, 0);
  const hasFullDayLeave = approvedLeaves.some((l) => l.isFullDay) || leaveDays >= 1;

  const approvedMakeups = makeups.filter((m) => m.status === 'approved');
  const makeupCount = approvedMakeups.length;

  let status: DailyStatus = base.status as DailyStatus;

  if (approvedMakeups.length > 0) {
    status = 'makeup';
  }

  if (hasFullDayLeave) {
    status = 'leave';
  }

  if (options.isWeekend) {
    status = 'weekend';
  }

  if (options.isHoliday) {
    status = 'holiday';
  }

  return {
    ...base,
    status,
    leaveDays,
    makeupCount,
  };
}
