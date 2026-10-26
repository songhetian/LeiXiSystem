import { formatDate, formatDateTime, formatDateRange, todayStr, formatMoney } from '@/lib/format';

/**
 * 固定测试进程时区为 UTC，用来暴露「依赖本机时区」的格式化缺陷。
 * 定位：本工具必须始终按北京时间（Asia/Shanghai）输出，与宿主机时区无关。
 */
let originalTZ: string | undefined;
beforeAll(() => {
  originalTZ = process.env.TZ;
  process.env.TZ = 'UTC';
});
afterAll(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe('formatDate', () => {
  it('把超长 ISO 串规整为 YYYY-MM-DD（北京时间）', () => {
    // 2026-09-01T00:00:00.000Z（UTC 午夜，东八区同一自然日）
    expect(formatDate('2026-09-01T00:00:00.000Z')).toBe('2026-09-01');
  });

  it('空值返回占位符，默认 -', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('')).toBe('-');
  });

  it('已裁剪的日期串同样规整输出，不重复叠加', () => {
    expect(formatDate('2026-09-01')).toBe('2026-09-01');
  });

  it('北京时间跨日边界：UTC 深夜应显示为第二天（东八区）', () => {
    // UTC 2026-09-01 20:30 → 北京时间 2026-09-02 04:30
    expect(formatDate('2026-09-01T20:30:00.000Z', 'YYYY-MM-DD HH:mm')).toBe('2026-09-02 04:30');
  });

  it('支持自定义 pattern 与占位符', () => {
    expect(formatDate('2026-09-01T08:30:00.000Z', 'YYYY-MM-DD HH:mm', '暂无')).toBe('2026-09-01 16:30');
    expect(formatDate(null, 'YYYY-MM-DD', '暂无')).toBe('暂无');
  });

  it('无法解析的值返回占位符，不泄漏原文', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });
});

describe('formatDateTime', () => {
  it('输出 YYYY-MM-DD HH:mm', () => {
    expect(formatDateTime('2026-09-01T08:30:00.000Z')).toBe('2026-09-01 16:30');
  });

  it('支持自定义空值占位符（如 -- 用于工单到期时间）', () => {
    expect(formatDateTime(null, '--')).toBe('--');
    expect(formatDateTime(undefined, '--')).toBe('--');
    expect(formatDateTime('', '--')).toBe('--');
  });

  it('不会泄漏 ISO 原始串：UTC 午夜跨日时显示东八区次日', () => {
    // 旧 bug：slice(0,16) 会直接截断 ISO 串输出 2026-09-01 00:00（UTC 视图）
    // 修复后恒按北京时间：UTC 2026-09-01 16:00 → 北京 2026-09-02 00:00
    expect(formatDateTime('2026-09-01T16:00:00.000Z')).toBe('2026-09-02 00:00');
  });
});

describe('formatDateRange', () => {
  it('两端都有返回 开始 ~ 结束', () => {
    expect(formatDateRange('2026-09-01T00:00:00.000Z', '2026-09-05T00:00:00.000Z')).toBe('2026-09-01 ~ 2026-09-05');
  });

  it('单端缺失时回退为另一侧', () => {
    expect(formatDateRange(null, '2026-09-05T00:00:00.000Z')).toBe('2026-09-05');
    expect(formatDateRange('2026-09-01T00:00:00.000Z', null)).toBe('2026-09-01');
  });

  it('全空返回占位符', () => {
    expect(formatDateRange(null, null)).toBe('-');
  });
});

describe('todayStr', () => {
  it('输出今天本地日期 YYYY-MM-DD', () => {
    const d = new Date();
    const expectStr = [
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
    expect(todayStr()).toBe(expectStr);
  });
});

describe('formatMoney', () => {
  it('千分位 + 固定两位小数', () => {
    expect(formatMoney(50000)).toBe('50,000.00');
    expect(formatMoney(1234567.891)).toBe('1,234,567.89');
    expect(formatMoney(0)).toBe('0.00');
  });

  it('负数保留符号', () => {
    expect(formatMoney(-1234.5)).toBe('-1,234.50');
  });

  it('字符串数字按数值处理，非数值返回占位符', () => {
    expect(formatMoney('7200')).toBe('7,200.00');
    expect(formatMoney('abc')).toBe('--');
    expect(formatMoney(null)).toBe('--');
    expect(formatMoney(undefined)).toBe('--');
    expect(formatMoney(Infinity)).toBe('--');
  });
});