'use client';
import { ReactNode } from 'react';
import { usePermission } from '@/hooks/use-permission';

interface PermissionGateProps {
  code: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ code, children, fallback = null }: PermissionGateProps) {
  const { can } = usePermission();
  if (!can(code)) return <>{fallback}</>;
  return <>{children}</>;
}
