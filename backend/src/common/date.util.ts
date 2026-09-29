export function calculateDateDiff(startDate: Date, endDate: Date): {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalDays: number;
  totalYears: number;
} {
  const start = new Date(startDate);
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const totalDays = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const totalMonths = years * 12 + months;

  const totalYears = years + months / 12 + days / 365.25;

  return {
    years,
    months,
    days,
    totalMonths,
    totalDays,
    totalYears,
  };
}

export function formatTenure(diff: {
  years: number;
  months: number;
  days: number;
}): string {
  const parts: string[] = [];
  if (diff.years > 0) parts.push(`${diff.years}年`);
  if (diff.months > 0) parts.push(`${diff.months}个月`);
  if (diff.days > 0 && diff.years === 0) parts.push(`${diff.days}天`);
  return parts.length > 0 ? parts.join('') : '0天';
}

export function calculateTenure(hireDate: Date, now: Date = new Date()): {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalDays: number;
  totalYears: number;
  formatted: string;
} {
  const diff = calculateDateDiff(hireDate, now);
  return {
    ...diff,
    formatted: formatTenure(diff),
  };
}

export function formatAvgTenure(totalYears: number): string {
  const years = Math.floor(totalYears);
  const remainingMonths = (totalYears - years) * 12;
  const months = Math.round(remainingMonths);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}年`);
  if (months > 0) parts.push(`${months}个月`);
  return parts.length > 0 ? parts.join('') : '0个月';
}

export function isValidDate(date: Date | string): boolean {
  const d = date instanceof Date ? date : new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

export function isStartBeforeEnd(
  startDate: Date | string,
  endDate: Date | string,
): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return start.getTime() <= end.getTime();
}

export function isDateNotTooFarFuture(
  date: Date | string,
  maxYearsAhead: number = 1,
): boolean {
  const d = new Date(date);
  const now = new Date();
  const maxDate = new Date(
    now.getFullYear() + maxYearsAhead,
    now.getMonth(),
    now.getDate(),
  );
  return d.getTime() <= maxDate.getTime();
}

export function isDateNotBeforeHireDate(
  date: Date | string,
  hireDate: Date | string,
): boolean {
  const d = new Date(date);
  const hire = new Date(hireDate);
  d.setHours(0, 0, 0, 0);
  hire.setHours(0, 0, 0, 0);
  return d.getTime() >= hire.getTime();
}

/**
 * 取北京时间（Asia/Shanghai）的年/月/日。
 *
 * 刻意不用 `new Date().getFullYear()` 等本地时区 getter：容器内 TZ 常为 UTC，
 * 在「北京时间 00:00~08:00」这段会退回前一天，导致年度/月份口径错位。
 */
export function beijingNow(now: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

/**
 * 北京时间的「业务日」，以 UTC 午夜表示。
 *
 * 库中 workDate 统一存 UTC 午夜（由 `new Date('YYYY-MM-DD')` 写入），
 * 故业务日必须"先按北京时间取日历日、再转 UTC 午夜"；直接用
 * `new Date()+setHours(0,0,0,0)` 会在 UTC 容器中把北京 00:00~08:00 退回前一天。
 */
export function beijingBusinessDate(now: Date = new Date()): Date {
  const { year, month, day } = beijingNow(now);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * 把「业务日 + 班次时刻(HH:mm)」解析为真实时刻。
 *
 * Asia/Shanghai 恒为 UTC+8（1991 年后无夏令时），故可直接做 UTC 换算；
 * 不能用 `d.setHours(h, m)` —— 那会按服务器本地时区构造，UTC 容器下整体偏 8 小时。
 *
 * @param workDate 业务日（UTC 午夜的 Date）
 * @param timeStr  班次时刻，形如 "09:00"
 * @param addDays  再顺延的天数，用于跨天班次的结束时间（传 1）
 */
export function beijingDateTime(workDate: Date, timeStr: string, addDays = 0): Date {
  const [h, m] = timeStr.split(':').map(Number);
  return new Date(
    Date.UTC(
      workDate.getUTCFullYear(),
      workDate.getUTCMonth(),
      workDate.getUTCDate() + addDays,
      h - 8,
      m,
      0,
      0,
    ),
  );
}

/**
 * 把「无时区墙钟串」按北京时间解析为真实时刻。
 *
 * 前端 `<DatePicker.RangePicker showTime format="YYYY-MM-DD HH:mm">` 回传的是
 * 不带时区的墙钟串（如 `'2026-09-28 18:00'`）。直接 `new Date(str)` 会按
 * **服务器本地时区**解析：UTC 容器下 18:00 被当成 18:00Z，比北京时间早 8 小时，
 * 甚至跨日。这里显式按东八区换算（Asia/Shanghai 恒为 UTC+8）。
 *
 * 已带显式时区（`Z` / `±HH:mm`）的串语义明确，原样交给原生解析，不做二次换算。
 * 非法或溢出（如 2026-02-30、25:00）返回 null。
 */
export function parseBeijingDateTime(value: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // 带显式时区偏移 → 原生解析
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? 0);

  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  // 拒绝日历溢出（2026-02-30 之类）
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return null;

  const date = new Date(
    Date.UTC(year, month - 1, day, hour - 8, minute, second, 0),
  );
  return isNaN(date.getTime()) ? null : date;
}


/**
 * 北京时间的 14 位时间戳（YYYYMMDDHHmmss），用于业务单号。
 *
 * 与 beijingNow 同理：不能用本地时间 getter —— 容器 TZ 为 UTC 时整体偏 8 小时，
 * 跨零点还会落到错误日期。`hourCycle: 'h23'` 避免部分 ICU 下 `hour12:false` 产出 '24'。
 */
export function beijingTimestamp(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}${pick('month')}${pick('day')}${pick('hour')}${pick('minute')}${pick('second')}`;
}

/**
 * 把 `YYYY-MM` 解析为「业务日（UTC 午夜）」表示的左闭右开区间 `[start, end)`。
 *
 * 必须用 `Date.UTC` 构造，不能用 `new Date(y, m - 1, 1)`：后者按**服务器本地时区**
 * 构造，在 GMT+8 主机上区间整体前移 8 小时，`lte 当月最后一天 00:00` 会把当天
 * （UTC 午夜）排除掉，导致月报少算一天。
 */
export function monthRangeUtc(month: string): { start: Date; end: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNum - 1, 1)),
    end: new Date(Date.UTC(year, monthNum, 1)),
  };
}

/**
 * 把真实时刻格式化为北京时间的 'YYYY-MM-DD HH:mm:ss'（导出/落库展示用）。
 *
 * 不能用 `toISOString()`：那输出的是 UTC，比北京时间少 8 小时，
 * 北京时间凌晨的记录还会落到前一天。
 */
export function beijingDateTimeStr(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
}

/**
 * 把前端传回的日期（'YYYY-MM-DD'，忽略其中可能带的时间部分）转为
 * 「北京时间当天」的左闭右开区间，用于过滤真实的 DateTime 列（如 createdAt）。
 *
 * 不能用 `new Date('2026-09-30')`：那是 UTC 午夜 = 北京 08:00，
 * 会让「当天」整体前移 8 小时（漏掉当天凌晨、混入次日凌晨）。
 */
export function beijingDateRangeFilter(
  startDate?: string,
  endDate?: string,
): { gte?: Date; lt?: Date } | undefined {
  if (!startDate && !endDate) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  // 只取日期部分，忽略串里可能带的时间，保证区间始终是整日
  const dayStart = (v: string) => parseBeijingDateTime(`${v.slice(0, 10)} 00:00:00`);
  if (startDate) {
    const start = dayStart(startDate);
    if (start) range.gte = start;
  }
  if (endDate) {
    const end = dayStart(endDate);
    if (end) range.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return range;
}

export function calculateLeaveDays(
  startDate: Date | string,
  endDate: Date | string,
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

/**
 * 在「业务日（UTC 午夜）」上增加 N 个月，并收敛到目标月最后一天。
 *
 * 不能直接用 `d.setMonth(d.getMonth() + n)`：
 * 1) `getMonth/setMonth` 按服务器本地时区取值，UTC 容器下与 UTC 午夜的存储口径不一致；
 * 2) 月末会溢出（1/31 + 1 月 → 3/3），试用期/合同到期日会被算错。
 * 语义与业务口径一致：1/31 加 1 个月 = 2/28（闰年 2/29），9/15 加 3 个月 = 12/15。
 */
export function addMonthsUtc(date: Date | string, months: number): Date {
  const base = date instanceof Date ? date : new Date(date);
  const target = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1),
  );
  // 目标月最后一天 = 「目标月的下个月 0 号」
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      Math.min(base.getUTCDate(), lastDay),
    ),
  );
}
