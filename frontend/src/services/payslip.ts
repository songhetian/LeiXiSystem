import request from '@/lib/request';

/**
 * 工资条明细项（items_json 解析后的每一项）
 * 对应后端 PayslipService.generateFromRun 中构造的 item 结构
 */
export interface PayslipItem {
  code: string;
  name: string;
  amount: number;
  type?: 'income' | 'deduction' | 'adjustment';
}

/**
 * 工资条基础信息（对应 Prisma Payslip 模型，列表接口返回）
 * 后端 GET /payslips/me 返回此结构
 */
export interface Payslip {
  id: number;
  runId: number;
  employeeId: number;
  month: string;
  totalAmount: number;
  status: 'unviewed' | 'viewed';
  viewedAt?: string | null;
  itemsJson: string;
  createdAt: string;
  updatedAt: string;
  baseSalary?: number;
  totalIncome?: number;
  totalDeduction?: number;
  netSalary?: number;
}

/**
 * 工资条详情（详情接口返回，包含解析后的 items 数组）
 * 后端 GET /payslips/me/:id 返回此结构（在 Payslip 基础上附加 items）
 */
export interface PayslipDetail extends Payslip {
  items: PayslipItem[];
  adjustments?: PayslipItem[];
  employeeNo?: string;
  employeeName?: string;
  departmentName?: string;
}

/**
 * 管理端工资条列表项（包含员工关联信息）
 * 后端 GET /payslips 返回此结构（include employee 关联）
 */
export interface PayslipWithEmployee extends Payslip {
  employee: {
    id: number;
    employeeNo: string;
    name: string;
    department: { id: number; name: string } | null;
  };
}

export interface PayslipListParams {
  page?: number;
  pageSize?: number;
  month?: string;
}

export interface MyPayslipListParams extends PayslipListParams {}

/**
 * 管理端列表查询参数（后端仅支持 runId / month 过滤）
 */
export interface PayslipAdminListParams extends PayslipListParams {
  runId?: number;
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
  /** 获取当前登录员工的工资条列表 */
  getMyPayslips(params: MyPayslipListParams = {}): Promise<ListResult<Payslip>> {
    return request.get('/payslips/me', { params });
  },

  /** 获取当前登录员工的工资条详情（含 items 明细数组） */
  getMyPayslipDetail(id: number): Promise<DetailResult<PayslipDetail>> {
    return request.get(`/payslips/me/${id}`);
  },

  /** 标记工资条为已查看 */
  markAsViewed(id: number): Promise<DetailResult<Payslip>> {
    return request.post(`/payslips/me/${id}/view`, {});
  },

  /** 管理端：获取工资条列表（含员工关联信息） */
  getPayslips(params: PayslipAdminListParams = {}): Promise<ListResult<PayslipWithEmployee>> {
    return request.get('/payslips', { params });
  },
};
