import type { ReactNode } from 'react';
import { useAuthStore } from './store';

/** 读取当前用户权限码列表 */
export function usePermissions(): string[] {
  return useAuthStore((s) => s.permissions);
}

/**
 * 权限判定：code 为单个或一组权限码，命中任意一个即可。
 * 权限码来自 /api/auth/me（本质是角色→权限并集，套件端去重排序）。
 */
export function useCan(code: string | string[]): boolean {
  const permissions = usePermissions();
  const required = Array.isArray(code) ? code : [code];
  return required.some((c) => permissions.includes(c));
}

interface RequirePermissionProps {
  /** 单个或一组权限码（任意命中即可） */
  code: string | string[];
  children: ReactNode;
  /** 无权限时渲染的兜底；默认渲染 null */
  fallback?: ReactNode;
}

/** RBAC 栅栏：仅当当前用户具有指定权限时才渲染 children */
export function RequirePermission({ code, children, fallback = null }: RequirePermissionProps) {
  const allowed = useCan(code);
  return <>{allowed ? children : fallback}</>;
}