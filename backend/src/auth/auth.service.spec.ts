import { AuthService } from './auth.service';
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
