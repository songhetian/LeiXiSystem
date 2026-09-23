import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { SystemUserService } from './system-user.service';
import { ERROR_CODES } from '../common/error-codes';

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
    position: { findUnique: jest.fn() },
    employee: { create: jest.fn(), count: jest.fn() },
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
    service = new SystemUserService(prisma as any, redis as any, settingsService as any);
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

    it('传入空角色数组时只清空不创建，并清除权限缓存', async () => {
      const redis = { isEnabled: true, del: jest.fn() };
      const settingsService = createMockSettingsService('medium');
      const svc = new SystemUserService(prisma as any, redis as any, settingsService as any);

      const result = await svc.assignRoles(1, []);

      expect(prisma.userRole.deleteMany).toHaveBeenCalled();
      expect(prisma.userRole.createMany).not.toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('user:perm:1');
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
      service = new SystemUserService(prisma as any, redis as any, settingsService as any);
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
      service = new SystemUserService(prisma as any, redis as any, settingsService as any);
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
});
