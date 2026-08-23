import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SettingsService } from '../settings/settings.service';
import { validatePasswordStrength, PasswordStrengthLevel } from '../common/password-strength.util';
import { ERROR_CODES } from '../common/error-codes';
import * as bcrypt from 'bcryptjs';

const DEPT_CACHE_KEY = 'sys:departments';
const DEPT_CACHE_TTL = 30 * 60;
const PASSWORD_STRENGTH_SETTING_KEY = 'password_strength_level';
const DEFAULT_PASSWORD_STRENGTH_LEVEL: PasswordStrengthLevel = 'medium';

@Injectable()
export class SystemUserService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private settingsService: SettingsService,
  ) {}

  async listUsers(params: {
    keyword?: string;
    roleId?: number;
    page: number;
    pageSize: number;
  }) {
    const { keyword, roleId, page, pageSize } = params;
    const where: any = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { realName: { contains: keyword } },
      ];
    }
    if (roleId) {
      where.roles = { some: { roleId } };
    }

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          roles: { include: { role: { select: { id: true, code: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    const formatted = list.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.realName,
      status: u.status,
      createdAt: u.createdAt,
      roles: u.roles.map((ur) => ur.role),
    }));
    return { list: formatted, total, page, pageSize };
  }

  async createUser(params: {
    username: string;
    password: string;
    name: string;
    roleIds?: number[];
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { username: params.username },
    });
    if (existing) {
      throw new ConflictException({ code: 6101, message: '用户名已存在' });
    }
    await this.validatePassword(params.password, params.username);
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: params.username,
        passwordHash,
        realName: params.name,
        roles: params.roleIds?.length
          ? { create: params.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    });
    return {
      id: user.id,
      username: user.username,
      name: user.realName,
      status: user.status,
      roles: user.roles.map((ur) => ur.role),
    };
  }

  async updateUser(id: number, params: {
    name?: string;
    status?: string;
    password?: string;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({ code: 6102, message: '用户不存在' });
    }
    const data: any = { realName: params.name, status: params.status };
    if (params.password) {
      await this.validatePassword(params.password, user.username);
      data.passwordHash = await bcrypt.hash(params.password, 10);
    }
    return this.prisma.user.update({ where: { id }, data });
  }

  async assignRoles(userId: number, roleIds: number[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: 6102, message: '用户不存在' });
    }
    await this.prisma.userRole.deleteMany({ where: { userId } });
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      });
    }
    if (this.redis.isEnabled) {
      await this.redis.del(`user:perm:${userId}`);
    }
    return { success: true };
  }

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { id: 'asc' }],
    });
  }

  async createRole(params: { code: string; name: string; description?: string }) {
    const existing = await this.prisma.role.findUnique({ where: { code: params.code } });
    if (existing) {
      throw new ConflictException({ code: 6201, message: '角色编码已存在' });
    }
    return this.prisma.role.create({ data: params });
  }

  async assignPermissions(roleId: number, permissionIds: number[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException({ code: 6202, message: '角色不存在' });
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
    }
    if (this.redis.isEnabled) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { roleId },
        select: { userId: true },
      });
      for (const ur of userRoles) {
        await this.redis.del(`user:perm:${ur.userId}`);
      }
    }
    return { success: true };
  }

  async deleteUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException({ code: 6102, message: '用户不存在' });
    }
    if (user.username === 'admin') {
      throw new ConflictException({ code: 6103, message: '不能删除管理员账户' });
    }
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    if (this.redis.isEnabled) {
      await this.redis.del(`user:perm:${id}`);
    }
    return { success: true };
  }

  async restoreUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({ code: 6102, message: '用户不存在' });
    }
    if (!user.deletedAt) {
      throw new ConflictException({ code: ERROR_CODES.SYSTEM_USER_NOT_DELETED, message: '用户未被删除，不可恢复' });
    }
    await this.prisma.user.update({ where: { id }, data: { deletedAt: null } });
    if (this.redis.isEnabled) {
      await this.redis.del(`user:perm:${id}`);
    }
    return { success: true };
  }

  async updateRole(id: number, params: { name?: string; description?: string }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException({ code: 6202, message: '角色不存在' });
    }
    return this.prisma.role.update({
      where: { id },
      data: { name: params.name, description: params.description },
    });
  }

  async deleteRole(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException({ code: 6202, message: '角色不存在' });
    }
    if (role.code === 'admin') {
      throw new ConflictException({ code: 6203, message: '不能删除管理员角色' });
    }
    // 先找出所有拥有该角色的用户，清除权限缓存
    if (this.redis.isEnabled) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { roleId: id },
        select: { userId: true },
      });
      for (const ur of userRoles) {
        await this.redis.del(`user:perm:${ur.userId}`);
      }
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.userRole.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  async listDepartments() {
    if (this.redis.isEnabled) {
      const cached = await this.redis.get(DEPT_CACHE_KEY);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
    }
    const data = await this.prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
      select: {
        id: true, name: true, parentId: true, managerId: true,
        manager: { select: { id: true, name: true, employeeNo: true } },
      },
    });
    if (this.redis.isEnabled) {
      await this.redis.set(DEPT_CACHE_KEY, JSON.stringify(data), DEPT_CACHE_TTL);
    }
    return data;
  }

  async createDepartment(dto: { name: string; parentId?: number; managerId?: number }) {
    const exists = await this.prisma.department.findFirst({ where: { name: dto.name, deletedAt: null } });
    if (exists) throw new ConflictException({ code: 7101, message: '部门名称已存在' });
    if (dto.parentId) {
      const parent = await this.prisma.department.findUnique({ where: { id: dto.parentId, deletedAt: null } });
      if (!parent) throw new NotFoundException({ code: 7102, message: '父部门不存在' });
    }
    if (dto.managerId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: dto.managerId } });
      if (!emp) throw new NotFoundException({ code: 7106, message: '负责人不存在' });
    }
    const result = await this.prisma.department.create({
      data: { name: dto.name, parentId: dto.parentId, managerId: dto.managerId },
      select: { id: true, name: true, parentId: true, managerId: true },
    });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
    }
    return result;
  }

  async updateDepartment(id: number, dto: { name?: string; parentId?: number | null; managerId?: number | null }) {
    const dept = await this.prisma.department.findUnique({ where: { id, deletedAt: null } });
    if (!dept) throw new NotFoundException({ code: 7102, message: '部门不存在' });
    if (dto.name && dto.name !== dept.name) {
      const exists = await this.prisma.department.findFirst({ where: { name: dto.name, deletedAt: null } });
      if (exists) throw new ConflictException({ code: 7101, message: '部门名称已存在' });
    }
    if (dto.parentId !== undefined && dto.parentId === id) {
      throw new ConflictException({ code: 7103, message: '不能将自己设为父部门' });
    }
    if (dto.managerId !== undefined && dto.managerId !== null) {
      const emp = await this.prisma.employee.findUnique({ where: { id: dto.managerId } });
      if (!emp) throw new NotFoundException({ code: 7106, message: '负责人不存在' });
    }
    const result = await this.prisma.department.update({
      where: { id },
      data: { name: dto.name, parentId: dto.parentId, managerId: dto.managerId },
      select: { id: true, name: true, parentId: true, managerId: true },
    });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
    }
    return result;
  }

  async deleteDepartment(id: number) {
    const dept = await this.prisma.department.findUnique({ where: { id, deletedAt: null } });
    if (!dept) throw new NotFoundException({ code: 7102, message: '部门不存在' });
    const children = await this.prisma.department.count({ where: { parentId: id, deletedAt: null } });
    if (children > 0) throw new ConflictException({ code: 7104, message: '该部门下有子部门，不能删除' });
    const empCount = await this.prisma.employee.count({ where: { departmentId: id } });
    if (empCount > 0) throw new ConflictException({ code: 7105, message: '该部门下有员工，不能删除' });
    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
    }
    return { success: true };
  }

  async restoreDepartment(id: number) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException({ code: 7102, message: '部门不存在' });
    if (!dept.deletedAt) {
      throw new ConflictException({ code: ERROR_CODES.DEPARTMENT_NOT_DELETED, message: '部门未被删除，不可恢复' });
    }
    await this.prisma.department.update({ where: { id }, data: { deletedAt: null } });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
    }
    return { success: true };
  }

  async listPositions() {
    return this.prisma.position.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
  }

  async createPosition(dto: { name: string }) {
    const exists = await this.prisma.position.findFirst({ where: { name: dto.name } });
    if (exists) throw new ConflictException({ code: 7201, message: '岗位名称已存在' });
    return this.prisma.position.create({
      data: { name: dto.name },
      select: { id: true, name: true },
    });
  }

  async updatePosition(id: number, dto: { name: string }) {
    const pos = await this.prisma.position.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException({ code: 7202, message: '岗位不存在' });
    if (dto.name !== pos.name) {
      const exists = await this.prisma.position.findFirst({ where: { name: dto.name } });
      if (exists) throw new ConflictException({ code: 7201, message: '岗位名称已存在' });
    }
    return this.prisma.position.update({
      where: { id },
      data: { name: dto.name },
      select: { id: true, name: true },
    });
  }

  async deletePosition(id: number) {
    const pos = await this.prisma.position.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException({ code: 7202, message: '岗位不存在' });
    const empCount = await this.prisma.employee.count({ where: { positionId: id } });
    if (empCount > 0) throw new ConflictException({ code: 7203, message: '该岗位下有员工，不能删除' });
    await this.prisma.position.delete({ where: { id } });
    return { success: true };
  }

  private async getPasswordStrengthLevel(): Promise<PasswordStrengthLevel> {
    try {
      const setting = await this.settingsService.get(PASSWORD_STRENGTH_SETTING_KEY);
      const value = setting.value;
      if (['weak', 'medium', 'strong'].includes(value)) {
        return value as PasswordStrengthLevel;
      }
      return DEFAULT_PASSWORD_STRENGTH_LEVEL;
    } catch {
      return DEFAULT_PASSWORD_STRENGTH_LEVEL;
    }
  }

  private async validatePassword(password: string, username?: string): Promise<void> {
    const level = await this.getPasswordStrengthLevel();
    const result = validatePasswordStrength(password, { level, username });
    if (!result.valid) {
      throw new BadRequestException({
        code: ERROR_CODES.SYSTEM_USER_PASSWORD_WEAK,
        message: result.errors.join('；'),
      });
    }
  }
}
