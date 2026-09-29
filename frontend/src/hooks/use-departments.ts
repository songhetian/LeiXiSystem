'use client';

import { useCallback } from 'react';
import { useDict } from './use-dict';
import { systemApi } from '@/services/system';
import { notifyError } from '@/lib/request';

export interface ReferenceItem {
  id: number;
  name: string;
}

/**
 * 部门参考数据（跨页面共享缓存，TTL 5 分钟）。
 * 替代各页面 useEffect 内联 listDepartments 的重复写法；
 * 接口异常时降级为空数组（不阻断页面渲染），但会显式提示，避免「下拉静默变空、无法提交且不知原因」。
 */
export function useDepartments() {
  // fetcher 必须保持稳定引用：useDict 的 effect 依赖它，内联箭头会导致重复请求
  const fetcher = useCallback(
    () =>
      systemApi
        .listDepartments()
        .then((res) => (res.code === 0 && res.data ? res.data : []))
        .catch((e) => {
          notifyError(e, '部门数据加载失败，请刷新重试');
          return [] as ReferenceItem[];
        }),
    [],
  );
  const { data, loading } = useDict<ReferenceItem[]>({ key: 'ref:departments', fetcher });
  return { departments: data ?? [], loading };
}

/** 岗位参考数据，同 useDepartments。 */
export function usePositions() {
  const fetcher = useCallback(
    () =>
      systemApi
        .listPositions()
        .then((res) => (res.code === 0 && res.data ? res.data : []))
        .catch((e) => {
          notifyError(e, '岗位数据加载失败，请刷新重试');
          return [] as ReferenceItem[];
        }),
    [],
  );
  const { data, loading } = useDict<ReferenceItem[]>({ key: 'ref:positions', fetcher });
  return { positions: data ?? [], loading };
}
