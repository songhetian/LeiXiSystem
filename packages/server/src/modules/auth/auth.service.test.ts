import { describe, it, expect, beforeEach } from 'vitest';
import { createAuthService, type SessionStore } from './auth.service';

const CONFIG = { jwtSecret: 'test-secret', accessTtl: '15m', refreshTtl: '30d' } as const;

function memoryStore(): SessionStore {
  const map = new Map<number, string>();
  return {
    set: async (userId, tokenId) => void map.set(userId, tokenId),
    get: async (userId) => map.get(userId) ?? null,
    delete: async (userId) => void map.delete(userId),
  };
}

describe('auth.service (Seam A 纯函数)', () => {
  let store: SessionStore;
  let auth: ReturnType<typeof createAuthService>;

  beforeEach(() => {
    store = memoryStore();
    auth = createAuthService(store, CONFIG);
  });

  it('hashPassword 后 verifyPassword 可用同一明文通过，不同明文失败', async () => {
    const hash = await auth.hashPassword('s3cret');
    await expect(auth.verifyPassword('s3cret', hash)).resolves.toBe(true);
    await expect(auth.verifyPassword('wrong', hash)).resolves.toBe(false);
  });

  it('白盒：hash 不包含明文', async () => {
    const hash = await auth.hashPassword('s3cret');
    expect(hash).not.toContain('s3cret');
  });

  it('issueTokens 产出 access 与 refresh 两个可用令牌', async () => {
    const { accessToken, refreshToken } = auth.issueTokens(7);
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
    expect(accessToken).not.toBe(refreshToken);
  });

  it('单设备会话：新登录覆盖旧 refresh，旧 refresh 无法再通过校验', async () => {
    const first = auth.issueTokens(7);
    await expect(auth.verifyRefreshToken(first.refreshToken)).resolves.toBe(7);

    const second = auth.issueTokens(7); // 第二台设备登录
    // 旧令牌应失效（被踢）
    await expect(auth.verifyRefreshToken(first.refreshToken)).resolves.toBeNull();
    // 新令牌有效
    await expect(auth.verifyRefreshToken(second.refreshToken)).resolves.toBe(7);
  });

  it('logout 后 refresh token 失效', async () => {
    const { refreshToken } = auth.issueTokens(7);
    await auth.logout(7);
    await expect(auth.verifyRefreshToken(refreshToken)).resolves.toBeNull();
  });
});