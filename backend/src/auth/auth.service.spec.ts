import { AuthService } from './auth.service';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
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

  it('修改密码成功后清除 session', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.update.mockResolvedValue({ id: 1 });
    await service.changePassword(1, 'oldPass123', 'newPass123');
    expect(redis.del).toHaveBeenCalledWith('user:session:1');
  });
});
