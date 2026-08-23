import request from '@/lib/request';

export interface SalaryItem {
  id: number;
  code: string;
  name: string;
  type: 'fixed' | 'per_day' | 'per_hour' | 'formula' | 'deduction';
  amount?: number;
  rate?: number;
  formula?: string;
  status: 'active' | 'inactive';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryItemListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  keyword?: string;
}

export interface CreateSalaryItemParams {
  code: string;
  name: string;
  type: string;
  amount?: number;
  rate?: number;
  formula?: string;
  description?: string;
}

export interface UpdateSalaryItemParams {
  name?: string;
  type?: string;
  amount?: number;
  rate?: number;
  formula?: string;
  status?: string;
  description?: string;
}

export interface PayrollRun {
  id: number;
  month: string;
  status: 'draft' | 'confirmed' | 'published' | 'recalled';
  totalEmployees: number;
  totalAmount: number;
  createdBy?: number;
  createdByName?: string;
  confirmedBy?: number;
  confirmedByName?: string;
  publishedBy?: number;
  publishedByName?: string;
  createdAt: string;
  confirmedAt?: string | null;
  publishedAt?: string | null;
  recalledAt?: string | null;
  remark?: string;
}

export interface PayrollRunListParams {
  page?: number;
  pageSize?: number;
  month?: string;
  status?: string;
}

export interface CreatePayrollRunParams {
  month: string;
  remark?: string;
}

/** 算薪明细项（对应后端 PayrollDetail 记录） */
export interface PayrollDetailItem {
  code: string;
  name: string;
  amount: number;
}

/** 算薪调整项（对应后端 PayrollAdjustment 记录） */
export interface PayrollAdjustmentItem {
  id: number;
  itemCode: string;
  amount: number;
  reason: string;
  createdAt: string;
}

/** 算薪批次中单个员工的明细汇总（后端 getRunDetails 返回） */
export interface PayrollEmployeeDetail {
  employee: {
    id: number;
    employeeNo: string;
    name: string;
    departmentId?: number | null;
  };
  items: PayrollDetailItem[];
  adjustments: PayrollAdjustmentItem[];
  total: number;
}

/** 算薪批次明细（后端 GET /payroll/runs/:id/details 返回） */
export interface PayrollRunDetails {
  run: PayrollRun;
  employees: PayrollEmployeeDetail[];
}

export interface AdjustPayrollRunParams {
  employeeId: number;
  itemCode: string;
  itemName?: string;
  amount: number;
  reason: string;
}

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface DetailResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export const payrollApi = {
  getSalaryItems(params: SalaryItemListParams = {}): Promise<ListResult<SalaryItem>> {
    return request.get('/payroll/items', { params });
  },

  createSalaryItem(params: CreateSalaryItemParams): Promise<DetailResult<{ id: number }>> {
    return request.post('/payroll/items', params);
  },

  updateSalaryItem(id: number, params: UpdateSalaryItemParams): Promise<DetailResult<SalaryItem>> {
    return request.patch(`/payroll/items/${id}`, params);
  },

  getPayrollRuns(params: PayrollRunListParams = {}): Promise<ListResult<PayrollRun>> {
    return request.get('/payroll/runs', { params });
  },

  createPayrollRun(params: CreatePayrollRunParams): Promise<DetailResult<PayrollRun>> {
    return request.post('/payroll/runs', params);
  },

  getPayrollRunDetail(id: number): Promise<DetailResult<PayrollRun>> {
    return request.get(`/payroll/runs/${id}`);
  },

  getPayrollRunDetails(id: number): Promise<DetailResult<PayrollRunDetails>> {
    return request.get(`/payroll/runs/${id}/details`);
  },

  confirmPayrollRun(id: number): Promise<DetailResult<PayrollRun>> {
    return request.post(`/payroll/runs/${id}/confirm`, {});
  },

  publishPayrollRun(id: number): Promise<DetailResult<PayrollRun>> {
    return request.post(`/payroll/runs/${id}/publish`, {});
  },

  recallPayrollRun(id: number): Promise<DetailResult<PayrollRun>> {
    return request.post(`/payroll/runs/${id}/recall`, {});
  },

  adjustPayrollRun(id: number, params: AdjustPayrollRunParams): Promise<DetailResult<any>> {
    return request.post(`/payroll/runs/${id}/adjust`, params);
  },
};
