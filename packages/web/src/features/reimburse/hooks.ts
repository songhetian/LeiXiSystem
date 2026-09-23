import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reimburseApi } from './api';
import { categoryApi } from '../reimburse-category/api';

/** 报销类别（发起报销时下拉选择分项类别）—— 复用系统级类别模块的查询 */
export function useCategories() {
  return useQuery({ queryKey: ['reimburse-categories'], queryFn: categoryApi.list });
}

export function useReimburses() {
  return useQuery({ queryKey: ['reimburses'], queryFn: reimburseApi.getReimburses });
}

export function useCreateReimburse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reimburseApi.createReimburse,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reimburses'] }),
  });
}

export function useUpdateReimburseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      reimburseApi.setStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reimburses'] }),
  });
}