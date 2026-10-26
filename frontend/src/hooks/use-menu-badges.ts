'use client';

import { useCachedData } from './use-cached-data';
import { usePermission } from './use-permission';
import { approvalApi } from '@/services/approval';
import type { ListResult, TodoItem } from '@/services/approval';

/** 无权限时占位的空结果：与 listTodos 返回结构同形，避免调用方出现 undefined 分支 */
const EMPTY_TODO: ListResult<TodoItem> = {
  code: 0,
  data: { list: [], total: 0, page: 1, pageSize: 1 },
};

/**
 * 侧栏「待办审批」角标数。
 *
 * - 无 approval:todo:view 权限时返回 0 且不发请求（fetcher 被替换为空实现）；
 * - 走 useCachedData 共享缓存：侧栏（桌面/移动两处实例）与命令面板同 key 去重，
 *   staleTime 内只打一次接口。
 */
export function useApprovalTodoCount(): number {
  const { can } = usePermission();
  const enabled = can('approval:todo:view');

  const { data } = useCachedData(
    'approval:todo-total',
    enabled
      ? () => approvalApi.listTodos({ page: 1, pageSize: 1 })
      : () => Promise.resolve(EMPTY_TODO),
    { staleTime: 30_000 },
  );

  if (!enabled) return 0;
  return data?.data?.total ?? 0;
}
