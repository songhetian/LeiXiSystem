import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { overtimeApi, type CreateOvertimeInput } from './api';

export function useOvertimes() {
  return useQuery({ queryKey: ['overtimes'], queryFn: overtimeApi.getOvertimes });
}

export function useOvertimeStats(month: string) {
  return useQuery({
    queryKey: ['overtime-stats', month],
    queryFn: () => overtimeApi.getOvertimeStats(month),
    enabled: month.length > 0,
  });
}

export function useCreateOvertime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOvertimeInput) => overtimeApi.createOvertime(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['overtimes'] }),
  });
}

export function useSetOvertimeStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      overtimeApi.setStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['overtimes'] }),
  });
}