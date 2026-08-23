import { useAuthStore } from '@/store/auth';

/**
 * 按钮级权限 hook：can(code) 判断当前用户是否拥有指定权限点。
 * 未登录/无权限 → false；不传 code → false（安全默认，拒绝未声明权限的操作）。
 */
export function usePermission() {
  const { user } = useAuthStore();
  const permissions = user?.permissions ?? [];
  return {
    can: (code?: string) => (code ? permissions.includes(code) : false),
  };
}
