/**
 * 统一的时间 / 日期格式化工具。
 * 全项目展示日期一律从这里取，避免各页面手写 `slice(0,10)` / `toISOString`
 * 导致时区偏移或 ISO 原始串（如 `2026-09-01T00:00:00.000Z`）泄漏到界面上。
 *
 * 约定：空值返回 '-'；可解析的 ISO / Date / 时间戳统一转【北京时间（Asia/Shanghai）】后按 pattern 输出。
 * 注意：与宿主机/浏览器时区无关，恒以东八区渲染，避免部署在非北京时区机器上整体偏移 8 小时。
 */

/** 展示时区固定为北京时间（东八区） */
const DISPLAY_TZ = 'Asia/Shanghai';

/** 安全地把任意值解析为 Date，无法解析时返回 null */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * 取出 Date 在指定时区下的 年/月/日/时/分/秒 分量。
 * 用 Intl.DateTimeFormat 保证不依赖宿主机时区，恒定输出目标时区（北京时间）。
 */
export function getTzParts(d: Date, tz: string = DISPLAY_TZ): { Y: string; M: string; D: string; HH: string; mm: string; ss: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const { type, value } of parts) {
    if (type !== 'literal') map[type] = value;
  }
  return {
    Y: map.year,
    M: map.month,
    D: map.day,
    HH: map.hour,
    mm: map.minute,
    ss: map.second,
  };
}

export type DatePattern = 'YYYY-MM-DD' | 'YYYY-MM-DD HH:mm' | 'YYYY-MM-DD HH:mm:ss' | 'YYYY-MM' | 'MM-DD' | 'HH:mm' | string;

/**
 * 格式化日期。空值返回 fallback（默认 '-'）。
 * @example formatDate('2026-09-01T00:00:00.000Z')            // '2026-09-01'
 * @example formatDate('2026-09-01T08:30:00.000Z', 'YYYY-MM-DD HH:mm') // '2026-09-01 16:30'
 */
export function formatDate(value: unknown, pattern: DatePattern = 'YYYY-MM-DD', fallback = '-'): string {
  const d = toDate(value);
  if (!d) return fallback;
  const { Y, M, D, HH, mm, ss } = getTzParts(d);
  return pattern
    .replace('YYYY', Y)
    .replaceAll('MM', M)
    .replaceAll('DD', D)
    .replaceAll('HH', HH)
    .replaceAll('mm', mm)
    .replaceAll('ss', ss);
}

/** 日期 + 时间 */
export function formatDateTime(value: unknown, fallback = '-'): string {
  return formatDate(value, 'YYYY-MM-DD HH:mm', fallback);
}

/** 日期范围：`开始 ~ 结束` */
export function formatDateRange(start: unknown, end: unknown, fallback = '-'): string {
  const s = formatDate(start, 'YYYY-MM-DD', '');
  const e = formatDate(end, 'YYYY-MM-DD', '');
  if (!s && !e) return fallback;
  if (!s) return e;
  if (!e) return s;
  return `${s} ~ ${e}`;
}

/** 今天（本地时区）的 `YYYY-MM-DD`，用于导出文件名等 */
export function todayStr(): string {
  return formatDate(new Date(), 'YYYY-MM-DD', '');
}

/**
 * 统一的金额格式化：千分位 + 固定两位小数。
 * 金额展示一律从这里取，避免各页面手写 `toFixed(2)` / `toLocaleString` ——
 * 不用 toLocaleString 是为了规避 Node(jest) 与浏览器 ICU 差异导致的展示不一致。
 * @example formatMoney(50000)          // '50,000.00'
 * @example formatMoney(-1234.5)        // '-1,234.50'
 * @example formatMoney(null, '--')     // '--'
 */
export function formatMoney(value: unknown, fallback = '--'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  const fixed = Math.abs(n).toFixed(2);
  const [int, dec] = fixed.split('.');
  const body = `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${dec}`;
  return n < 0 ? `-${body}` : body;
}