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
  /**
   * 原始明细 JSON。
   * **员工端列表接口已不下发**（明细受二级密码门禁，只能从详情接口拿），
   * 需要明细请走 payslipApi.getMyPayslipDetail；此字段仅为兼容旧数据保留为可选。
   */
  itemsJson?: string;
  createdAt: string;
  updatedAt: string;
  // 后端由 items_json 汇总并 toFixed(2)，序列化后是字符串；无 base 项时 baseSalary 为 null
  baseSalary?: number | string | null;
  totalIncome?: number | string;
  totalDeduction?: number | string;
  netSalary?: number | string;
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
    /** 催办发通知用 */
    userId?: number | null;
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
 * 我的年度累计（后端按 Decimal 定点累加后 toFixed(2)，序列化为字符串）
 * 后端 GET /payslips/me/summary?year=YYYY 返回此结构
 */
export interface MyYearSummary {
  year: string;
  /** 当年已出工资条的月份数 */
  months: number;
  totalIncome: string;
  totalDeduction: string;
  /**
   * 调整项合计（奖惩/补发补扣，正数=加、负数=减）。
   * 实发含调整项，所以「应发 + 调整 + 扣款 = 实发」才是对的；
   * 只给三项时员工在有奖惩的月份永远对不上账。
   */
  adjustmentTotal?: string;
  netSalary: string;
}

/**
 * 管理端列表查询参数（支持批次 / 月份 / 查看状态 / 部门过滤）
 */
export interface PayslipAdminListParams extends PayslipListParams {
  runId?: number;
  /** 查看状态：筛「未查看」即待催办名单 */
  status?: 'viewed' | 'unviewed';
  departmentId?: number;
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

  /** 获取当前登录员工的年度累计（应发/扣款/实发三项合计 + 月份数） */
  getMyYearSummary(year: string): Promise<DetailResult<MyYearSummary>> {
    return request.get('/payslips/me/summary', { params: { year } });
  },

  /** 标记工资条为已查看 */
  markAsViewed(id: number): Promise<DetailResult<Payslip>> {
    return request.post(`/payslips/me/${id}/view`, {});
  },

  /** 二级密码验证（查看明细前必须通过；通过后 5 分钟内免重复验证） */
  verifyPassword(password: string): Promise<DetailResult<{ verified: boolean; expiresInSeconds: number }>> {
    return request.post('/payslips/me/verify-password', { password });
  },

  /** 管理端：获取工资条列表（含员工关联信息） */
  getPayslips(params: PayslipAdminListParams = {}): Promise<ListResult<PayslipWithEmployee>> {
    return request.get('/payslips', { params });
  },

  /** 管理端：获取工资条详情（受数据权限约束，HR 核对明细用） */
  getPayslipDetail(id: number): Promise<DetailResult<PayslipDetail>> {
    return request.get(`/payslips/${id}`);
  },
};
