import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  shiftApi,
  type UpsertShiftInput,
  type BatchScheduleInput,
  type CopyTemplateInput,
  type SmartScheduleInput,
  type UpsertScheduleInput,
  type ScheduleTemplateItemInput,
  type TemplateFormInput,
} from './api';

export function useShifts() {
  return useQuery({ queryKey: ['shifts'], queryFn: shiftApi.getShifts });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertShiftInput) => shiftApi.createShift(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpsertShiftInput }) => shiftApi.updateShift(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shiftApi.deleteShift,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useToggleShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shiftApi.toggleShift,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useSchedules(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['schedules', startDate ?? '', endDate ?? ''],
    queryFn: () => shiftApi.getSchedules(startDate!, endDate!),
    enabled: Boolean(startDate && endDate),
  });
}

export function useSelfSchedules(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['schedules', 'self', startDate ?? '', endDate ?? ''],
    queryFn: () => shiftApi.getSelfSchedules(startDate!, endDate!),
    enabled: Boolean(startDate && endDate),
  });
}

export function useSetSelfSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { scheduleDate: string; shiftId: number | null; isRestDay?: boolean }) =>
      shiftApi.setSelfSchedule(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules', 'self'] }),
  });
}

export function useUpsertSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertScheduleInput) => shiftApi.upsertSchedule(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useBatchSchedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchScheduleInput) => shiftApi.batchSchedules(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useValidateSchedules() {
  return useMutation({
    mutationFn: (data: BatchScheduleInput) => shiftApi.validateSchedules(data),
  });
}

export function useCopyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CopyTemplateInput) => shiftApi.copyTemplate(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useSmartSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SmartScheduleInput) => shiftApi.smartSchedule(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => shiftApi.deleteSchedule(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useScheduleStats(month?: string) {
  return useQuery({
    queryKey: ['schedules', 'stats', month ?? ''],
    queryFn: () => shiftApi.getScheduleStats(month!),
    enabled: Boolean(month),
  });
}

export function useTemplates() {
  return useQuery({ queryKey: ['schedule-templates'], queryFn: shiftApi.getTemplates });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string | null }) => shiftApi.createTemplate(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedule-templates'] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TemplateFormInput }) => shiftApi.updateTemplate(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedule-templates'] }),
  });
}

export function useSetTemplateItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: number; items: ScheduleTemplateItemInput[] }) => shiftApi.setTemplateItems(id, items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedule-templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => shiftApi.deleteTemplate(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedule-templates'] }),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetStart }: { id: number; targetStart: string }) => shiftApi.applyTemplate(id, targetStart),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}