import React from 'react';
import { usePermission } from '../contexts/PermissionContext';

/**
 * 权限门控组件
 * @param {string} permission - 需要的权限代码
 * @param {ReactNode} children - 有权限时显示的内容
 * @param {ReactNode} fallback - 无权限时显示的内容 (默认不显示)
 */
const PermissionGate = ({ permission, children, fallback = null }) => {
  const { hasPermission, loading } = usePermission();

  if (loading) {
    return null; // 或者返回一个加载占位符
  }

  if (hasPermission(permission)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};

export default PermissionGate;
