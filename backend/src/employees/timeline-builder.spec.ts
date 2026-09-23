import { describe, it, expect } from '@jest/globals';
import { buildTimeline, TimelineInputs } from './timeline-builder';

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