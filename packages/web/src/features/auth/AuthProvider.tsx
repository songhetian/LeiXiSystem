import { useEffect } from 'react';
import { useMe } from './hooks';
import { useAuthStore } from './store';
import { refreshTokens } from '../../lib/api';

/** 认证提供者：启动即拉取 /api/auth/me，将结果同步进 zustand。
 *  isLoading/fisAuthenticated 供路由守卫判断。 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isError, isSuccess, isLoading } = useMe();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);

  useEffect(() => {
    if (isSuccess) setAuth(data);
  }, [isSuccess, data, setAuth]);

  useEffect(() => {
    if (isError) clear();
  }, [isError, clear]);

  // 主动预刷新：access token 在到期前（15m 内）提前旋转，避免会话中途 401。
  // socket 连接不重建：服务端仅连接时鉴权一次，令牌轮换不影响既有连接。
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setInterval(() => void refreshTokens(), 9 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isSuccess]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-slate-400">加载中…</div>;
  }
  return <>{children}</>;
}