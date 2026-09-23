import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/** 会话存储抽象：隔离 Redis，测试用注入 mock 实现单设备会话控制 */
export interface SessionStore {
  set(userId: number, sessionId: string): Promise<void>;
  get(userId: number): Promise<string | null>;
  delete(userId: number): Promise<void>;
}

export interface AuthConfig {
  jwtSecret: string;
  accessTtl: jwt.SignOptions['expiresIn']; // 如 '15m'
  refreshTtl: jwt.SignOptions['expiresIn']; // 如 '30d'
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function createAuthService(store: SessionStore, config: AuthConfig) {
  async function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /** 生成新会话令牌，覆盖 Redis 中的旧会话（单设备登录：旧 refresh 立即失效） */
  function issueTokens(userId: number): TokenPair {
    const sid = randomUUID(); // 每次登录唯一会话，用于单设备踢人
    void store.set(userId, sid);
    const accessToken = jwt.sign({ sub: String(userId), sid, typ: 'access' }, config.jwtSecret, {
      expiresIn: config.accessTtl,
    });
    const refreshToken = jwt.sign({ sub: String(userId), sid, typ: 'refresh' }, config.jwtSecret, {
      expiresIn: config.refreshTtl,
    });
    return { accessToken, refreshToken };
  }

  /** 校验 refresh token 并校验是否为当前活跃会话；通过则返回 userId */
  async function verifyRefreshToken(refreshToken: string): Promise<number | null> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, config.jwtSecret) as jwt.JwtPayload;
    } catch {
      return null;
    }
    if (payload.typ !== 'refresh' || payload.sub === undefined || typeof payload.sid !== 'string') {
      return null;
    }
    const userId = Number(payload.sub);
    const stored = await store.get(userId);
    if (stored !== payload.sid) return null; // 已被踢/轮换
    return userId;
  }

  /**
   * 校验 access token payload 是否为当前活跃会话（单设备踢人即时生效）。
   * typ 必须为 'access'，且 sid 需匹配 Redis 中最新会话；否则（被踢/轮换）返回 null。
   */
  async function verifyAccessSession(payload: jwt.JwtPayload | undefined): Promise<number | null> {
    if (!payload || payload.typ !== 'access' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      return null;
    }
    const userId = Number(payload.sub);
    const stored = await store.get(userId);
    if (stored !== payload.sid) return null; // 已被踢/轮换
    return userId;
  }

  /** 登出：删除底层会话（单设备） */
  async function logout(userId: number): Promise<void> {
    await store.delete(userId);
  }

  return { hashPassword, verifyPassword, issueTokens, verifyRefreshToken, verifyAccessSession, logout };
}

export type AuthService = ReturnType<typeof createAuthService>;