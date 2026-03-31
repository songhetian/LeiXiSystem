import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export interface Employee {
  id: number;
  employee_no: string;
  real_name: string;
  username?: string;
  email?: string;
  phone?: string;
  department_id: number;
  department_name?: string;
  position_name?: string;
  status: 'active' | 'inactive' | 'resigned' | 'deleted';
  hire_date?: string;
  rating?: number;
  avatar?: string;
  is_department_manager?: boolean;
  [key: string]: any;
}

export interface EmployeeFilters {
  keyword?: string;
  department_id?: string;
  position?: string;
  status?: string;
  rating?: string;
  date_from?: string;
  date_to?: string;
}

export const useEmployees = (filters: EmployeeFilters) => {
  return useQuery({
    queryKey: ['employees', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await api.get<Employee[]>(`/employees?${params.toString()}`);
      return response.data;
    },
  });
};

export const useEmployeeAction = () => {
  const queryClient = useQueryClient();
  
  const create = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/employees', data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await api.put(`/employees/${id}`, data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete(`/employees/${id}`);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const toggleManager = useMutation({
    mutationFn: async ({ userId, isManager }: { userId: number; isManager: boolean }) => {
      const response = await api.put(`/users/${userId}/department-manager`, { isDepartmentManager: isManager });
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  return { create, update, remove, toggleManager };
};

export const useEmployeeChanges = (filters: { type?: string; page?: number }) => {
  return useQuery({
    queryKey: ['employee-changes', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.type && filters.type !== 'all') params.append('type', filters.type);
      params.append('page', String(filters.page || 1));
      
      const response = await api.get<{ success: boolean; data: any[]; total: number }>(`/hr/changes?${params.toString()}`);
      return response.data;
    },
  });
};

export const useEmployeeChangeActions = () => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: {
      employee_id: number;
      change_type: 'transfer' | 'promotion' | 'resign' | 'other';
      change_date: string;
      new_department_id?: number;
      new_position_id?: number;
      reason?: string;
    }) => {
      const response = await api.post<{ success: boolean; id: number }>('/hr/changes', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-changes'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  return { create };
};

export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>('/departments/list');
      return response.data.success ? response.data.data : [];
    },
  });
};

export const usePositions = (departmentId?: string) => {
  return useQuery({
    queryKey: ['positions', departmentId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '1000' });
      if (departmentId) params.append('departmentId', departmentId);
      const response = await api.get<any>(`/positions?${params.toString()}`);
      return response.data.success ? response.data.data : [];
    },
  });
};
