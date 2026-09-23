/** 考勤异常检测纯函数：输入某员工某日的排班/打卡/阈值，输出异常候选。
 *  判定依据：仅排班（无排班、休息日不判定）。与接下来要落库的 AttendanceException 类型对齐。
 */

export type ExceptionType = 'late' | 'early_leave' | 'missing_punch' | 'absent';

export interface DayDetectionInput {
  date: string; // YYYY-MM-DD
  userId: number;
  departmentId: number;
  userName: string;
  departmentName: string;
  startTime: string | null; // 排班预期上班 HH:mm；null=无排班
  endTime: string | null; // 排班预期下班 HH:mm；null=无排班
  isRestDay: boolean; // 休息日（或个人置休）
  checkIn: string | null; // 实际签到 HH:mm
  checkOut: string | null; // 实际签退 HH:mm
  lateMinutes: number; // 迟到判定阈值（分钟）：checkIn 晚于 start+threshold 才判迟到
  earlyLeaveMinutes: number; // 早退判定阈值（分钟）：checkOut 早于 end-threshold 才判早退
}

export interface ExceptionCandidate {
  type: ExceptionType;
  date: string;
  userId: number;
  departmentId: number;
  userName: string;
  departmentName: string;
  minutes: number | null; // 迟到/早退为分钟差；缺卡/缺勤为 null
}

/** "HH:mm" → 当天分钟数 */
function toMinutes(hm: string): number {
  const [h = '0', m = '0'] = hm.split(':');
  return Number(h) * 60 + Number(m);
}

/** 单日异常判定：仅排班日判定；休息日/无排班 → 空。返回按 迟到→早退→缺卡→缺勤 排序的候选。 */
export function detectDayExceptions(input: DayDetectionInput): ExceptionCandidate[] {
  // 无排班或休息日：不判定
  if (input.isRestDay || input.startTime == null || input.endTime == null) return [];

  const startMin = toMinutes(input.startTime);
  const endMin = toMinutes(input.endTime);
  const hasIn = input.checkIn != null && input.checkIn.length > 0;
  const hasOut = input.checkOut != null && input.checkOut.length > 0;

  // 完全无打卡 → 缺勤
  if (!hasIn && !hasOut) {
    return [candidate('absent', input, null)];
  }

  const out: ExceptionCandidate[] = [];

  if (hasIn) {
    const late = toMinutes(input.checkIn!) - startMin - input.lateMinutes;
    if (late > 0) out.push(candidate('late', input, late));
  }
  if (hasOut) {
    const early = endMin - input.earlyLeaveMinutes - toMinutes(input.checkOut!);
    if (early > 0) out.push(candidate('early_leave', input, early));
  }

  // 有且仅有一个打卡 → 缺卡
  if (hasIn !== hasOut) out.push(candidate('missing_punch', input, null));

  return out;
}

function candidate(type: ExceptionType, input: DayDetectionInput, minutes: number | null): ExceptionCandidate {
  return {
    type,
    date: input.date,
    userId: input.userId,
    departmentId: input.departmentId,
    userName: input.userName,
    departmentName: input.departmentName,
    minutes,
  };
}