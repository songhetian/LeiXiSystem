import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { holidayApi, type CreateHolidayInput, type UpdateHolidayInput } from './api';

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidayApi.getHolidays(year),
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHolidayInput) => holidayApi.createHoliday(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateHolidayInput }) =>
      holidayApi.updateHoliday(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => holidayApi.deleteHoliday(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
}