import request from '@/lib/request';

// ========== 财务预算 ==========

export interface Budget {
  id: number;
  /** 预算年份 */
  year: number;
  /** 部门ID；为空表示公司总预算 */
  departmentId?: number | null;
  departmentName?: string;
  /** 预算类别（如：行政、差旅、办公、营销等） */
  category?: string;
  /** 预算总额 */
  totalAmount: number;
  /** 已用金额 */
  usedAmount?: number;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 列表查询参数 */
export interface BudgetListParams {
  year?: number;
  departmentId?: number;
  category?: string;
}

export interface BudgetCreateDto {
  year: number;
  departmentId?: number | null;
  category?: string;
  totalAmount: number;
  remark?: string;
}

export interface BudgetUpdateDto {
  year?: number;
  departmentId?: number | null;
  category?: string;
  totalAmount?: number;
  remark?: string;
}

// ========== 费用标准 ==========

export interface ExpenseStandard {
  id: number;
  /** 标准名称 */
  name: string;
  /** 费用类别 */
  category?: string;
  /** 标准金额 */
  amount: number;
  /** 计量单位（如：元/天、元/次、元/公里） */
  unit?: string;
  description?: string;
  /** 状态：enabled 启用 / disabled 停用 */
  status: 'enabled' | 'disabled';
  createdAt?: string;
  updatedAt?: string;
}

/** 列表查询参数 */
export interface ExpenseStandardListParams {
  category?: string;
  keyword?: string;
  status?: string;
}

export interface ExpenseStandardCreateDto {
  name: string;
  category?: string;
  amount: number;
  unit?: string;
  description?: string;
}

export interface ExpenseStandardUpdateDto {
  name?: string;
  category?: string;
  amount?: number;
  unit?: string;
  description?: string;
}

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: { list: T[]; total: number; page: number; pageSize: number };
}

export interface DetailResult<T> {
  code: number;
  message?: string;
  data?: T;
}

/**
 * 资金模块接口封装。
 * 后端均位于 /api/v1 前缀下（前端 request baseURL 已配置）。
 */
export const financeApi = {
  // ---- 财务预算 ----
  listBudgets(params: BudgetListParams = {}): Promise<ListResult<Budget>> {
    return request.get('/finance/budgets', { params });
  },
  createBudget(data: BudgetCreateDto): Promise<DetailResult<{ id: number }>> {
    return request.post('/finance/budgets', data);
  },
  updateBudget(id: number, data: BudgetUpdateDto): Promise<DetailResult<Budget>> {
    return request.put(`/finance/budgets/${id}`, data);
  },
  deleteBudget(id: number): Promise<DetailResult<{ success: boolean }>> {
    return request.delete(`/finance/budgets/${id}`);
  },

  // ---- 费用标准 ----
  listExpenseStandards(params: ExpenseStandardListParams = {}): Promise<ListResult<ExpenseStandard>> {
    return request.get('/finance/expense-standards', { params });
  },
  createExpenseStandard(data: ExpenseStandardCreateDto): Promise<DetailResult<{ id: number }>> {
    return request.post('/finance/expense-standards', data);
  },
  updateExpenseStandard(id: number, data: ExpenseStandardUpdateDto): Promise<DetailResult<ExpenseStandard>> {
    return request.put(`/finance/expense-standards/${id}`, data);
  },
  /** 启停切换 */
  toggleExpenseStandard(id: number): Promise<DetailResult<ExpenseStandard>> {
    return request.patch(`/finance/expense-standards/${id}/toggle`);
  },
  deleteExpenseStandard(id: number): Promise<DetailResult<{ success: boolean }>> {
    return request.delete(`/finance/expense-standards/${id}`);
  },
};