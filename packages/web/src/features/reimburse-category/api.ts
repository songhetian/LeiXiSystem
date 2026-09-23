import type { ReimburseCategoryView } from '@leixi/shared';
import { api } from '../../lib/api';

/** 报销类别列表接口返回结构（系统级，无部门隔离） */
export interface ReimburseCategoriesPayload {
  categories: ReimburseCategoryView[];
}

/** 新增报销类别入参 */
export interface CreateCategoryInput {
  name: string;
  isActive?: boolean;
  description?: string | null;
}

/** 更新报销类别入参（字段均可选，传哪些改哪些） */
export interface UpdateCategoryInput {
  name?: string;
  isActive?: boolean;
  description?: string | null;
}

/** 系统级报销类别 API 封装 */
export const categoryApi = {
  /** 拉取全部系统级报销类别 */
  async list(): Promise<ReimburseCategoriesPayload> {
    return api<ReimburseCategoriesPayload>('/api/reimburse-categories');
  },
  /** 新建报销类别（重名返回 409） */
  async create(data: CreateCategoryInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/reimburse-categories', { method: 'POST', body: JSON.stringify(data) });
  },
  /** 更新报销类别（不存在 404、重名 409） */
  async update(id: number, data: UpdateCategoryInput): Promise<null> {
    return api<null>(`/api/reimburse-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  /** 删除报销类别（被报销单引用时返回 409） */
  async remove(id: number): Promise<null> {
    return api<null>(`/api/reimburse-categories/${id}`, { method: 'DELETE' });
  },
};