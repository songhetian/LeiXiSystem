import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { atExceptionApi } from './api';

export function useExceptions(filters: { status?: string; type?: string } = {}) {
  return useQuery({ queryKey: ['att-exceptions', filters], queryFn: () => atExceptionApi.list(filters) });
}

export function useScanExceptions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ startDate, endDate }: { startDate: string; endDate: string }) =>
      atExceptionApi.scan(startDate, endDate),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['att-exceptions'] }),
  });
}

export function useSetExceptionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, remark }: { id: number; status: 'confirmed' | 'dismissed'; remark?: string }) =>
      atExceptionApi.setStatus(id, status, remark),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['att-exceptions'] }),
  });
}