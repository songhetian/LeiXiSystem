import type { ApiEnvelope } from '@leixi/shared';

const TOKEN_KEY = 'leixi.access_token';
const REFRESH_KEY = 'leixi.refresh_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

/** 登录/刷新成功后同步保存令牌对 */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

/** 登出/令牌失效后清空 */
export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

// 单飞：并发多个 401 时共享同一次刷新，避免重复请求
let refreshPromise: Promise<string | null> | null = null;

/**
 * 用 refreshToken 换取新令牌对并落盘。成功返回新 access token；失败返回 null。
 * 调用方（AuthProvider）在成功后重建 socket，使通知房间跟随新会话。
 */
export function refreshTokens(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as ApiEnvelope<RefreshResult>;
      if (!body.success || !body.data) return null;
      setTokens(body.data.accessToken, body.data.refreshToken);
      return body.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request(path: string, init: RequestInit | undefined, access: string | null): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(access ? { authorization: `Bearer ${access}` } : {}),
      ...init?.headers,
    },
  });
}

async function toData<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || !body.success) {
    throw new Error(body.message || '请求失败');
  }
  return body.data as T;
}

/** 统一请求：自动带 Bearer token，401 时透明刷新令牌并重试一次；
 *  刷新失败则清空登录态并抛错（由 /me 驱动跳转登录）。 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const first = await request(path, init, getToken());
  if (first.status === 401) {
    const newAccess = await refreshTokens();
    if (newAccess) {
      const retry = await request(path, init, newAccess);
      if (retry.status !== 401) return toData<T>(retry);
      clearTokens();
      throw new Error('登录已过期，请重新登录');
    }
    clearTokens();
  }
  return toData<T>(first);
}