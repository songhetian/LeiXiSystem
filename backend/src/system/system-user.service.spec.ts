import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SystemUserService } from './system-user.service';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';

function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    role: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    permission: { findMany: jest.fn() },
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
    department: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    position: { findUnique: jest.fn(), findFirst: jest.fn() },
    employee: { create: jest.fn(), count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
    operationLog: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
  };
}

function createMockRedis(enabled = false) {
  return { isEnabled: enabled, get: jest.fn(), set: jest.fn(), del: jest.fn() };
}

function createMockSettingsService(level = 'medium') {
  return {
    get: jest.fn().mockResolvedValue({ key: 'password_strength_level', value: level }),
  };
}

function createMockPermCache() {
  return { invalidateUser: jest.fn().mockResolvedValue(undefined) };
}

function createMockDataScope() {
  return { invalidateCache: jest.fn().mockResolvedValue(undefined) };
}

// 系统-用户/角色/部门域此前把码段语义写反：用户码用在角色上、角色码用在用户上、
// 「岗位不存在」用了「设置变更历史不存在」的码。全局过滤器会用中央文案覆盖抛出文案，
// 于是新建重名用户提示「用户不存在」、改不存在用户提示「用户重复」。
describe('SystemUserService — 错误码语义（码与实体必须一一对应）', () => {
  let service: SystemUserService;
  let prisma: ReturnType<typeof createMockPrisma>;

  async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
    try {
      await fn();
    } catch (e: any) {
      return e.getResponse?.() ?? e.response ?? e;
    }
    throw new Error('预期抛出异常，但未抛出');
  }

  beforeEach(() => {
    prisma = createMockPrisma();
    // 交互式事务：让回调以同一 mock 作为 tx 客户端执行
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma) as any);
    service = new SystemUserService(
      prisma as any,
      createMockRedis(false) as any,
      createMockSettingsService('medium') as any,
      createMockPermCache() as any,
      createMockDataScope() as any,
    );
  });

  afterEach(() => jest.clearAllMocks());

  it('用户名重复：必须提示「用户重复」，不得用 6101（用户不存在）倒挂', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin' });

    const payload = await catchPayload(() =>
      service.createUser({ username: 'admin', password: 'abcd1234', name: '张三', departmentId: 1 }),
    );

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_USER_DUPLICATE);
    expect(messageOf(payload.code)).toBe('用户名已存在');
  });

  it('用户不存在（更新）：必须提示「用户不存在」，不得用 6102（用户重复）倒挂', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateUser(9, { name: '张三' }));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_USER_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('用户不存在');
  });

  it('用户不存在（分配角色）：必须提示「用户不存在」', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.assignRoles(9, [1]));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_USER_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('用户不存在');
  });

  it('用户不存在（删除）：必须提示「用户不存在」', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.deleteUser(9));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_USER_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('用户不存在');
  });

  it('删除 admin 账户：必须提示「不能删除管理员账户」，不得用 6103（用户状态无效）', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', deletedAt: null });

    const payload = await catchPayload(() => service.deleteUser(1));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_USER_ADMIN_PROTECTED);
    expect(messageOf(payload.code)).toBe('不能删除管理员账户');
  });

  it('角色编码重复：必须提示「角色标识重复」，不得用 6201（角色不存在）倒挂', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 1, code: 'admin' });

    const payload = await catchPayload(() => service.createRole({ code: 'admin', name: '管理员' }));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_ROLE_DUPLICATE);
    expect(messageOf(payload.code)).toBe('角色编码已存在');
  });

  it('角色不存在（分配权限）：必须提示「角色不存在」，不得用 6202（角色标识重复）倒挂', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.assignPermissions(9, [1]));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_ROLE_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('角色不存在');
  });

  it('角色不存在（删除）：必须提示「角色不存在」', async () => {
    prisma.role.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.deleteRole(9));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_ROLE_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('角色不存在');
  });

  it('删除 admin 角色：必须提示「不能删除管理员角色」，不得留裸码', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 1, code: 'admin' });

    const payload = await catchPayload(() => service.deleteRole(1));

    expect(payload.code).toBe(ERROR_CODES.SYSTEM_ROLE_ADMIN_PROTECTED);
    expect(messageOf(payload.code)).toBe('不能删除管理员角色');
  });

  it('岗位不存在：必须提示「岗位不存在」，不得用 7202（变更历史不存在）', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue({ id: 1 });
    prisma.position.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() =>
      service.createUser({
        username: 'zhangsan',
        password: 'abcd1234',
        name: '张三',
        departmentId: 1,
        positionId: 99,
      }),
    );

    expect(payload.code).toBe(ERROR_CODES.POSITION_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('岗位不存在');
  });

  it('部门名称重复：必须提示「部门名称已存在」，不得留裸码', async () => {
    prisma.department.findFirst.mockResolvedValue({ id: 1, name: '技术部' });

    const payload = await catchPayload(() => service.createDepartment({ name: '技术部' }));

    expect(payload.code).toBe(ERROR_CODES.DEPARTMENT_NAME_EXISTS);
    expect(messageOf(payload.code)).toBe('部门名称已存在');
  });

  it('父部门不存在：必须提示「部门不存在」，不得留裸码', async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() =>
      service.createDepartment({ name: '技术部', parentId: 99 }),
    );

    expect(payload.code).toBe(ERROR_CODES.DEPARTMENT_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('部门不存在');
  });

  it('部门不存在（更新）：必须提示「部门不存在」，不得留裸码', async () => {
    prisma.department.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.updateDepartment(9, { name: '技术部' }));

    expect(payload.code).toBe(ERROR_CODES.DEPARTMENT_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('部门不存在');
  });

  it('部门下有子部门：删除部门必须提示「该部门下有子部门，不能删除」，不得留裸码', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 1, managerId: null });
    prisma.department.count.mockResolvedValue(2);

    const payload = await catchPayload(() => service.deleteDepartment(1));

    expect(payload.code).toBe(ERROR_CODES.DEPARTMENT_HAS_CHILDREN);
    expect(messageOf(payload.code)).toBe('该部门下有子部门，不能删除');
  });

  it('部门下有在职员工：删除部门必须提示「该部门下有在职员工，不能删除」，不得留裸码', async () => {
    prisma.department.findUnique.mockResolvedValue({ id: 1, managerId: null });
    prisma.department.count.mockResolvedValue(0);
    prisma.employee.count.mockResolvedValue(3);

    const payload = await catchPayload(() => service.deleteDepartment(1));

    expect(payload.code).toBe(ERROR_CODES.DEPARTMENT_HAS_EMPLOYEES);
    expect(messageOf(payload.code)).toBe('该部门下有在职员工，不能删除');
  });

  it('岗位名称重复：必须提示「岗位名称已存在」，不得用 7201（设置项不存在）', async () => {
    prisma.position.findFirst.mockResolvedValue({ id: 1, name: '工程师' });

    const payload = await catchPayload(() => service.createPosition({ name: '工程师' }));

    expect(payload.code).toBe(ERROR_CODES.POSITION_NAME_EXISTS);
    expect(messageOf(payload.code)).toBe('岗位名称已存在');
  });

  it('岗位不存在（删除）：必须提示「岗位不存在」，不得用 7202（设置历史记录不存在）', async () => {
    prisma.position.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.deletePosition(9));

    expect(payload.code).toBe(ERROR_CODES.POSITION_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('岗位不存在');
  });

  it('岗位下有员工：删除岗位必须提示「该岗位下有员工，不能删除」，不得用 7203（回滚值相同）', async () => {
    prisma.position.findUnique.mockResolvedValue({ id: 1, name: '工程师' });
    prisma.employee.count.mockResolvedValue(2);

    const payload = await catchPayload(() => service.deletePosition(1));

    expect(payload.code).toBe(ERROR_CODES.POSITION_IN_USE);
    expect(messageOf(payload.code)).toBe('该岗位下有员工，不能删除');
  });
});

describe('SystemUserService — 密码强度校验', () => {
  let service: SystemUserService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let settingsService: ReturnType<typeof createMockSettingsService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    // 交互式事务：让回调以同一 mock 作为 tx 客户端执行
    prisma.$transaction = jest.fn(async (cb: any) => cb(prisma) as any);
    const redis = createMockRedis(false);
    settingsService = createMockSettingsService('medium');
    service = new SystemUserService(prisma as any, redis as any, settingsService as any, createMockPermCache() as any, createMockDataScope() as any);
  });

  describe('createUser', () => {
    it('密码太短（<8位）时失败', async () => {
      await expect(
        service.createUser({ username: 'test', password: 'abc1234', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('密码只有字母没有数字时失败', async () => {
      await expect(
        service.createUser({ username: 'test', password: 'abcdefgh', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('密码只有数字没有字母时失败', async () => {
      await expect(
        service.createUser({ username: 'test', password: '12345678', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('密码为空时抛错', async () => {
      await expect(
        service.createUser({ username: 'test', password: '', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('密码包含字母+数字且长度>=8位时通过', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue({ id: 10, name: '技术部' });
      prisma.user.create.mockResolvedValue({
        id: 1, username: 'test', realName: 'test', status: 'active',
        roles: [],
      });
      const result = await service.createUser({ username: 'test', password: 'abcd1234', name: 'test', departmentId: 10 });
      expect(result.id).toBe(1);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('密码与用户名相同时失败', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.createUser({ username: 'testuser1', password: 'testuser1', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('常见弱密码时失败', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.createUser({ username: 'test', password: 'password1', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('弱等级下，6位密码可以通过', async () => {
      settingsService.get.mockResolvedValue({ key: 'password_strength_level', value: 'weak' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue({ id: 10, name: '技术部' });
      prisma.user.create.mockResolvedValue({
        id: 1, username: 'test', realName: 'test', status: 'active',
        roles: [],
      });
      const result = await service.createUser({ username: 'test', password: '123456', name: 'test', departmentId: 10 });
      expect(result.id).toBe(1);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('强等级下，需要大小写字母+数字+特殊字符', async () => {
      settingsService.get.mockResolvedValue({ key: 'password_strength_level', value: 'strong' });
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.createUser({ username: 'test', password: 'abcd123456', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('强等级下，满足条件的密码可以通过', async () => {
      settingsService.get.mockResolvedValue({ key: 'password_strength_level', value: 'strong' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue({ id: 10, name: '技术部' });
      prisma.user.create.mockResolvedValue({
        id: 1, username: 'test', realName: 'test', status: 'active',
        roles: [],
      });
      const result = await service.createUser({ username: 'test', password: 'Abcd1234!@', name: 'test', departmentId: 10 });
      expect(result.id).toBe(1);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('密码校验失败时返回正确的错误码', async () => {
      try {
        await service.createUser({ username: 'test', password: '123', name: 'test', departmentId: 1 });
      } catch (e: any) {
        expect(e.response.code).toBe(ERROR_CODES.SYSTEM_USER_PASSWORD_WEAK);
      }
    });

    /**
     * User.status 默认值是 pending，若不显式写 active：
     * 列表把 pending 渲染成「停用」，且登录处会拒绝非 active 账号，
     * 管理员刚创建（表单默认选「启用」）的账号当场无法登录。
     */
    it('未指定状态时默认创建为启用（active）', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue({ id: 10, name: '技术部' });
      prisma.user.create.mockResolvedValue({ id: 1, username: 'test', realName: 'test', status: 'active', roles: [] });

      await service.createUser({ username: 'test', password: 'abcd1234', name: 'test', departmentId: 10 });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'active' }) }),
      );
    });

    it('显式传入停用状态时按传入值写入', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue({ id: 10, name: '技术部' });
      prisma.user.create.mockResolvedValue({ id: 1, username: 'test', realName: 'test', status: 'disabled', roles: [] });

      await service.createUser({ username: 'test', password: 'abcd1234', name: 'test', departmentId: 10, status: 'disabled' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'disabled' }) }),
      );
    });

    it('用户名已存在时抛 ConflictException（与密码校验无关，验证流程）', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      await expect(
        service.createUser({ username: 'test', password: 'abcd1234', name: 'test', departmentId: 1 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('createUser — 所有用户都是员工（自动创建并绑定员工档案）', () => {
    it('创建账号时在同一事务内按指定部门/岗位创建并绑定员工档案', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue({ id: 10, name: '技术部' });
      prisma.position.findUnique.mockResolvedValue({ id: 5, name: '产品经理' });
      prisma.user.create.mockResolvedValue({
        id: 7, username: 'hr', realName: '人事', status: 'active', roles: [],
      });
      prisma.employee.create.mockResolvedValue({ id: 50, employeeNo: 'U0007', userId: 7 });

      await service.createUser({
        username: 'hr', password: 'abcd1234', name: '人事', departmentId: 10, positionId: 5,
      });

      // 员工档案必然被创建并绑定到该 userId，且带上指定的部门/岗位
      expect(prisma.employee.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 7, departmentId: 10, positionId: 5, employeeNo: 'U0007', name: '人事', status: 'active',
        }),
      }));
    });

    it('部门不存在时抛 NotFoundException 且不创建用户', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue(null);
      await expect(
        service.createUser({ username: 'hr', password: 'abcd1234', name: '人事', departmentId: 999 }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('指定的岗位不存在时抛 NotFoundException 且不创建用户', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.department.findUnique.mockResolvedValue({ id: 10, name: '技术部' });
      prisma.position.findUnique.mockResolvedValue(null);
      await expect(
        service.createUser({
          username: 'hr', password: 'abcd1234', name: '人事', departmentId: 10, positionId: 999,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, username: 'test' });
      prisma.user.update.mockResolvedValue({ id: 1 });
    });

    it('设置新密码时，密码太短抛错', async () => {
      await expect(
        service.updateUser(1, { password: '123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('设置新密码时，需要字母+数字且至少8位', async () => {
      await service.updateUser(1, { password: 'abcd1234' });
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('不传密码时正常更新', async () => {
      await service.updateUser(1, { name: 'newname' });
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('用户不存在时抛 NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateUser(999, { name: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('更新密码时，密码与用户名相同时失败', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, username: 'testuser123' });
      await expect(
        service.updateUser(1, { password: 'testuser123' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignRoles — 用户角色绑定', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, username: 'test' });
      prisma.userRole.deleteMany.mockResolvedValue({ count: 1 });
      prisma.userRole.createMany.mockResolvedValue({ count: 2 });
    });

    it('用户不存在时抛 NotFoundException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.assignRoles(999, [1])).rejects.toThrow(NotFoundException);
    });

    it('分配角色时先清空旧绑定再创建新绑定', async () => {
      const result = await service.assignRoles(1, [1, 2]);
      expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(prisma.userRole.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 1, roleId: 1 },
          { userId: 1, roleId: 2 },
        ],
      });
      expect(result).toEqual({ success: true });
    });

    it('传入空角色数组时只清空不创建，并清除权限缓存（Redis 未启用时也要失效内存缓存）', async () => {
      const redis = { isEnabled: false, del: jest.fn() };
      const settingsService = createMockSettingsService('medium');
      const cache = createMockPermCache();
      const svc = new SystemUserService(prisma as any, redis as any, settingsService as any, cache as any, createMockDataScope() as any);

      const result = await svc.assignRoles(1, []);

      expect(prisma.userRole.deleteMany).toHaveBeenCalled();
      expect(prisma.userRole.createMany).not.toHaveBeenCalled();
      // 权限缓存必须走 PermissionCacheService（同时覆盖 Redis 与进程内内存缓存），
      // 否则 Redis 关闭时旧角色权限最长残留 5 分钟。
      expect(cache.invalidateUser).toHaveBeenCalledWith(1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('createRole — 编码自动生成', () => {
    let service: SystemUserService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const redis = createMockRedis(false);
      const settingsService = createMockSettingsService('medium');
      service = new SystemUserService(prisma as any, redis as any, settingsService as any, createMockPermCache() as any, createMockDataScope() as any);
    });

    it('未传编码时自动生成（前缀 ROLE + 时间戳 + 随机），避免手填英文编码', async () => {
      prisma.role.create.mockResolvedValue({ id: 9, code: 'ROLE', name: '审计' });
      await service.createRole({ name: '审计' });
      const data = prisma.role.create.mock.calls[0][0].data;
      expect(data.code).toMatch(/^ROLE\d{17}$/);
      expect(data.name).toBe('审计');
    });

    it('自动生成时不做编码查重', async () => {
      prisma.role.create.mockResolvedValue({ id: 10, code: 'ROLE', name: '测试' });
      await service.createRole({ name: '测试' });
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
    });

    it('手工传码时仍做查重并抛冲突', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 1, code: 'admin' });
      await expect(service.createRole({ code: 'admin', name: '超管' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.role.create).not.toHaveBeenCalled();
    });
  });

  describe('部门管理（描述 / 启停 / 回收站 / 恢复）', () => {
    let service: SystemUserService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      prisma.$transaction = jest.fn(async (cb: any) => cb(prisma) as any);
      const redis = createMockRedis(false);
      const settingsService = createMockSettingsService('medium');
      service = new SystemUserService(prisma as any, redis as any, settingsService as any, createMockPermCache() as any, createMockDataScope() as any);
    });

    it('listDepartments 默认仅返回未删除部门并携带描述/状态/在册人数', async () => {
      prisma.department.findMany.mockResolvedValue([
        { id: 1, name: '技术部', parentId: null, managerId: 3, description: '研发', status: 'active', createdAt: new Date(), deletedAt: null, _count: { employees: 5 } },
        { id: 2, name: '产品部', parentId: null, managerId: 4, description: null, status: 'active', createdAt: new Date(), deletedAt: null, _count: { employees: 3 } },
      ]);
      const result = await service.listDepartments();
      const arg: any = prisma.department.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ deletedAt: null });
      expect(result[0].description).toBe('研发');
      expect(result[0].status).toBe('active');
      expect(result[0].employeeCount).toBe(5);
      expect(result[1].employeeCount).toBe(3);
    });

    it('listDepartments(true) 返回回收站（已删除）部门并计算在册人数', async () => {
      const deletedAt = new Date();
      prisma.department.findMany.mockResolvedValue([
        { id: 9, name: '旧部门', parentId: null, managerId: null, description: '已归档', status: 'active', createdAt: new Date(), deletedAt, _count: { employees: 0 } },
      ]);
      const result = await service.listDepartments(true);
      const arg: any = prisma.department.findMany.mock.calls[0][0];
      expect(arg.where.deletedAt).toBeUndefined();
      expect(result[0].deletedAt).toEqual(deletedAt);
      expect(result[0].employeeCount).toBe(0);
    });

    it('createDepartment 保存职责描述并默认状态为 active', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue({ id: 3, name: '市场部', parentId: null, managerId: null, description: '负责市场推广', status: 'active' });
      const result = await service.createDepartment({ name: '市场部', description: '负责市场推广' });
      expect(prisma.department.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: '市场部', description: '负责市场推广', status: 'active' }),
        }),
      );
      expect(result.status).toBe('active');
    });

    it('updateDepartment 可启停部门并更新职责描述', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1, name: '技术部', status: 'active' });
      prisma.department.update.mockResolvedValue({ id: 1, name: '技术部', description: '研发与测试', status: 'inactive' });
      const result = await service.updateDepartment(1, { status: 'inactive', description: '研发与测试' });
      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'inactive', description: '研发与测试' }),
        }),
      );
      expect(result.status).toBe('inactive');
    });

    it('deleteDepartment 仅被活跃员工阻止，离职员工不阻止移入回收站', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 2, name: '旧部门', deletedAt: null });
      prisma.department.count.mockResolvedValue(0); // 无子部门
      prisma.employee.count.mockResolvedValue(0); // 活跃滤后无在职员工（离职人员的计数被排除）
      await service.deleteDepartment(2);
      expect(prisma.employee.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'active' }) }),
      );
      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('deleteDepartment 软删除部门（移入回收站），restoreDepartment 可恢复', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1, name: '技术部', deletedAt: null });
      prisma.department.count.mockResolvedValue(0);
      prisma.employee.count.mockResolvedValue(0);
      await service.deleteDepartment(1);
      expect(prisma.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      // 恢复
      prisma.department.findUnique.mockResolvedValue({ id: 1, name: '技术部', deletedAt: new Date() });
      await service.restoreDepartment(1);
      expect(prisma.department.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { deletedAt: null } }),
      );
    });
  });

  /**
   * listDepartments(true) 走独立缓存 key `sys:departments:recycle`（TTL 30 分钟）。
   * 删除/恢复部门只失效了 `sys:departments` 而漏删回收站 key 时：
   * 刚删除的部门在回收站看不到（管理员误以为删除失败），刚恢复的部门又仍留在回收站。
   */
  describe('部门回收站缓存失效（Redis 启用时）', () => {
    let service: SystemUserService;
    let prisma: ReturnType<typeof createMockPrisma>;
    let redis: ReturnType<typeof createMockRedis>;

    beforeEach(() => {
      prisma = createMockPrisma();
      prisma.$transaction = jest.fn(async (cb: any) => cb(prisma) as any);
      redis = createMockRedis(true);
      service = new SystemUserService(
        prisma as any,
        redis as any,
        createMockSettingsService('medium') as any,
        createMockPermCache() as any,
        createMockDataScope() as any,
      );
    });

    it('deleteDepartment 移入回收站后同时失效回收站列表缓存', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1, name: '技术部', deletedAt: null, managerId: null });
      prisma.department.count.mockResolvedValue(0);
      prisma.employee.count.mockResolvedValue(0);
      prisma.department.update.mockResolvedValue({ id: 1, deletedAt: new Date() });

      await service.deleteDepartment(1);

      expect(redis.del).toHaveBeenCalledWith('sys:departments:recycle');
    });

    it('restoreDepartment 恢复后同时失效回收站列表缓存', async () => {
      prisma.department.findUnique.mockResolvedValue({ id: 1, name: '技术部', deletedAt: new Date(), managerId: null });
      prisma.department.update.mockResolvedValue({ id: 1, deletedAt: null });

      await service.restoreDepartment(1);

      expect(redis.del).toHaveBeenCalledWith('sys:departments:recycle');
    });
  });

  // ADR-0010：角色/部门负责人变化会改变「可见部门范围」（admin/hr=全量、manager=本部门+子部门），
  // 而该范围在 DataScopeService 中被缓存 5 分钟。若变更后不失效缓存，被降权的用户仍能在
  // 5 分钟内看到原范围内全部员工/报表，构成越权；升权用户则要等 5 分钟才生效。
  describe('数据可见范围缓存失效（角色 / 部门负责人变更）', () => {
    let service: SystemUserService;
    let prisma: ReturnType<typeof createMockPrisma>;
    let dataScope: ReturnType<typeof createMockDataScope>;

    beforeEach(() => {
      prisma = createMockPrisma();
      prisma.$transaction = jest.fn(async (cb: any) => cb(prisma) as any);
      dataScope = createMockDataScope();
      service = new SystemUserService(
        prisma as any,
        createMockRedis(false) as any,
        createMockSettingsService('medium') as any,
        createMockPermCache() as any,
        dataScope as any,
      );
    });

    it('assignRoles 修改用户角色后失效其数据可见范围缓存', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, username: 'u1' });
      prisma.userRole.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userRole.createMany.mockResolvedValue({ count: 1 });

      await service.assignRoles(1, [2]);

      expect(dataScope.invalidateCache).toHaveBeenCalledWith(1);
    });

    it('deleteRole 删除角色后失效所有持有该角色用户的数据可见范围缓存', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 5, code: 'manager' });
      prisma.userRole.findMany.mockResolvedValue([{ userId: 11 }, { userId: 12 }]);
      prisma.rolePermission.deleteMany.mockResolvedValue({ count: 0 });
      prisma.userRole.deleteMany.mockResolvedValue({ count: 2 });
      (prisma.role as any).delete = jest.fn().mockResolvedValue({ id: 5 });

      await service.deleteRole(5);

      expect(dataScope.invalidateCache).toHaveBeenCalledWith(11);
      expect(dataScope.invalidateCache).toHaveBeenCalledWith(12);
    });

    it('updateDepartment 更换负责人后失效新旧负责人的数据可见范围缓存', async () => {
      prisma.department.findUnique.mockResolvedValue({
        id: 3,
        name: '技术部',
        deletedAt: null,
        managerId: 100,
      });
      prisma.department.update.mockResolvedValue({
        id: 3,
        name: '技术部',
        parentId: null,
        managerId: 200,
        description: null,
        status: 'active',
      });
      prisma.employee.findUnique.mockResolvedValue({ id: 200 });
      prisma.employee.findMany.mockResolvedValue([
        { id: 100, userId: 21 },
        { id: 200, userId: 22 },
      ]);

      await service.updateDepartment(3, { managerId: 200 });

      expect(dataScope.invalidateCache).toHaveBeenCalledWith(21);
      expect(dataScope.invalidateCache).toHaveBeenCalledWith(22);
    });

    it('createDepartment 指定负责人后失效该负责人的数据可见范围缓存', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.employee.findUnique.mockResolvedValue({ id: 400 });
      prisma.department.create.mockResolvedValue({
        id: 7,
        name: '市场部',
        parentId: null,
        managerId: 400,
        description: null,
        status: 'active',
      });
      prisma.employee.findMany.mockResolvedValue([{ id: 400, userId: 41 }]);

      await service.createDepartment({ name: '市场部', managerId: 400 });

      expect(dataScope.invalidateCache).toHaveBeenCalledWith(41);
    });

    it('deleteDepartment 移入回收站后失效该部门负责人的数据可见范围缓存', async () => {
      prisma.department.findUnique.mockResolvedValue({
        id: 4,
        name: '旧部门',
        deletedAt: null,
        managerId: 300,
      });
      prisma.department.count.mockResolvedValue(0);
      prisma.employee.count.mockResolvedValue(0);
      prisma.department.update.mockResolvedValue({ id: 4, deletedAt: new Date() });
      prisma.employee.findMany.mockResolvedValue([{ id: 300, userId: 31 }]);

      await service.deleteDepartment(4);

      expect(dataScope.invalidateCache).toHaveBeenCalledWith(31);
    });
  });
});
