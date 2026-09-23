import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attSettingApi } from './api';

export function useAttSetting() {
  return useQuery({ queryKey: ['att-setting'], queryFn: attSettingApi.getSetting });
}

export function useUpdateAttSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: attSettingApi.updateSetting,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['att-setting'] }),
  });
}