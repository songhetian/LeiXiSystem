import logger from '@/utils/logger';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../utils/apiConfig';
import { wsManager } from '../services/websocket';

const PermissionContext = createContext(null);

export const PermissionProvider = ({ children }) => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      // 统一使用最新的 auth 路由
      const response = await fetch(getApiUrl('/api/auth/permissions'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();

      if (data.success) {
        // --- 容错处理：支持 data.permissions 或直接 permissions 格式 ---
        const codes = data.permissions || data.data?.permissions || [];
        setPermissions(codes);
        localStorage.setItem('permissions', JSON.stringify(codes));
        logger.info(`✅ [PermissionContext] 权限同步成功: ${codes.length} 项`);
      } else {
        throw new Error(data.message || '获取失败');
      }
    } catch (error) {
      logger.error('权限同步异常:', error);
      // 降级：尝试从本地缓存读取
      const saved = localStorage.getItem('permissions');
      if (saved) setPermissions(JSON.parse(saved));
      else setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();

    // 🛡️ 雷犀强化：监听 WebSocket 权限更新指令
    const handlePermissionsUpdated = (data) => {
      logger.info('📡 [PermissionContext] 收到实时权限更新指令:', data.message);
      fetchPermissions();
    };

    wsManager.on('permissions_updated', handlePermissionsUpdated);

    return () => {
      wsManager.off('permissions_updated', handlePermissionsUpdated);
    };
  }, [fetchPermissions]);

  const hasPermission = useCallback((permissionCode) => {
    // 🛡️ 雷犀强化：支持数组匹配 (hasAnyPermission 的简化调用)
    if (Array.isArray(permissionCode)) {
      return permissionCode.some(code => permissions.includes(code));
    }
    return permissions.includes(permissionCode);
  }, [permissions]);

  // 检查是否有任意一个权限
  const hasAnyPermission = useCallback((permissionCodes) => {
    return permissionCodes.some(code => permissions.includes(code));
  }, [permissions]);

  return (
    <PermissionContext.Provider value={{ permissions, hasPermission, hasAnyPermission, fetchPermissions, loading }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
};
