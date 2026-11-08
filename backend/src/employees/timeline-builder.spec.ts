import { describe, it, expect } from '@jest/globals';
import { buildTimeline, TimelineInputs, TIMELINE_RECORDS_LIMIT } from './timeline-builder';

const inputs: TimelineInputs = {
  employees: [
    { id: 1, name: '张三', employeeNo: 'E001', status: 'active', hireDate: '2026-01-01', departmentId: 10, department: '研发部' },
    { id: 2, name: '李四', employeeNo: 'E002', status: 'active', hireDate: '2026-02-01', departmentId: 20, department: '人事部' },
  ],
  transfers: [
    { id: 11, employeeId: 1, employeeName: '张三', employeeNo: 'E001', type: 'promotion', effectiveDate: '2026-03-01', departmentId: 10 },
  ],
  resignations: [
    { id: 21, employeeId: 2, employeeName: '李四', employeeNo: 'E002', resignDate: '2026-04-01', departmentId: 20, department: '人事部' },
  ],
};

describe('buildTimeline - 部门过滤', () => {
  it('按 departmentId 只返回该部门员工的事件，其余部门被剔除', () => {
    const res = buildTimeline(inputs, { departmentId: 10 });
    // 张三：入职 + 晋升 两条，均属部门 10
    expect(res.list.map((r) => r.employeeId)).toEqual([1, 1]);
    expect(res.list.map((r) => r.employeeId)).not.toContain(2);
  });

  it('不传 departmentId 时保留全部事件、不过滤', () => {
    const res = buildTimeline(inputs, {});
    expect(res.total).toBeGreaterThanOrEqual(4);
    expect(res.list.some((r) => r.employeeId === 2)).toBe(true);
  });

  it('传入未匹配的 departmentId 时返回空列表', () => {
    const res = buildTimeline(inputs, { departmentId: 999 });
    expect(res.list).toEqual([]);
    expect(res.total).toBe(0);
  });
});
describe('buildTimeline - 概览统计（summary）', () => {
  it('类型筛选只影响记录，不影响类型计数与月度趋势', () => {
    const all = buildTimeline(inputs, {});
    const onlyPromotion = buildTimeline(inputs, { type: 'promotion' });

    // 选中「晋升」后列表只剩 1 条，但各类型计数保持全量口径
    expect(onlyPromotion.total).toBe(1);
    expect(onlyPromotion.summary.counts).toEqual(all.summary.counts);
    expect(onlyPromotion.summary.counts.hire).toBe(2);
    expect(onlyPromotion.summary.counts.promotion).toBe(1);
    expect(onlyPromotion.summary.counts.resign).toBe(1);
    // scopeTotal 是「全部」页签的数字，同样不受类型筛选影响
    expect(onlyPromotion.summary.scopeTotal).toBe(all.summary.scopeTotal);
  });

  it('月度趋势固定返回 12 个月、升序、空月补零，并以数据最新月份为右端', () => {
    const res = buildTimeline(inputs, {});
    const months = res.summary.months;
    expect(months).toHaveLength(12);
    expect(months[months.length - 1].month).toBe('2026-04'); // 最新一条为 2026-04-01 离职
    expect(months[0].month).toBe('2025-05'); // 向前推 11 个月，跨年正确
    expect(months.map((m) => m.month)).toEqual([...months.map((m) => m.month)].sort());

    const byMonth = Object.fromEntries(months.map((m) => [m.month, m]));
    expect(byMonth['2026-01'].counts.hire).toBe(1);
    expect(byMonth['2026-03'].counts.promotion).toBe(1);
    expect(byMonth['2026-04'].counts.resign).toBe(1);
    // 没有数据的月份补齐为 0 而不是缺项（缺项会让趋势图柱数变少、位置错乱）
    expect(byMonth['2025-12'].total).toBe(0);
  });

  it('按员工聚合：一人一条、按最近变动倒序、计数与首末日期正确', () => {
    const res = buildTimeline(inputs, {});
    const groups = res.summary.employees;
    expect(groups.map((g) => g.employeeId)).toEqual([2, 1]); // 李四 2026-04 晚于 张三 2026-03

    const zhangsan = groups.find((g) => g.employeeId === 1)!;
    expect(zhangsan.total).toBe(2);
    expect(zhangsan.counts.hire).toBe(1);
    expect(zhangsan.counts.promotion).toBe(1);
    expect(zhangsan.firstAt).toBe('2026-01-01');
    expect(zhangsan.lastAt).toBe('2026-03-01');
  });

  it('按员工聚合跟随类型筛选：只保留命中该类型的员工', () => {
    const res = buildTimeline(inputs, { type: 'resign' });
    expect(res.summary.employees.map((g) => g.employeeId)).toEqual([2]);
    expect(res.summary.employees[0].counts.resign).toBe(1);
    // 李四的入职记录不属于「离职」，聚合计数只算命中的那条
    expect(res.summary.employees[0].total).toBe(1);
  });

  it('records 为当前筛选下的全量记录（不受分页影响），时间倒序', () => {
    const res = buildTimeline(inputs, { page: 2, pageSize: 1 });
    expect(res.list).toHaveLength(1);
    expect(res.summary.records).toHaveLength(res.summary.total);
    expect(res.summary.records.map((r) => r.occurredAt)).toEqual(['2026-04-01', '2026-03-01', '2026-02-01', '2026-01-01']);
    expect(res.summary.truncated).toBe(false);
  });

  it('记录数超过上限时 records 截断并置 truncated，分页 total 仍是真实总数', () => {
    const many: TimelineInputs = {
      employees: Array.from({ length: TIMELINE_RECORDS_LIMIT + 5 }, (_, i) => ({
        id: i + 1,
        name: `员工${i + 1}`,
        employeeNo: `E${i + 1}`,
        status: 'active',
        hireDate: '2026-01-05',
        departmentId: 10,
      })),
      transfers: [],
      resignations: [],
    };
    const res = buildTimeline(many, {});
    expect(res.total).toBe(TIMELINE_RECORDS_LIMIT + 5);
    expect(res.summary.records).toHaveLength(TIMELINE_RECORDS_LIMIT);
    expect(res.summary.truncated).toBe(true);
  });
});
