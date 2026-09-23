import { create } from 'zustand';
import type { AuthUser, MeResult } from '@leixi/shared';

interface AuthState {
  user: AuthUser | null;
  permissions: string[];
  /** 由 GET /api/auth/me 的结果同步认证态（用户投影 + 权限码） */
  setAuth: (me: MeResult) => void;
  clear: () => void;
}

/** 客户端认证态：当前用户投影 + 权限码列表；服务端权威由 React Query 持有。
 *  RBAC 判定（useCan / RequirePermission）读取此处的 permissions。 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  permissions: [],
  setAuth: (me) =>
    set({
      user: { id: me.id, username: me.username, realName: me.realName },
      permissions: me.permissions,
    }),
  clear: () => set({ user: null, permissions: [] }),
}));