import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { makeupApi, type CreateMakeupInput } from './api';

export function useMakeups() {
  return useQuery({ queryKey: ['makeups'], queryFn: makeupApi.getMakeups });
}

export function useCreateMakeup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMakeupInput) => makeupApi.createMakeup(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['makeups'] }),
  });
}

export function useSetMakeupStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      makeupApi.setStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['makeups'] }),
  });
}