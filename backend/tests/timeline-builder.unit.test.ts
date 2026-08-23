import {
  buildTimeline,
  type TimelineInputs,
} from '../src/employees/timeline-builder';

const inputs: TimelineInputs = {
  employees: [
    { id: 1, name: '张三', employeeNo: 'E001', status: 'active', hireDate: '2023-03-01', department: '人事部', position: '专员' },
    { id: 2, name: '李四', employeeNo: 'E002', status: 'left', hireDate: '2021-06-15', resignDate: '2024-01-20', department: '技术部', position: '工程师' },
  ],
  transfers: [
    { id: 10, employeeId: 1, employeeName: '张三', employeeNo: 'E001', type: 'promotion', effectiveDate: '2024-05-10', fromText: '专员', toText: '主管', reason: '表现优异' },
    { id: 11, employeeId: 1, employeeName: '张三', employeeNo: 'E001', type: 'transfer', effectiveDate: '2025-02-01', fromText: '人事部', toText: '行政部', reason: '部门调整' },
  ],
  resignations: [
    { id: 20, employeeId: 2, employeeName: '李四', employeeNo: 'E002', resignDate: '2024-01-20', reason: '个人原因', department: '技术部' },
  ],
};

describe('buildTimeline', () => {
  it('聚合入职/调动/晋升/离职为统一履历流', () => {
    const { list, total } = buildTimeline(inputs, {});
    expect(total).toBe(5);
    const types = list.map((r) => r.type);
    expect(types).toContain('hire');
    expect(types).toContain('promotion');
    expect(types).toContain('transfer');
    expect(types).toContain('resign');
  });

  it('按发生日期倒序排列', () => {
    const { list } = buildTimeline(inputs, {});
    const dates = list.map((r) => r.occurredAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('hire 记录以员工入职日期为发生时间，含部门职位', () => {
    const { list } = buildTimeline(inputs, { keyword: 'E001' });
    const hire = list.find((r) => r.type === 'hire');
    expect(hire).toBeTruthy();
    expect(hire!.occurredAt).toBe('2023-03-01');
    expect(hire!.toText).toBe('人事部 · 专员');
  });

  it('promotion/transfer 详情体现 from → to', () => {
    const { list } = buildTimeline(inputs, {});
    const promotion = list.find((r) => r.id === 'promotion-10');
    expect(promotion!.detailText).toBe('专员 → 主管');
    const transfer = list.find((r) => r.id === 'transfer-11');
    expect(transfer!.detailText).toBe('人事部 → 行政部');
  });

  it('resign 记录含离职日期与原因', () => {
    const { list } = buildTimeline(inputs, {});
    const resign = list.find((r) => r.type === 'resign');
    expect(resign).toBeTruthy();
    expect(resign!.occurredAt).toBe('2024-01-20');
    expect(resign!.reason).toBe('个人原因');
  });

  it('按类型过滤', () => {
    const { list } = buildTimeline(inputs, { type: 'promotion' });
    expect(list).toHaveLength(1);
    expect(list[0].type).toBe('promotion');
  });

  it('按关键字过滤姓名或工号', () => {
    const { list } = buildTimeline(inputs, { keyword: '李四' });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.employeeName.includes('李四') || r.employeeNo.includes('李四'))).toBe(true);
  });

  it('按日期范围过滤', () => {
    const { list } = buildTimeline(inputs, { dateFrom: '2024-01-01', dateTo: '2024-12-31' });
    expect(list.length).toBe(2); // promotion(2024-05-10) + resign(2024-01-20)
    expect(list.every((r) => r.occurredAt >= '2024-01-01' && r.occurredAt <= '2024-12-31')).toBe(true);
  });

  it('按员工锁定履历', () => {
    const { list } = buildTimeline(inputs, { employeeId: 1 });
    expect(list.every((r) => r.employeeId === 1)).toBe(true);
    expect(list.some((r) => r.type === 'hire')).toBe(true);
    expect(list.some((r) => r.type === 'promotion')).toBe(true);
  });

  it('分页生效', () => {
    const { total } = buildTimeline(inputs, {});
    const page2 = buildTimeline(inputs, { page: 1, pageSize: 2 });
    expect(page2.list).toHaveLength(2);
    expect(page2.total).toBe(total);
  });

  it('空输入返回空列表', () => {
    const { list, total } = buildTimeline({ employees: [], transfers: [], resignations: [] }, {});
    expect(list).toHaveLength(0);
    expect(total).toBe(0);
  });
});