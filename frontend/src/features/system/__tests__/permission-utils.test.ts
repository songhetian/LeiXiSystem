import { groupPermissionsByModule, moduleLabel } from '@/features/system/permission-utils';

const perms = [
  { id: 1, code: 'hr:view', name: '查看', module: 'hr', type: 'view' },
  { id: 2, code: 'hr:edit', name: '编辑', module: 'hr', type: 'edit' },
  { id: 3, code: 'pay:view', name: '查看', module: 'pay', type: 'view' },
];

describe('groupPermissionsByModule', () => {
  it('按 module 分组', () => {
    const grouped = groupPermissionsByModule(perms);
    expect(Object.keys(grouped).sort()).toEqual(['hr', 'pay']);
    expect(grouped.hr).toHaveLength(2);
    expect(grouped.pay).toHaveLength(1);
  });

  it('空数组返回空对象', () => {
    expect(groupPermissionsByModule([])).toEqual({});
  });
});

describe('moduleLabel', () => {
  it('已知模块映射为中文名', () => {
    expect(moduleLabel('attendance')).toBe('考勤管理');
    expect(moduleLabel('system')).toBe('系统管理');
    expect(moduleLabel('payroll')).toBe('薪酬管理');
    expect(moduleLabel('personal')).toBe('个人中心');
    expect(moduleLabel('employee')).toBe('人事管理');
  });

  it('未知模块回退为原值', () => {
    expect(moduleLabel('unknown')).toBe('unknown');
  });
});