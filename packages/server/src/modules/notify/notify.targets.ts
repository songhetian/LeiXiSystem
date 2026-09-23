/**
 * socket 通知定向目标 → 房间名映射（纯函数，便于单测）。
 *
 * 房间命名约定：
 *   - 用户：user:{userId}
 *   - 部门：dept:{departmentId}
 *   - 角色：role:{roleId}
 * 三者均可传单个 id 或 id 数组，一次调用可同时命中多个房间（去重）。
 */
export interface NotifyTargets {
  userId?: number | number[];
  departmentId?: number | number[];
  roleId?: number | number[];
}

export type ResolvedRooms = Set<string>;

/** 把定向目标展开成去重后的房间名集合 */
export function resolveTargetRooms(targets: NotifyTargets): string[] {
  const rooms = new Set<string>();
  for (const id of toArray(targets.userId)) rooms.add(`user:${id}`);
  for (const id of toArray(targets.departmentId)) rooms.add(`dept:${id}`);
  for (const id of toArray(targets.roleId)) rooms.add(`role:${id}`);
  return [...rooms];
}

function toArray(x: number | number[] | undefined): number[] {
  if (x === undefined) return [];
  return Array.isArray(x) ? x : [x];
}