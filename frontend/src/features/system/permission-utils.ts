import { SysPermission } from '@/services/system';

/** 按模块分组权限点，返回 module -> 权限数组 */
export function groupPermissionsByModule(permissions: SysPermission[]): Record<string, SysPermission[]> {
  return permissions.reduce<Record<string, SysPermission[]>>((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});
}

const ids = (perms: SysPermission[]) => perms.map((p) => p.id);

/** 模块内权限是否全部被选中 */
export function moduleAllChecked(selected: number[], perms: SysPermission[]): boolean {
  if (perms.length === 0) return false;
  return ids(perms).every((id) => selected.includes(id));
}

/** 模块内已选中的权限数量 */
export function moduleSelectedCount(selected: number[], perms: SysPermission[]): number {
  return ids(perms).filter((id) => selected.includes(id)).length;
}

/**
 * 切换一个模块的全选/全不选。
 * checked=true 加入模块全部权限（并集去重）；false 移除模块内权限，保留其他模块。
 */
export function toggleModule(selected: number[], perms: SysPermission[], checked: boolean): number[] {
  const moduleIds = ids(perms);
  if (checked) {
    const set = new Set([...selected, ...moduleIds]);
    return Array.from(set);
  }
  const set = new Set(moduleIds);
  return selected.filter((id) => !set.has(id));
}