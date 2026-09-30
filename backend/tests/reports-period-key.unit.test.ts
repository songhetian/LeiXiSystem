// 报表分组键的时区口径（缺陷 P3-10）
// 入参是**以 UTC 午夜存储**的业务日期（schema 中均为 @db.Date），因此取年月必须用 getUTC*。
// 本地 getter 在负时区会退回上一天/上一月，把「9 月入职」统计进 10 月。
// 本用例在 GMT+8 之外也能判别：2026-09-30T18:00Z 的本地月是 10、UTC 月是 9。
import { describe, it, expect } from '@jest/globals';
import { getPeriodKey } from '../src/reports/period-key';

describe('报表分组键 · UTC 口径（P3-10）', () => {
  it('按月：取 UTC 年月，不受宿主本地时区影响', () => {
    // 北京时间 = 2026-10-01 02:00，UTC 仍是 9 月
    expect(getPeriodKey(new Date('2026-09-30T18:00:00Z'), 'month')).toBe('2026-09');
  });

  it('按年：跨年边界取 UTC 年', () => {
    expect(getPeriodKey(new Date('2026-12-31T20:00:00Z'), 'year')).toBe('2026');
  });

  it('按季度：UTC 月落入正确季度', () => {
    expect(getPeriodKey(new Date('2026-09-30T18:00:00Z'), 'quarter')).toBe('2026-Q3');
    expect(getPeriodKey(new Date('2026-03-31T18:00:00Z'), 'quarter')).toBe('2026-Q1');
  });

  it('真实用法（@db.Date 的 UTC 午夜）→ 与 UTC 年月一致', () => {
    expect(getPeriodKey(new Date('2026-01-31T00:00:00Z'), 'month')).toBe('2026-01');
    expect(getPeriodKey(new Date('2026-12-01T00:00:00Z'), 'month')).toBe('2026-12');
  });
});
