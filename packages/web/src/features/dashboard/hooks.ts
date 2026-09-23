import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from './api';

export function useDashboardStats() {
  return useQuery({ queryKey: ['dashboard-stats'], queryFn: dashboardApi.getStats });
}