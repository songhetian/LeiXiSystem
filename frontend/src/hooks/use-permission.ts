import { useAuthStore } from '@/store/auth';

/**
 * 按钮级权限 hook：can(code) 判断当前用户是否拥有指定权限点。
 * 未登录/无权限 → false；不传 code → 放行（用于无需权限的按钮）。
 */
export function usePermission() {
  const { user } = useAuthStore();
  const permissions = user?.permissions ?? [];
  return {
    can: (code?: string) => (code ? permissions.includes(code) : true),
  };
}
