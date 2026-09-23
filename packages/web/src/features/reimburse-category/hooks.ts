import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoryApi, type CreateCategoryInput, type UpdateCategoryInput } from './api';

/** 报销类别查询 key，供新增/编辑/删除后统一失效刷新 */
const CATEGORIES_KEY = ['reimburse-categories'];

/** 拉取系统级报销类别列表 */
export function useCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: categoryApi.list });
}

/** 新建报销类别，成功后刷新列表 */
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) => categoryApi.create(data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

/** 更新报销类别，成功后刷新列表 */
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCategoryInput }) => categoryApi.update(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}

/** 删除报销类别，成功后刷新列表（被引用 409 由后端拦截） */
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => categoryApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  });
}