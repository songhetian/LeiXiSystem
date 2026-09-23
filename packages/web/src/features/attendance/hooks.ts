import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, type CreateAttendanceInput } from './api';

export function useAttendance() {
  return useQuery({ queryKey: ['attendance'], queryFn: attendanceApi.getAttendance });
}

export function useAttendanceStats(month: string) {
  return useQuery({
    queryKey: ['attendance-stats', month],
    queryFn: () => attendanceApi.getAttendanceStats(month),
    enabled: month.length > 0,
  });
}

export function useCreateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAttendanceInput) => attendanceApi.createAttendance(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}