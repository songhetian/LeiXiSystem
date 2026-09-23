import { describe, it, expect } from 'vitest';
import { buildScope, collectSubtreeIds, scopeIncludes, type DepartmentNode } from './department-scope';

const TREE: DepartmentNode[] = [
  { id: 1, parentId: null }, // 总部
  { id: 2, parentId: 1 }, // 研发部
  { id: 3, parentId: 2 }, // 前端组
  { id: 4, parentId: 2 }, // 后端组
  { id: 5, parentId: 4 }, // 平台组
  { id: 6, parentId: 1 }, // 市场部
];

describe('collectSubtreeIds（本部门+下属部门，含自身）', () => {
  it('根部门返回整棵树（含自己）', () => {
    expect(collectSubtreeIds(1, TREE).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('叶子部门只返回自己', () => {
    expect(collectSubtreeIds(3, TREE)).toEqual([3]);
  });

  it('中间部门包含自己及其所有子孙', () => {
    expect(collectSubtreeIds(2, TREE).sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
  });

  it('不存在的部门 id 至少返回自己', () => {
    expect(collectSubtreeIds(999, TREE)).toEqual([999]);
  });
});

describe('buildScope（依据用户部门解析作用域）', () => {
  it('无部门归属 → 放开全部 all', () => {
    expect(buildScope(null, TREE)).toEqual({ kind: 'all' });
  });

  it('有部门 → subtree 本部门+下属', () => {
    expect(buildScope(2, TREE)).toEqual({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
  });

  it('空树 → subtree 仅本部门', () => {
    expect(buildScope(2, [])).toEqual({ kind: 'subtree', departmentIds: [2] });
  });
});

describe('scopeIncludes（业务数据部门是否落在作用域内）', () => {
  const scope = buildScope(2, TREE); // [2,3,4,5]

  it('subtree 命中本部门/下属 → true', () => {
    expect(scopeIncludes(scope, 2)).toBe(true);
    expect(scopeIncludes(scope, 5)).toBe(true);
  });

  it('subtree 命中作用域外部门 → false', () => {
    expect(scopeIncludes(scope, 6)).toBe(false);
  });

  it('all 作用域恒真', () => {
    expect(scopeIncludes({ kind: 'all' }, 1)).toBe(true);
    expect(scopeIncludes({ kind: 'all' }, 999)).toBe(true);
  });
});