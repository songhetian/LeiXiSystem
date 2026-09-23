import type { SalaryView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface SalaryList {
  salaries: SalaryView[];
}

export interface CreateSalaryInput {
  month: string; // YYYY-MM
  userId: number;
  basic: number;
  bonus: number;
  deduction: number;
}

export const salaryApi = {
  /** 拉取当前用户可见作用域内的薪资单（后端按部门隔离过滤） */
  async getSalaries(): Promise<SalaryList> {
    return api<SalaryList>('/api/salaries');
  },
  /** 录入薪资：departmentId 由后端按目标员工归属部门写入，net 由后端计算 */
  async createSalary(data: CreateSalaryInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/salaries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};