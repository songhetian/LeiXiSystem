import { formatDate, formatDateTime, formatDateRange, todayStr } from '@/lib/format';

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