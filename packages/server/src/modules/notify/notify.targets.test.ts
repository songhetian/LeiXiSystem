import { describe, it, expect } from 'vitest';
import { resolveTargetRooms } from './notify.targets';

describe('resolveTargetRooms（定向目标→房间映射）', () => {
  it('单 userId → user:{id}', () => {
    expect(resolveTargetRooms({ userId: 1 })).toEqual(['user:1']);
  });

  it('userId 数组 → 多个 user 房间', () => {
    expect(resolveTargetRooms({ userId: [1, 2, 3] })).toEqual(['user:1', 'user:2', 'user:3']);
  });

  it('departmentId + roleId 混合命中去重', () => {
    expect(resolveTargetRooms({ departmentId: 2, roleId: [1, 1, 2] })).toEqual([
      'dept:2',
      'role:1',
      'role:2',
    ]);
  });

  it('空目标 → 空数组（不应 emit）', () => {
    expect(resolveTargetRooms({})).toEqual([]);
  });
});