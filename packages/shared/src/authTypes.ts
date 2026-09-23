/** 与后端 /api/auth 相关的共享类型（前后端复用） */

/** 登录态用户最小投影 */
export interface AuthUser {
  id: number;
  username: string;
  realName: string;
}

/** POST /api/auth/login 的响应 data */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** GET /api/auth/me 的响应 data：用户投影 + 权限码列表 */
export interface MeResult extends AuthUser {
  permissions: string[];
}