import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LocalFallbackStore } from '../common/local-fallback-store';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';
import * as bcrypt from 'bcryptjs';

// Mock PrismaService
function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

// Mock JwtService
function createMockJwt() {
  return {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as any;
}

// Mock LoginRateLimitService
function createMockRateLimit() {
  return {
    assertNotBlocked: jest.fn().mockResolvedValue(undefined),
    registerFailure: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
  } as any;
}

// Mock RedisService
function createMockRedis() {
  return {
    isEnabled: true,
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as any;
}

// Mock EventEmitter2
function createMockEventEmitter() {
  return {
    emit: jest.fn(),
  } as any;
}

// Mock SettingsService
function createMockSettingsService(level = 'medium') {
  return {
    get: jest.fn().mockResolvedValue({ key: 'password_strength_level', value: level }),
  };
}

function createMockPermCache() {
  return {
    getUserInfo: jest.fn(),
    invalidateUser: jest.fn(),
  };
}

describe('AuthService - 单设备登录 (Q16)', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwt>;
  let rateLimit: ReturnType<typeof createMockRateLimit>;
  let redis: ReturnType<typeof createMockRedis>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;
  let settingsService: ReturnType<typeof createMockSettingsService>;

  const mockUser = {
    id: 1,
    username: 'admin',
    passwordHash: bcrypt.hashSync('123456', 10),
    name: '管理员',
    status: 'active',
    deletedAt: null,
    roles: [
      {
        role: {
          permissions: [
            { permission: { code: 'dashboard:view' } },
          ],
        },
      },
    ],
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    jwt = createMockJwt();
    rateLimit = createMockRateLimit();
    redis = createMockRedis();
    eventEmitter = createMockEventEmitter();
    settingsService = createMockSettingsService('medium');
    const permCache = createMockPermCache();
    service = new AuthService(prisma, jwt, rateLimit, redis, eventEmitter, settingsService as any, permCache as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // login — stores session token in Redis on successful login
  // ----------------------------------------------------------------
  it('stores session token in Redis on successful login', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    jwt.signAsync.mockResolvedValue('new-token-123');
    redis.get.mockResolvedValue(null); // No existing session

    const result = await service.login('admin', '123456');

    expect(result.accessToken).toBe('new-token-123');
    expect(redis.set).toHaveBeenCalledWith(
      'user:session:1',
      'new-token-123',
      expect.any(Number),
    );
  });

  // ----------------------------------------------------------------
  // login — emits auth.session_replaced when existing session found
  // ----------------------------------------------------------------
  it('emits auth.session_replaced when replacing an existing session', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    jwt.signAsync.mockResolvedValue('new-token-456');
    redis.get.mockResolvedValue('old-token-123'); // Existing session

    await service.login('admin', '123456');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'auth.session_replaced',
      expect.objectContaining({
        userId: 1,
        message: expect.stringContaining('其他设备'),
      }),
    );
    // New token should overwrite old
    expect(redis.set).toHaveBeenCalledWith(
      'user:session:1',
      'new-token-456',
      expect.any(Number),
    );
  });

  // ----------------------------------------------------------------
  // login — does not emit kicked_out when no existing session
  // ----------------------------------------------------------------
  it('does not emit auth.session_replaced when no existing session', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    jwt.signAsync.mockResolvedValue('first-token');
    redis.get.mockResolvedValue(null);

    await service.login('admin', '123456');

    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'auth.session_replaced',
      expect.anything(),
    );
  });

  // ----------------------------------------------------------------
  // login — works when Redis is disabled (no session storage)
  // ----------------------------------------------------------------
  it('works without Redis (Redis disabled, no session storage)', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    jwt.signAsync.mockResolvedValue('token-no-redis');
    redis.isEnabled = false;

    const result = await service.login('admin', '123456');

    expect(result.accessToken).toBe('token-no-redis');
    expect(redis.set).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // login — invalidates stale perm cache so admin gets fresh permissions
  // （避免 seed.ts 重建角色权限后，admin 还要重登一次才生效）
  // ----------------------------------------------------------------
  it('invalidates perm cache on login so role changes take effect immediately', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    jwt.signAsync.mockResolvedValue('fresh-token');
    redis.get.mockResolvedValue(null);

    const permCache = (service as any).permCache;
    await service.login('admin', '123456');

    expect(permCache.invalidateUser).toHaveBeenCalledWith(1);
  });

  // ----------------------------------------------------------------
  // login — same token re-login does not trigger kicked_out
  // ----------------------------------------------------------------
  it('does not emit kicked_out when re-login with the same token', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    jwt.signAsync.mockResolvedValue('same-token');
    redis.get.mockResolvedValue('same-token'); // Same token

    await service.login('admin', '123456');

    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'auth.session_replaced',
      expect.anything(),
    );
  });

  // ----------------------------------------------------------------
  // login — still rejects wrong password
  // ----------------------------------------------------------------
  it('rejects wrong password and does not store session', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(service.login('admin', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(redis.set).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // login — 软删除账号不得登录（密码正确也不行）
  // ----------------------------------------------------------------
  it('软删除账号即使密码正确也不能登录', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      deletedAt: new Date('2026-09-01'),
    });

    await expect(service.login('admin', '123456')).rejects.toThrow(
      ForbiddenException,
    );

    expect(redis.set).not.toHaveBeenCalled();
    expect(rateLimit.reset).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // login — 停用账号不得登录（密码正确也不行）
  // ----------------------------------------------------------------
  it('停用账号即使密码正确也不能登录', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 'disabled' });

    await expect(service.login('admin', '123456')).rejects.toThrow(
      ForbiddenException,
    );

    expect(redis.set).not.toHaveBeenCalled();
    expect(rateLimit.reset).not.toHaveBeenCalled();
  });
});

describe('AuthService - changePassword 密码强度校验', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwt>;
  let rateLimit: ReturnType<typeof createMockRateLimit>;
  let redis: ReturnType<typeof createMockRedis>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;
  let settingsService: ReturnType<typeof createMockSettingsService>;

  const mockUser = {
    id: 1,
    username: 'admin',
    passwordHash: bcrypt.hashSync('oldPass123', 10),
    name: '管理员',
    roles: [],
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    jwt = createMockJwt();
    rateLimit = createMockRateLimit();
    redis = createMockRedis();
    eventEmitter = createMockEventEmitter();
    settingsService = createMockSettingsService('medium');
    const permCache = createMockPermCache();
    service = new AuthService(prisma, jwt, rateLimit, redis, eventEmitter, settingsService as any, permCache as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('原密码错误时抛出 ForbiddenException', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.changePassword(1, 'wrongPass', 'newPass123'),
    ).rejects.toThrow(ForbiddenException);
  });

  /**
   * 「原密码错误」曾复用 5003（=无权限访问该数据）。前端 axios 拦截器
   * （frontend/src/lib/request.ts L58）对 5003 特意**不弹全局 toast**，
   * 而修改密码页（profile/page.tsx）的 catch 又把它当校验错误吞掉，
   * 于是原密码填错时用户得不到任何反馈（静默失败）。
   */
  it('原密码错误应返回专属码 5016「原密码错误」，而非被前端静默的 5003', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const err = await service.changePassword(1, 'wrongPass', 'newPass123').catch((e) => e);
    const payload = (err as any)?.getResponse?.() ?? (err as any)?.response ?? err;

    expect(payload.code).toBe(ERROR_CODES.AUTH_OLD_PASSWORD_WRONG);
    expect(messageOf(payload.code)).toBe('原密码错误');
    expect(payload.code).not.toBe(ERROR_CODES.DATA_NO_PERMISSION);
  });

  it('新密码太短（<8位）时失败', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.changePassword(1, 'oldPass123', 'abc1234'),
    ).rejects.toThrow(BadRequestException);
  });

  it('新密码只有字母没有数字时失败', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.changePassword(1, 'oldPass123', 'abcdefgh'),
    ).rejects.toThrow(BadRequestException);
  });

  it('新密码只有数字没有字母时失败', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.changePassword(1, 'oldPass123', '12345678'),
    ).rejects.toThrow(BadRequestException);
  });

  it('新密码符合要求时成功', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ id: 1 });
    const result = await service.changePassword(1, 'oldPass123', 'newPass123');
    expect(result).toBe(true);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('新密码与用户名相同时失败', async () => {
    const userWithLongName = {
      ...mockUser,
      username: 'testuser123',
    };
    prisma.user.findUnique.mockResolvedValue(userWithLongName);
    await expect(
      service.changePassword(1, 'oldPass123', 'testuser123'),
    ).rejects.toThrow(BadRequestException);
  });

  it('新密码是常见弱密码时失败', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.changePassword(1, 'oldPass123', 'password1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('弱等级下，6位密码可以通过', async () => {
    settingsService.get.mockResolvedValue({ key: 'password_strength_level', value: 'weak' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ id: 1 });
    const result = await service.changePassword(1, 'oldPass123', '123456');
    expect(result).toBe(true);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('强等级下，需要大小写字母+数字+特殊字符', async () => {
    settingsService.get.mockResolvedValue({ key: 'password_strength_level', value: 'strong' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      service.changePassword(1, 'oldPass123', 'abcd123456'),
    ).rejects.toThrow(BadRequestException);
  });

  it('强等级下，满足条件的密码可以通过', async () => {
    settingsService.get.mockResolvedValue({ key: 'password_strength_level', value: 'strong' });
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ id: 1 });
    const result = await service.changePassword(1, 'oldPass123', 'Abcd1234!@');
    expect(result).toBe(true);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('修改密码后将会话置为撤销哨兵值，使已签发的 token 立即失效', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ id: 1 });
    await service.changePassword(1, 'oldPass123', 'newPass123');
    // 不能仅删除 key：JwtAuthGuard 对「无会话记录」采取 fail-open（Redis 重启不误踢全员），
    // 必须写入一个与任何真实 JWT 都不相等的非空哨兵值，旧 token 才会在守卫处被拒。
    const stored = (redis.set as jest.Mock).mock.calls.find(
      (c) => c[0] === 'user:session:1',
    )?.[1];
    expect(stored).toEqual(expect.any(String));
    expect(stored).not.toBe('');
  });

  it('改密后重新登录不会误报「被迫下线」', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      roles: [],
      status: 'active',
      deletedAt: null,
    });
    jwt.signAsync.mockResolvedValue('brand-new-token');
    // 会话被改密置为撤销哨兵；用户自己重新登录不应收到「其他设备登录」提示
    redis.get.mockResolvedValue('__revoked__');

    await service.login('admin', 'oldPass123');

    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'auth.session_replaced',
      expect.anything(),
    );
    expect(redis.set).toHaveBeenCalledWith(
      'user:session:1',
      'brand-new-token',
      expect.any(Number),
    );
  });
});

/**
 * 隐私二级密码：工资条等高敏数据的独立二次验证密码。
 * - 未设置（privacyPasswordHash = null）时工资条验证回退登录密码，兼容存量用户；
 * - 设置后仅认隐私密码；忘记时可用登录密码重置。
 */
describe('AuthService - 隐私二级密码', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  const LOGIN_HASH = bcrypt.hashSync('loginPass123', 10);
  const PRIVACY_HASH = bcrypt.hashSync('654321', 10);
  const mockUser = {
    id: 1,
    username: 'admin',
    passwordHash: LOGIN_HASH,
    privacyPasswordHash: null as string | null,
    status: 'active',
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    const jwt = createMockJwt();
    const rateLimit = createMockRateLimit();
    const eventEmitter = createMockEventEmitter();
    const settingsService = createMockSettingsService('medium');
    const permCache = createMockPermCache();
    service = new AuthService(prisma, jwt, rateLimit, redis, eventEmitter, settingsService as any, permCache as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getPrivacyPasswordStatus', () => {
    it('未设置：enabled = false', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: null });
      expect(await service.getPrivacyPasswordStatus(1)).toEqual({ enabled: false });
    });

    it('已设置：enabled = true', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: PRIVACY_HASH });
      expect(await service.getPrivacyPasswordStatus(1)).toEqual({ enabled: true });
    });
  });

  describe('setPrivacyPassword — 首次设置', () => {
    it('无需旧密码即可设置，且存储的是 bcrypt 哈希而非明文', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: null });

      await service.setPrivacyPassword(1, '123456');

      expect(prisma.user.update).toHaveBeenCalledTimes(1);
      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data.privacyPasswordHash).not.toBe('123456');
      expect(bcrypt.compareSync('123456', data.privacyPasswordHash)).toBe(true);
    });
  });

  describe('setPrivacyPassword — 修改（已设置过）', () => {
    it('已设置但未提供旧密码：抛 400 专属码「请输入原二级密码」', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: PRIVACY_HASH });

      const err = await service.setPrivacyPassword(1, '999888').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      // 全局过滤器按 code 取中央文案覆盖 message，共用 4000 会变成「参数校验失败」
      expect(err.getResponse().code).toBe(ERROR_CODES.AUTH_PRIVACY_OLD_PASSWORD_REQUIRED);
      expect(messageOf(err.getResponse().code)).toBe('请输入原二级密码');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('旧二级密码错误：抛 401 专属码，「原二级密码错误」', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: PRIVACY_HASH });

      const err = await service.setPrivacyPassword(1, '999888', '000000').catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.getResponse().code).toBe(ERROR_CODES.AUTH_PRIVACY_PASSWORD_WRONG);
      expect(messageOf(err.getResponse().code)).toBe('原二级密码错误');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('旧二级密码正确：更新为新密码哈希', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: PRIVACY_HASH });

      await service.setPrivacyPassword(1, '999888', '654321');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(bcrypt.compareSync('999888', data.privacyPasswordHash)).toBe(true);
      expect(bcrypt.compareSync('654321', data.privacyPasswordHash)).toBe(false);
    });

    it('不能用登录密码冒充旧二级密码通过修改校验', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: PRIVACY_HASH });

      await expect(service.setPrivacyPassword(1, '999888', 'loginPass123')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPrivacyPassword — 忘记二级密码时用登录密码重置', () => {
    it('登录密码错误：抛 401 专属码，「登录密码错误」', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: PRIVACY_HASH });

      const err = await service.resetPrivacyPassword(1, 'wrongLogin', '123456').catch((e) => e);
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect(err.getResponse().code).toBe(ERROR_CODES.AUTH_LOGIN_PASSWORD_WRONG);
      expect(messageOf(err.getResponse().code)).toBe('登录密码错误');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('登录密码正确：重置二级密码（无需旧二级密码）', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: PRIVACY_HASH });

      await service.resetPrivacyPassword(1, 'loginPass123', '123456');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(bcrypt.compareSync('123456', data.privacyPasswordHash)).toBe(true);
    });

    it('未设置过二级密码时也允许直接用登录密码设置', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, privacyPasswordHash: null });

      await service.resetPrivacyPassword(1, 'loginPass123', '123456');

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(bcrypt.compareSync('123456', data.privacyPasswordHash)).toBe(true);
    });
  });
});

/**
 * S23 / A3 端到端链路（故障注入）：Redis 已配置但不可用，
 * 登出仍必须把 jti 写进进程内黑名单，且守卫读得到 → 旧 token 立即 401。
 */
describe('AuthService - Redis 故障时登出仍写本地黑名单', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: ReturnType<typeof createMockJwt>;
  let redis: any;
  let local: LocalFallbackStore;

  const payload = { sub: 1, username: 'admin', jti: 'j1' };
  const OLD_TOKEN = 'old-token';

  beforeEach(() => {
    prisma = createMockPrisma();
    jwt = createMockJwt();
    redis = {
      isEnabled: true,
      isAvailable: jest.fn().mockReturnValue(false),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    local = new LocalFallbackStore();
    service = new AuthService(
      prisma,
      jwt,
      createMockRateLimit(),
      redis,
      createMockEventEmitter(),
      createMockSettingsService('medium') as any,
      createMockPermCache() as any,
      local,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    local.onModuleDestroy();
  });

  it('logout 双写黑名单：Redis 读不到时本地镜像让旧 token 立即失效', async () => {
    jwt.verifyAsync.mockResolvedValue({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 });

    await service.logout(OLD_TOKEN);

    expect(local.get('auth:blacklist:j1')).toBe('1');
    expect(redis.set).toHaveBeenCalledWith('auth:blacklist:j1', '1', expect.any(Number));

    // 同一台实例上的守卫：Redis 返回 null，只能靠本地镜像命中黑名单
    const guard = new JwtAuthGuard(jwt, redis, local);
    const req: any = { headers: { cookie: `access_token=${OLD_TOKEN}` } };
    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => req }),
    };

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
