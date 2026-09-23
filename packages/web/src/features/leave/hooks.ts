import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from './api';

export function useLeaves() {
  return useQuery({ queryKey: ['leaves'], queryFn: leaveApi.getLeaves });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leaveApi.createLeave,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leaves'] }),
  });
}

export function useUpdateLeaveStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      leaveApi.setStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['leaves'] }),
  });
}