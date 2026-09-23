import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentApi } from './api';

export function useDepartments() {
  return useQuery({ queryKey: ['departments'], queryFn: departmentApi.getDepartments });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: departmentApi.createDepartment,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; parentId?: number | null } }) =>
      departmentApi.updateDepartment(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: departmentApi.deleteDepartment,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}