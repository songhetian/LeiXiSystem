/**
 * 排班校验纯函数：在批量落地排班/模板应用前做静态预检。
 * 不触碰副作用，可独立单测。校验项：
 *  - scheduleDate：格式 YYYY-MM-DD 且为真实存在的日期（含闰年、大小月）
 *  - shiftId：非休息日时，若指定了班次，须出现在 knownShiftIds 集合中
 *  - 一人一天预检：同一 userId+scheduleDate 重复时标记冲突，供前端覆盖确认
 */

export interface ScheduleValidationRow {
  userId: number;
  shiftId: number | null;
  scheduleDate: string;
  isRestDay: boolean;
  departmentId: number;
}

export interface ScheduleValidationIssue {
  /** 对应输入行的下标；行级问题均带具体 index */
  index: number;
  /** 问题字段：scheduleDate / shiftId / duplicateUserDate */
  field: 'scheduleDate' | 'shiftId' | 'duplicateUserDate';
  message: string;
}

export interface ScheduleValidationResult {
  valid: boolean;
  issues: ScheduleValidationIssue[];
}

/** 校验字符串是否为合法日历日期（YYYY-MM-DD，真实存在） */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [year, mon, day] = s.split('-').map(Number);
  const y = year!;
  const m = mon!;
  const d = day!;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * 预检排班行集合。
 * @param rows             待落地排班（已按用户作用域过滤，含冗余 departmentId）
 * @param knownShiftIds    当前作用域内合法的班次 id 集合
 */
export function validateScheduleRows(
  rows: ScheduleValidationRow[],
  knownShiftIds: number[],
): ScheduleValidationResult {
  const set = new Set<number>(knownShiftIds);
  const issues: ScheduleValidationIssue[] = [];

  // 一人一天预检：同 userId+date 的第二次出现记为冲突
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    if (!isValidDate(row.scheduleDate)) {
      issues.push({
        index: i,
        field: 'scheduleDate',
        message: `第 ${i + 1} 条日期「${row.scheduleDate}」非法`,
      });
    }

    if (!row.isRestDay && row.shiftId != null && !set.has(row.shiftId)) {
      issues.push({
        index: i,
        field: 'shiftId',
        message: `第 ${i + 1} 条引用的班次不存在（shiftId=${row.shiftId}）`,
      });
    }

    const key = `${row.userId}_${row.scheduleDate}`;
    if (seen.has(key)) {
      issues.push({
        index: i,
        field: 'duplicateUserDate',
        message: `员工 ${row.userId} 在 ${row.scheduleDate} 有重复排班（第 ${i + 1} 条）`,
      });
    } else {
      seen.add(key);
    }
  }

  return { valid: issues.length === 0, issues };
}