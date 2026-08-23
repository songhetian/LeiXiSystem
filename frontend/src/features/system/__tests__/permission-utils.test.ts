import {
  groupPermissionsByModule,
  moduleAllChecked,
  moduleSelectedCount,
  toggleModule,
} from '@/features/system/permission-utils';

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

describe('moduleAllChecked', () => {
  it('模块内权限全部选中返回 true', () => {
    expect(moduleAllChecked([1, 2, 3], perms.slice(0, 2))).toBe(true);
  });

  it('部分选中返回 false', () => {
    expect(moduleAllChecked([1, 3], perms.slice(0, 2))).toBe(false);
  });

  it('模块无权限返回 false', () => {
    expect(moduleAllChecked([], [])).toBe(false);
  });
});

describe('moduleSelectedCount', () => {
  it('统计模块内已选数量', () => {
    expect(moduleSelectedCount([1], perms.slice(0, 2))).toBe(1);
    expect(moduleSelectedCount([1, 2], perms.slice(0, 2))).toBe(2);
  });
});

describe('toggleModule', () => {
  it('勾选模块全选后并集去重', () => {
    const selected = [3];
    const next = toggleModule(selected, perms.slice(0, 2), true);
    expect(next).toEqual([3, 1, 2]);
  });

  it('取消勾选移除模块内权限，保留他模块', () => {
    const selected = [1, 2, 3];
    const next = toggleModule(selected, perms.slice(0, 2), false);
    expect(next).toEqual([3]);
  });

  it('重复执行不产生重复 id', () => {
    const next = toggleModule([1, 2], perms.slice(0, 2), true);
    expect(next).toEqual([1, 2]);
  });
});