import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * 单设备登录（Q16）的会话校验。
 *
 * 背景：login() 会把当前 JWT 写入 Redis `user:session:{userId}`，
 * 但守卫此前只校验签名与黑名单，从不读取该 key，
 * 导致「在其他设备登录后旧 token 被迫下线」与「改密后旧会话失效」全部形同虚设。
 */
function createContext(token: string): any {
  const req: any = { headers: { cookie: `access_token=${token}` } };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    __req: req,
  };
}

describe('JwtAuthGuard - 会话（单设备登录）校验', () => {
  let guard: JwtAuthGuard;
  let jwt: any;
  let redis: any;

  beforeEach(() => {
    jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 1, username: 'admin', jti: 'j1' }),
    };
    redis = {
      isEnabled: true,
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    guard = new JwtAuthGuard(jwt, redis);
  });

  it('会话 token 与请求 token 不一致时拒绝（旧设备已被顶下线）', async () => {
    redis.get.mockImplementation(async (key: string) =>
      key.startsWith('auth:blacklist:') ? null : 'token-from-new-device',
    );

    await expect(guard.canActivate(createContext('stale-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('会话 token 与请求 token 一致时放行并挂载 req.user', async () => {
    redis.get.mockImplementation(async (key: string) =>
      key.startsWith('auth:blacklist:') ? null : 'current-token',
    );
    const ctx = createContext('current-token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.__req.user).toEqual({ id: 1, username: 'admin' });
  });

  it('Redis 中无会话记录（重启/清空）时放行，避免全站误踢', async () => {
    redis.get.mockResolvedValue(null);

    await expect(guard.canActivate(createContext('any-token'))).resolves.toBe(true);
  });

  it('jti 命中黑名单时拒绝（退出登录回归）', async () => {
    redis.get.mockImplementation(async (key: string) =>
      key.startsWith('auth:blacklist:') ? '1' : 'current-token',
    );

    await expect(guard.canActivate(createContext('current-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('Redis 未启用时仅校验签名，不做会话校验', async () => {
    redis.isEnabled = false;

    await expect(guard.canActivate(createContext('any-token'))).resolves.toBe(true);
    expect(redis.get).not.toHaveBeenCalled();
  });
});
