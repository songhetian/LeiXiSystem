import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from '../common/csrf.service';
import { ERROR_CODES } from '../common/error-codes';

/**
 * CSRF 守卫的回归用例。
 *
 * 背景（2026-11-06 实测）：守卫以 APP_GUARD 注册，早于 controller 级 JwtAuthGuard 执行，
 * 而它靠 `req.user` 判断「是否已登录」。req.user 永远是 undefined，于是每个写请求都在
 * `if (!userId) return true` 处提前放行 —— 带 `X-CSRF-Token: garbage` 的 PUT 也能改数据。
 * 下面第 3、4 条用例就是钉住「必须真的校验」，第 2 条钉住「未登录不是 403，
 * 而是交给 JwtAuthGuard 判 401」，避免把公开接口/登录接口堵死。
 */
function createContext(opts: {
  method?: string;
  cookie?: string;
  csrfToken?: string;
  user?: { id: number };
  url?: string;
}): any {
  const headers: Record<string, unknown> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.csrfToken) headers['x-csrf-token'] = opts.csrfToken;
  const req: any = { method: opts.method ?? 'PUT', headers, url: opts.url ?? '/api/v1/approval/role-bindings' };
  if (opts.user) req.user = opts.user;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    __req: req,
  };
}

describe('CsrfGuard - 写请求必须带有效的 X-CSRF-Token', () => {
  let guard: CsrfGuard;
  let csrf: jest.Mocked<Pick<CsrfService, 'validateToken'>>;
  let jwt: any;

  beforeEach(() => {
    csrf = { validateToken: jest.fn() };
    jwt = { verifyAsync: jest.fn() };
    jwt.verifyAsync.mockResolvedValue({ sub: 7, username: 'admin' });
    guard = new CsrfGuard(
      csrf as unknown as CsrfService,
      jwt as any,
    );
  });

  it('安全方法（GET/HEAD/OPTIONS）不校验，也不验签', async () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      await expect(guard.canActivate(createContext({ method }))).resolves.toBe(true);
    }
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(csrf.validateToken).not.toHaveBeenCalled();
  });

  it('没有会话 Cookie 时放行（未登录由 JwtAuthGuard 回 401，不应变成 403）', async () => {
    await expect(guard.canActivate(createContext({ method: 'PUT' }))).resolves.toBe(true);
    expect(csrf.validateToken).not.toHaveBeenCalled();
  });

  it('已登录但缺 X-CSRF-Token → 403 CSRF_TOKEN_MISSING', async () => {
    const ctx = createContext({ cookie: 'access_token=session-jwt' });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.CSRF_TOKEN_MISSING }),
    });
  });

  it('伪造 token → 403 CSRF_TOKEN_INVALID（这正是修复前被放行的场景）', async () => {
    csrf.validateToken.mockResolvedValue(false);
    const ctx = createContext({ cookie: 'access_token=session-jwt', csrfToken: 'garbage' });

    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      response: expect.objectContaining({ code: ERROR_CODES.CSRF_TOKEN_INVALID }),
    });
    // 校验必须绑定到 Cookie 解出来的用户，而不是「有 token 就过」
    expect(csrf.validateToken).toHaveBeenCalledWith(7, 'garbage');
  });

  it('有效 token → 放行', async () => {
    csrf.validateToken.mockResolvedValue(true);
    const ctx = createContext({ cookie: 'access_token=session-jwt', csrfToken: 'good' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('req.user 已挂载时直接用，不重复验签（守卫顺序变化也成立）', async () => {
    csrf.validateToken.mockResolvedValue(true);
    const ctx = createContext({ csrfToken: 'good', user: { id: 9 } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    expect(csrf.validateToken).toHaveBeenCalledWith(9, 'good');
  });

  it('Cookie 里的 JWT 已失效 → 放行，由 JwtAuthGuard 回 401（不在这里提前抛 403）', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      guard.canActivate(createContext({ cookie: 'access_token=expired', csrfToken: 'good' })),
    ).resolves.toBe(true);
    expect(csrf.validateToken).not.toHaveBeenCalled();
  });

  it('多个 Cookie 共存时只取 access_token 的值', async () => {
    csrf.validateToken.mockResolvedValue(true);

    await guard.canActivate(
      createContext({ cookie: 'theme=dark; access_token=session-jwt; other=1', csrfToken: 'good' }),
    );

    expect(jwt.verifyAsync).toHaveBeenCalledWith('session-jwt');
  });

  it('登录接口豁免：带着旧 Cookie 换账号重新登录不该被 CSRF 挡住', async () => {
    await expect(
      guard.canActivate(
        createContext({ method: 'POST', cookie: 'access_token=old-session', url: '/api/v1/auth/login' }),
      ),
    ).resolves.toBe(true);
    expect(csrf.validateToken).not.toHaveBeenCalled();
  });
});
