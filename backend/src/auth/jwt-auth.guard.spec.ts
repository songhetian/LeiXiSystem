import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LocalFallbackStore } from '../common/local-fallback-store';

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

/**
 * S23 / A3 / D2 ①：RedisService.get 在连接故障时静默返回 null，若只看 Redis，
 * 「登出后复用旧 token」「其他设备登录」「改密后旧 token」三道校验全部失效。
 * AuthService 会双写进程内镜像，守卫必须在 Redis 返回 null 时继续读本地。
 */
describe('JwtAuthGuard - Redis 故障时本地镜像兜底（S23 A3）', () => {
  let guard: JwtAuthGuard;
  let jwt: any;
  let redis: any;
  let local: LocalFallbackStore;

  beforeEach(() => {
    jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 1, username: 'admin', jti: 'j1' }),
    };
    redis = {
      isEnabled: true,
      // 已配置 REDIS_URL 但连接未就绪（isAvailable 为 false 时 get 恒为 null）
      isAvailable: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue(null),
    };
    local = new LocalFallbackStore();
    guard = new JwtAuthGuard(jwt, redis, local);
  });

  afterEach(() => local.onModuleDestroy());

  it('本地黑名单命中 → 401（登出后复用旧 token 的场景）', async () => {
    local.set('auth:blacklist:j1', '1', 60);

    await expect(guard.canActivate(createContext('any-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('本地会话与 token 内 session 不一致 → 401（新设备已踢掉旧设备）', async () => {
    local.set('user:session:1', 'token-from-new-device', 60);

    await expect(guard.canActivate(createContext('stale-token'))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('本地会话与请求 token 一致 → 放行并挂载 req.user', async () => {
    local.set('user:session:1', 'current-token', 60);
    const ctx = createContext('current-token');

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.__req.user).toEqual({ id: 1, username: 'admin' });
  });

  it('改密后本地写入撤销哨兵 → 旧 token 401，随后重新登录的新 token 放行', async () => {
    local.set('user:session:1', '__revoked__', 60);
    await expect(guard.canActivate(createContext('old-token'))).rejects.toThrow(
      UnauthorizedException,
    );

    // 重新登录：AuthService 覆盖本地会话为新 token
    local.set('user:session:1', 'new-token', 60);
    await expect(guard.canActivate(createContext('new-token'))).resolves.toBe(true);
  });

  it('本地与 Redis 均无记录 → 放行（避免 Redis 重启后全站误踢）', async () => {
    await expect(guard.canActivate(createContext('any-token'))).resolves.toBe(true);
  });

  it('Redis 未配置时本地黑名单依然生效（不依赖 Redis 读取）', async () => {
    redis.isEnabled = false;
    local.set('auth:blacklist:j1', '1', 60);

    await expect(guard.canActivate(createContext('any-token'))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(redis.get).not.toHaveBeenCalled();
  });
});
