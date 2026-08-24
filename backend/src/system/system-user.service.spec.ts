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
    role: { findMany: jest.fn() },
    permission: { findMany: jest.fn() },
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
    department: { findUnique: jest.fn(), count: jest.fn(), delete: jest.fn() },
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
});
