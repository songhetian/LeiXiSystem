import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CsrfService } from '../common/csrf.service';
import { ERROR_CODES } from '../common/error-codes';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 登录接口豁免。登录请求校验的是账号密码本身，CSRF 头不提供额外信息；
 * 而且「已登录状态下换账号重新登录」这条路径上，旧 Cookie 还在，
 * 若也要求 CSRF 头，前端在登录页反而拿不到（登录页不保证已补取过 token）。
 */
function isLoginPath(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  return url.split('?')[0].endsWith('/auth/login');
}

/** 从 Cookie 头取指定键；@fastify/cookie 的 req.cookies 在 Nest FastifyAdapter 下不可靠 */
function readCookie(header: unknown, name: string): string | undefined {
  if (typeof header !== 'string') return undefined;
  return header
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/**
 * CSRF 校验（双提交：会话 Cookie + `X-CSRF-Token` 头）。
 *
 * ⚠️ 这里**不能依赖 `req.user`**：本守卫以 `APP_GUARD` 注册，执行顺序在 controller 级
 * `@UseGuards(JwtAuthGuard)` **之前**，那时 JwtAuthGuard 还没解析 JWT、req.user 仍是
 * undefined。此前写的 `if (!userId) return true` 本意是「公开接口跳过」，实际效果是
 * **全站写接口一律跳过**：带一颗 `X-CSRF-Token: garbage` 的 PUT 照样落库（2026-11-06 实测）。
 *
 * 现在自己从 Cookie 解出 userId（与 JwtAuthGuard 同一口径：手动拆 Cookie 头 + verifyAsync），
 * 解不出（未登录 / token 无效）时放行 —— 后面 JwtAuthGuard 会以 401 拦掉，
 * 没有会话也就没有可被冒用的权限，这与「公开接口跳过」是同一个语义。
 *
 * 代价是每个写请求多一次 JWT 验签（HMAC，微秒级）；好处是判据不依赖守卫注册顺序，
 * 以后谁调整 APP_GUARD 或 controller 的 @UseGuards 都不会让它悄悄失效。
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly csrfService: CsrfService,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (SAFE_METHODS.has(String(req.method ?? '').toUpperCase())) return true;
    if (isLoginPath(req.url)) return true;

    const userId = req.user?.id ?? (await this.userIdFromCookie(req));
    if (!userId) return true;

    const tokenHeader = req.headers['x-csrf-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
    if (!token || typeof token !== 'string') {
      throw new ForbiddenException({
        code: ERROR_CODES.CSRF_TOKEN_MISSING,
        message: 'CSRF token 缺失',
      });
    }

    const valid = await this.csrfService.validateToken(userId, token);
    if (!valid) {
      throw new ForbiddenException({
        code: ERROR_CODES.CSRF_TOKEN_INVALID,
        message: 'CSRF token 无效',
      });
    }

    return true;
  }

  /** Cookie 里的会话 → userId；解不出就交给后面的 JwtAuthGuard 判 401 */
  private async userIdFromCookie(req: {
    headers?: Record<string, unknown>;
  }): Promise<number | undefined> {
    const token = readCookie(req.headers?.cookie, 'access_token');
    if (!token) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: number }>(token);
      return typeof payload?.sub === 'number' ? payload.sub : undefined;
    } catch {
      return undefined;
    }
  }
}
