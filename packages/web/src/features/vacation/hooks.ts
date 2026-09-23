import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveTypeApi, quotaApi, type CreateLeaveTypeInput, type UpdateLeaveTypeInput } from './api';

export function useLeaveTypes() {
  return useQuery({ queryKey: ['leave-types'], queryFn: leaveTypeApi.list });
}
export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeaveTypeInput) => leaveTypeApi.create(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}
export function useUpdateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateLeaveTypeInput }) => leaveTypeApi.update(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}
export function useDeleteLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaveTypeApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

export function useQuotas(year: number) {
  return useQuery({ queryKey: ['quotas', year], queryFn: () => quotaApi.list(year) });
}
export function useTrend(year: number) {
  return useQuery({ queryKey: ['trend', year], queryFn: () => quotaApi.trend(year) });
}
export function useSetQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      year,
      leaveTypeId,
      allowance,
      used,
    }: { userId: number; year: number; leaveTypeId: number; allowance: number; used: number }) =>
      quotaApi.set(userId, year, leaveTypeId, allowance, used),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quotas'] }),
  });
}
export function useImportQuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ year, file }: { year: number; file: string }) => quotaApi.import(year, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['quotas'] }),
  });
}