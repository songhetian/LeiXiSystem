const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, '0');
import { formatDate } from '@/lib/format';

/**
 * 归一日历日期为 `YYYY-MM-DD`，容忍后端返回的完整 datetime 串
 * （如 `2026-08-10T00:00:00.000Z`）；空值或无法解析时返回空串。
 */
export function toDateOnly(s?: string): string {
  if (!s) return '';
  const t = formatDate(s);
  if (DATE_RE.test(t)) return t;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 将一条请假的起止日期展开为逐日 `${employeeId}_${YYYY-MM-DD}` 键列表，
 * 供排班日历按 `员工_日期` 匹配请假标记。兼容 datetime 串输入。
 */
export function leaveDateKeys(
  employeeId: number,
  startDate?: string,
  endDate?: string,
): string[] {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (!start || !end || start > end) return [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  const keys: string[] = [];
  while (cur.getTime() <= last.getTime()) {
    keys.push(`${employeeId}_${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}