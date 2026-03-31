import { useAuthStore } from '@/core/store/auth';

export const usePermission = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: string | string[]) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    const userPermissions = (user as any).permissions || [];

    // 兼容当前库里尚未完整初始化 RBAC 的情况:
    // 没有任何权限码时，不在前端直接把菜单全部隐藏，避免用户被锁死在两个栏目里。
    if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
      return true;
    }
    
    if (Array.isArray(permission)) {
      return permission.some(p => userPermissions.includes(p));
    }
    
    return userPermissions.includes(permission);
  };

  return { hasPermission };
};
