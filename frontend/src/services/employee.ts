import request from '@/lib/request';

export interface Employee {
  id: number;
  employeeNo: string;
  name: string;
  departmentId: number;
  departmentName?: string;
  positionId: number;
  positionName?: string;
  hireDate: string;
  resignDate?: string;
  phone: string;
  status: 'active' | 'inactive';
  salary: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeListParams {
  page?: number;
  pageSize?: number;
  name?: string;
  employeeNo?: string;
  departmentId?: number;
  status?: string;
  sort?: string;
}

export interface EmployeeListResult {
  code: number;
  message?: string;
  data?: {
    list: Employee[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface EmployeeDetailResult {
  code: number;
  message?: string;
  data?: Employee;
}

export interface CreateEmployeeParams {
  employeeNo: string;
  name: string;
  departmentId: number;
  positionId: number;
  hireDate: string;
  phone: string;
  salary: string;
}

export interface UpdateEmployeeParams {
  name?: string;
  departmentId?: number;
  positionId?: number;
  hireDate?: string;
  phone?: string;
  salary?: string;
}

export interface ResignParams {
  resignDate: string;
  reason?: string;
}

export const employeeApi = {
  getList(params: EmployeeListParams = {}): Promise<EmployeeListResult> {
    return request.get('/employees', { params });
  },

  getById(id: number): Promise<EmployeeDetailResult> {
    return request.get(`/employees/${id}`);
  },

  create(data: CreateEmployeeParams): Promise<EmployeeDetailResult> {
    return request.post('/employees', data);
  },

  update(id: number, data: UpdateEmployeeParams): Promise<EmployeeDetailResult> {
    return request.patch(`/employees/${id}`, data);
  },

  resign(id: number, data: ResignParams): Promise<EmployeeDetailResult> {
    return request.post(`/employees/${id}/resign`, data);
  },
};
