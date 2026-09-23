import type { DepartmentView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface DepartmentList {
  departments: DepartmentView[];
}

export const departmentApi = {
  /** 部门列表（含 id/name/parentId，前端自行拼父级名称） */
  async getDepartments(): Promise<DepartmentList> {
    return api<DepartmentList>('/api/departments');
  },
  /** 新建部门；name 冲突时后端返回 409 */
  async createDepartment(data: { name: string; parentId: number | null }): Promise<{ id: number }> {
    return api<{ id: number }>('/api/departments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 编辑部门：name / parentId（null 表示移动到根级）均可选 */
  async updateDepartment(id: number, data: { name?: string; parentId?: number | null }): Promise<void> {
    await api<void>(`/api/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  /** 删除部门：有子部门/请假单/用户时后端 409；不存在 404 */
  async deleteDepartment(id: number): Promise<void> {
    await api<void>(`/api/departments/${id}`, { method: 'DELETE' });
  },
};