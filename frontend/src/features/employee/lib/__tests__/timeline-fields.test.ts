import { buildTimelineSearchFields } from '../timeline-fields';

const departments = [
  { id: 1, name: '研发部' },
  { id: 2, name: '人事部' },
];

describe('buildTimelineSearchFields - 人员履历搜索字段', () => {
  it('包含「部门」下拉字段，选项来自部门参考数据', () => {
    const fields = buildTimelineSearchFields(departments);
    const dept = fields.find((f) => f.key === 'departmentId');
    expect(dept).toBeDefined();
    expect(dept!.type).toBe('select');
    expect(dept!.options).toEqual([
      { value: 1, label: '研发部' },
      { value: 2, label: '人事部' },
    ]);
  });

  it('部门为空时仍透出该字段且无选项，避免搜索栏少一列', () => {
    const fields = buildTimelineSearchFields([]);
    const dept = fields.find((f) => f.key === 'departmentId');
    expect(dept).toBeDefined();
    expect(dept!.options).toEqual([]);
  });

  it('字段顺序为 关键字 → 部门 → 变动类型 → 变动日期', () => {
    expect(buildTimelineSearchFields([]).map((f) => f.key)).toEqual([
      'keyword',
      'departmentId',
      'type',
      'range',
    ]);
  });

  it('变动日期字段为范围选择，不再带快捷预设（避免按钮挤占搜索框）', () => {
    const range = buildTimelineSearchFields([]).find((f) => f.key === 'range');
    expect(range!.type).toBe('range');
    expect(range!.presets).toBeUndefined();
  });
});