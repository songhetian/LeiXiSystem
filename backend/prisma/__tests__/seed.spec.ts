import { PERMISSIONS, ADMIN_PERMISSIONS, STAFF_PERMISSIONS, buildUserPermCacheKeys, invalidateUserPermCache } from '../seed';

describe('prisma/seed.ts 权限点契约', () => {
  const seedCodes: string[] = (PERMISSIONS as readonly { code: string }[]).map((p) => p.code);
  const adminSet: Set<string> = new Set<string>(ADMIN_PERMISSIONS as string[]);
  const staffArr: string[] = STAFF_PERMISSIONS as string[];

  it('PERMISSIONS 不应包含角色 code（如 admin / staff）', () => {
    expect(seedCodes).not.toContain('admin');
    expect(seedCodes).not.toContain('staff');
  });

  it('所有 controller 实际用到的权限点都在 PERMISSIONS 中', () => {
    // 与 backend/src 下 @RequirePermission('xxx') 保持同步
    const used = [
      'approval:apply', 'approval:manage', 'approval:submitted:view', 'approval:todo:view', 'approval:workflow:manage',
      'attendance:appeal:apply', 'attendance:appeal:view', 'attendance:deduction:manage', 'attendance:deduction:view',
      'attendance:exception:manage', 'attendance:exception:view', 'attendance:location:manage',
      'attendance:manage', 'attendance:view',
      'cert_request:manage', 'cert_request:view', 'certificate:manage', 'certificate:view',
      'contract:manage', 'contract:view', 'department:manage', 'dict:manage', 'dict:view',
      'employee:manage', 'employee:tag:manage', 'employee:view',
      'finance:budget:manage', 'finance:budget:view', 'finance:expense-standard:manage', 'finance:expense-standard:view',
      'helpdesk:manage', 'helpdesk:sla:manage', 'helpdesk:view',
      'knowledge:manage', 'knowledge:view',
      'okr:manage', 'okr:view',
      'onboarding:manage', 'onboarding:view',
      'payroll:manage', 'payroll:view',
      'performance:cycle:manage', 'performance:goal:manage', 'performance:review:manage', 'performance:view',
      'position:manage', 'probation:apply', 'probation:manage', 'probation:view',
      'reimbursement:manage', 'reimbursement:view', 'reports:view',
      'resignation:apply', 'resignation:view', 'reward:manage', 'reward:view',
      'system:broadcast:manage', 'system:config:edit', 'system:log:view',
      'system:notification:send', 'system:notification:settings',
      'system:role:manage', 'system:role:view',
      'system:setting:update', 'system:setting:view',
      'system:user:manage', 'system:user:view',
      'training:manage', 'training:view', 'transfer:manage', 'transfer:view',
      'vacation:balance:adjust',
      'vacation:manage',
    ];
    const set = new Set<string>(seedCodes);
    for (const c of used) {
      expect(set.has(c)).toBe(true);
    }
  });

  it('ADMIN_PERMISSIONS 等于 PERMISSIONS 全部 code（超管拥有所有权限）', () => {
    expect(adminSet).toEqual(new Set<string>(seedCodes));
  });

  it('STAFF_PERMISSIONS 必须都来自 PERMISSIONS 集合', () => {
    const set = new Set<string>(seedCodes);
    for (const c of staffArr) {
      expect(set.has(c)).toBe(true);
    }
  });
});

describe('prisma/seed.ts invalidateUserPermCache', () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalPrefix = process.env.REDIS_KEY_PREFIX;

  afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
    if (originalPrefix === undefined) delete process.env.REDIS_KEY_PREFIX;
    else process.env.REDIS_KEY_PREFIX = originalPrefix;
  });

  describe('buildUserPermCacheKeys', () => {
    it('默认前缀为 leixi:', () => {
      expect(buildUserPermCacheKeys([1, 2, 3])).toEqual([
        'leixi:user:perm:1',
        'leixi:user:perm:2',
        'leixi:user:perm:3',
      ]);
    });

    it('支持自定义前缀', () => {
      expect(buildUserPermCacheKeys([7], 'test:')).toEqual(['test:user:perm:7']);
    });

    it('空数组返回空数组', () => {
      expect(buildUserPermCacheKeys([])).toEqual([]);
    });
  });

  describe('invalidateUserPermCache', () => {
    it('未配置 REDIS_URL 时静默跳过（不抛错）', async () => {
      delete process.env.REDIS_URL;
      const factory = jest.fn();
      await expect(invalidateUserPermCache([1, 2])).resolves.toBeUndefined();
      expect(factory).not.toHaveBeenCalled();
    });

    it('使用 factory 创建的 client 发起 del 调用', async () => {
      const del = jest.fn().mockResolvedValue(2);
      const connect = jest.fn().mockResolvedValue(undefined);
      const quit = jest.fn().mockResolvedValue(undefined);
      const factory = jest.fn().mockReturnValue({ connect, del, quit });

      await invalidateUserPermCache([10, 20], {
        redisUrl: 'redis://x',
        keyPrefix: 'leixi:',
        clientFactory: factory,
      });

      expect(factory).toHaveBeenCalledWith('redis://x');
      expect(connect).toHaveBeenCalledTimes(1);
      expect(del).toHaveBeenCalledWith('leixi:user:perm:10', 'leixi:user:perm:20');
      expect(quit).toHaveBeenCalledTimes(1);
    });

    it('空 userIds 不会调用 del', async () => {
      const del = jest.fn();
      const connect = jest.fn().mockResolvedValue(undefined);
      const quit = jest.fn().mockResolvedValue(undefined);
      const factory = jest.fn().mockReturnValue({ connect, del, quit });

      await invalidateUserPermCache([], {
        redisUrl: 'redis://x',
        clientFactory: factory,
      });

      expect(connect).toHaveBeenCalledTimes(1);
      expect(del).not.toHaveBeenCalled();
      expect(quit).toHaveBeenCalledTimes(1);
    });

    it('连接失败时不影响 seed 流程（捕获后调用 quit）', async () => {
      const del = jest.fn();
      const connect = jest.fn().mockRejectedValue(new Error('connect failed'));
      const quit = jest.fn().mockResolvedValue(undefined);
      const factory = jest.fn().mockReturnValue({ connect, del, quit });

      await expect(
        invalidateUserPermCache([1], { redisUrl: 'redis://x', clientFactory: factory }),
      ).resolves.toBeUndefined();
      expect(del).not.toHaveBeenCalled();
      expect(quit).toHaveBeenCalledTimes(1);
    });
  });
});
