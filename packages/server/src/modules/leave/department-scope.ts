/**
 * 部门数据隔离 —— 纯函数 seam：把“当前用户所属部门 + 部门树”解析成数据可见作用域。
 * 无任何 IO，便于单元测试；Prisma 读取由调用方注入，隔离在下沉到 repo 层。
 */

/** 部门树节点（由 DepartmentRepo 提供） */
export interface DepartmentNode {
  id: number;
  parentId: number | null;
}

/** 数据可见作用域：全部 或 本部门+下属部门（树子集） */
export type DepartmentScope =
  | { kind: 'all' } // 无部门归属的用户（如系统管理员账号）：放开全部
  | { kind: 'subtree'; departmentIds: number[] };

/** 从根部门开始收集其全部子孙节点 id（本部门 + 下属部门）。始终包含根部门自身。 */
export function collectSubtreeIds(rootId: number, nodes: DepartmentNode[]): number[] {
  const byParent = new Map<number | null, number[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n.id);
    byParent.set(n.parentId, arr);
  }

  const result = [rootId]; // 本部门
  const queue = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const children = byParent.get(cur) ?? [];
    for (const child of children) {
      result.push(child); // 下属部门
      queue.push(child);
    }
  }
  return result;
}

/** 根据当前用户部门 id 与部门树解析出可见作用域。 */
export function buildScope(userDepartmentId: number | null, nodes: DepartmentNode[]): DepartmentScope {
  if (userDepartmentId == null) return { kind: 'all' };
  return { kind: 'subtree', departmentIds: collectSubtreeIds(userDepartmentId, nodes) };
}

/** 判定某条业务数据（按其部门 id）是否落在给定作用域内：all 恒真，subtree 需命中集合。 */
export function scopeIncludes(scope: DepartmentScope, departmentId: number): boolean {
  if (scope.kind === 'all') return true;
  return scope.departmentIds.includes(departmentId);
}