import request from '@/lib/request';

export interface PayslipItem {
  code: string;
  name: string;
  amount: number;
  type: 'income' | 'deduction';
}

export interface Payslip {
  id: number;
  employeeId: number;
  employeeNo: string;
  employeeName: string;
  departmentName: string;
  month: string;
  runId: number;
  status: 'unviewed' | 'viewed';
  baseSalary: number;
  overtimePay: number;
  absenceDeduction: number;
  bonus: number;
  totalIncome: number;
  totalDeduction: number;
  netSalary: number;
  items: PayslipItem[];
  adjustments: PayslipItem[];
  createdAt: string;
  viewedAt?: string | null;
}

export interface PayslipListParams {
  page?: number;
  pageSize?: number;
  month?: string;
}

export interface MyPayslipListParams extends PayslipListParams {}

export interface PayslipAdminListParams extends PayslipListParams {
  employeeNo?: string;
  employeeName?: string;
  departmentId?: number;
  status?: string;
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

export const payslipApi = {
  getMyPayslips(params: MyPayslipListParams = {}): Promise<ListResult<Payslip>> {
    return request.get('/payslips/me', { params });
  },

  getMyPayslipDetail(id: number): Promise<DetailResult<Payslip>> {
    return request.get(`/payslips/me/${id}`);
  },

  markAsViewed(id: number): Promise<DetailResult<Payslip>> {
    return request.post(`/payslips/me/${id}/view`, {});
  },

  getPayslips(params: PayslipAdminListParams = {}): Promise<ListResult<Payslip>> {
    return request.get('/payslips', { params });
  },
};
