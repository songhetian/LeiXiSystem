import { useAuthStore } from '@/core/store/auth';

export const usePermission = () => {
  const { user } = useAuthStore();

  const hasPermission = (permission: string | string[]) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    // 简单的权限逻辑，实际项目中可能从 user.permissions 获取
    const userPermissions = (user as any).permissions || [];
    
    if (Array.isArray(permission)) {
      return permission.some(p => userPermissions.includes(p));
    }
    
    return userPermissions.includes(permission);
  };

  return { hasPermission };
};
