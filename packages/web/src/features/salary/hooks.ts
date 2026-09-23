import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salaryApi, type CreateSalaryInput } from './api';

export function useSalaries() {
  return useQuery({ queryKey: ['salaries'], queryFn: salaryApi.getSalaries });
}

export function useCreateSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSalaryInput) => salaryApi.createSalary(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['salaries'] }),
  });
}