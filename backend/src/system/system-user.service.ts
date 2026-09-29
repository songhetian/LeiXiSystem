import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { PermissionCacheService } from '../common/permission-cache.service';
import { DataScopeService } from '../common/data-scope.service';
import { SettingsService } from '../settings/settings.service';
import { validatePasswordStrength, PasswordStrengthLevel } from '../common/password-strength.util';
import { ERROR_CODES } from '../common/error-codes';
import { generateAutoCode } from '../common/code-gen.util';
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
    private permCache: PermissionCacheService,
    private dataScope: DataScopeService,
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
    departmentId: number;
    positionId?: number;
    status?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { username: params.username },
    });
    if (existing) {
      throw new ConflictException({ code: ERROR_CODES.SYSTEM_USER_DUPLICATE, message: '用户名已存在' });
    }
    await this.validatePassword(params.password, params.username);

    // 所有用户都是员工：校验部门/岗位存在，作为员工档案的归属
    const department = await this.prisma.department.findUnique({
      where: { id: params.departmentId, deletedAt: null },
    });
    if (!department) {
      throw new NotFoundException({ code: ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '部门不存在' });
    }
    let position = null;
    if (params.positionId != null) {
      position = await this.prisma.position.findUnique({
        where: { id: params.positionId },
      });
      if (!position) {
        throw new NotFoundException({ code: ERROR_CODES.POSITION_NOT_FOUND, message: '岗位不存在' });
      }
    }

    const passwordHash = await bcrypt.hash(params.password, 10);

    // 用户 + 员工档案在同一事务中创建，保证“每个账号都绑定员工档案”这一不变量
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: params.username,
          passwordHash,
          realName: params.name,
          // User.status 数据库默认值 pending 并非「启用」，未显式写入会导致
          // 新建账号在列表显示为「停用」且无法登录，故默认置为 active。
          status: params.status || 'active',
          roles: params.roleIds?.length
            ? { create: params.roleIds.map((roleId) => ({ roleId })) }
            : undefined,
        },
        include: { roles: { include: { role: true } } },
      });
      await tx.employee.create({
        data: {
          employeeNo: `U${created.id.toString().padStart(4, '0')}`,
          name: params.name,
          departmentId: params.departmentId,
          positionId: params.positionId ?? null,
          hireDate: new Date(),
          status: 'active',
          userId: created.id,
        },
      });
      return created;
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
      throw new NotFoundException({ code: ERROR_CODES.SYSTEM_USER_NOT_FOUND, message: '用户不存在' });
    }
    const data: any = { realName: params.name, status: params.status };
    if (params.password) {
      await this.validatePassword(params.password, user.username);
      data.passwordHash = await bcrypt.hash(params.password, 10);
    }
    const updated = await this.prisma.user.update({ where: { id }, data });
    // 停用/启用或改密后必须让在线会话立即重新回源校验，否则停用不生效
    await this.permCache.invalidateUser(id);
    return updated;
  }

  async assignRoles(userId: number, roleIds: number[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: ERROR_CODES.SYSTEM_USER_NOT_FOUND, message: '用户不存在' });
    }
    await this.prisma.userRole.deleteMany({ where: { userId } });
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      });
    }
    await this.permCache.invalidateUser(userId);
    // 角色决定「可见部门范围」（admin/hr=全量、manager=本部门+子部门），
    // 改角色后不清数据范围缓存会让降权用户 5 分钟内仍可见原范围数据。
    await this.dataScope.invalidateCache(userId);
    return { success: true };
  }

  /**
   * 部门负责人变化会影响其「可见部门范围」（ADR-0010：manager 可见负责部门及子部门）。
   * 入参为员工 ID（department.managerId 引用的是员工），需换算成账号 ID 后再失效缓存。
   */
  private async invalidateDataScopeForEmployees(employeeIds: Array<number | null | undefined>) {
    const ids = [...new Set(employeeIds.filter((v): v is number => typeof v === 'number'))];
    if (ids.length === 0) return;
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { userId: true },
    });
    for (const emp of employees) {
      if (emp.userId) await this.dataScope.invalidateCache(emp.userId);
    }
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

  /**
   * 新建角色。编码可留空，由后端自动生成（前缀 ROLE + 时间戳 + 随机），避免手填英文编码。
   * 注意：系统预置角色（admin/employee 等）由种子脚本按固定编码写入，不受此处影响。
   */
  async createRole(params: { code?: string; name: string; description?: string }) {
    const code = params.code || generateAutoCode('ROLE');
    if (params.code) {
      const existing = await this.prisma.role.findUnique({ where: { code } });
      if (existing) {
        throw new ConflictException({ code: ERROR_CODES.SYSTEM_ROLE_DUPLICATE, message: '角色编码已存在' });
      }
    }
    return this.prisma.role.create({ data: { ...params, code } });
  }

  async assignPermissions(roleId: number, permissionIds: number[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException({ code: ERROR_CODES.SYSTEM_ROLE_NOT_FOUND, message: '角色不存在' });
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
    }
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });
    for (const ur of userRoles) {
      await this.permCache.invalidateUser(ur.userId);
    }
    return { success: true };
  }

  async deleteUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException({ code: ERROR_CODES.SYSTEM_USER_NOT_FOUND, message: '用户不存在' });
    }
    if (user.username === 'admin') {
      throw new ConflictException({ code: ERROR_CODES.SYSTEM_USER_ADMIN_PROTECTED, message: '不能删除管理员账户' });
    }
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.permCache.invalidateUser(id);
    return { success: true };
  }

  async restoreUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({ code: ERROR_CODES.SYSTEM_USER_NOT_FOUND, message: '用户不存在' });
    }
    if (!user.deletedAt) {
      throw new ConflictException({ code: ERROR_CODES.SYSTEM_USER_NOT_DELETED, message: '用户未被删除，不可恢复' });
    }
    await this.prisma.user.update({ where: { id }, data: { deletedAt: null } });
    await this.permCache.invalidateUser(id);
    return { success: true };
  }

  async updateRole(id: number, params: { name?: string; description?: string }) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException({ code: ERROR_CODES.SYSTEM_ROLE_NOT_FOUND, message: '角色不存在' });
    }
    return this.prisma.role.update({
      where: { id },
      data: { name: params.name, description: params.description },
    });
  }

  async deleteRole(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException({ code: ERROR_CODES.SYSTEM_ROLE_NOT_FOUND, message: '角色不存在' });
    }
    if (role.code === 'admin') {
      throw new ConflictException({ code: ERROR_CODES.SYSTEM_ROLE_ADMIN_PROTECTED, message: '不能删除管理员角色' });
    }
    // 先找出所有拥有该角色的用户，清除权限缓存
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId: id },
      select: { userId: true },
    });
    for (const ur of userRoles) {
      await this.permCache.invalidateUser(ur.userId);
      await this.dataScope.invalidateCache(ur.userId);
    }
    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.userRole.deleteMany({ where: { roleId: id } });
    await this.prisma.role.delete({ where: { id } });
    return { success: true };
  }

  async listDepartments(includeDeleted = false) {
    const cacheKey = includeDeleted ? 'sys:departments:recycle' : DEPT_CACHE_KEY;
    if (this.redis.isEnabled) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
    }
    const data = await this.prisma.department.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        parentId: true,
        managerId: true,
        description: true,
        status: true,
        createdAt: true,
        deletedAt: true,
        manager: { select: { id: true, name: true, employeeNo: true } },
        _count: { select: { employees: { where: { status: 'active' } } } },
      },
    });
    const result = data.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId,
      managerId: d.managerId,
      description: d.description,
      status: d.status,
      createdAt: d.createdAt,
      deletedAt: d.deletedAt,
      manager: d.manager,
      employeeCount: d._count.employees,
    }));
    if (this.redis.isEnabled) {
      await this.redis.set(cacheKey, JSON.stringify(result), DEPT_CACHE_TTL);
    }
    return result;
  }

  async createDepartment(dto: { name: string; parentId?: number; managerId?: number; description?: string; status?: string }) {
    const exists = await this.prisma.department.findFirst({ where: { name: dto.name, deletedAt: null } });
    if (exists) throw new ConflictException({ code: ERROR_CODES.DEPARTMENT_NAME_EXISTS, message: '部门名称已存在' });
    if (dto.parentId) {
      const parent = await this.prisma.department.findUnique({ where: { id: dto.parentId, deletedAt: null } });
      if (!parent) throw new NotFoundException({ code: ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '父部门不存在' });
    }
    if (dto.managerId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: dto.managerId } });
      if (!emp) throw new NotFoundException({ code: ERROR_CODES.DEPARTMENT_LEADER_NOT_FOUND, message: '负责人不存在' });
    }
    const result = await this.prisma.department.create({
      data: {
        name: dto.name,
        parentId: dto.parentId,
        managerId: dto.managerId,
        description: dto.description,
        status: dto.status || 'active',
      },
      select: { id: true, name: true, parentId: true, managerId: true, description: true, status: true },
    });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
    }
    // 新任负责人立即获得该部门及子部门的可见范围，无需等待 5 分钟缓存过期
    await this.invalidateDataScopeForEmployees([dto.managerId]);
    return result;
  }

  async updateDepartment(id: number, dto: { name?: string; parentId?: number | null; managerId?: number | null; description?: string; status?: string }) {
    const dept = await this.prisma.department.findUnique({ where: { id, deletedAt: null } });
    if (!dept) throw new NotFoundException({ code: ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '部门不存在' });
    if (dto.name && dto.name !== dept.name) {
      const exists = await this.prisma.department.findFirst({ where: { name: dto.name, deletedAt: null } });
      if (exists) throw new ConflictException({ code: ERROR_CODES.DEPARTMENT_NAME_EXISTS, message: '部门名称已存在' });
    }
    if (dto.parentId !== undefined && dto.parentId === id) {
      throw new ConflictException({ code: ERROR_CODES.DEPARTMENT_SELF_PARENT, message: '不能将自己设为父部门' });
    }
    if (dto.managerId !== undefined && dto.managerId !== null) {
      const emp = await this.prisma.employee.findUnique({ where: { id: dto.managerId } });
      if (!emp) throw new NotFoundException({ code: ERROR_CODES.DEPARTMENT_LEADER_NOT_FOUND, message: '负责人不存在' });
    }
    const result = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId,
        managerId: dto.managerId,
        description: dto.description,
        status: dto.status,
      },
      select: { id: true, name: true, parentId: true, managerId: true, description: true, status: true },
    });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
      await this.redis.del('sys:departments:recycle');
    }
    // 换负责人：原负责人失去该部门范围、新负责人获得，两者缓存都要失效
    if (dto.managerId !== undefined && dto.managerId !== dept.managerId) {
      await this.invalidateDataScopeForEmployees([dept.managerId, dto.managerId]);
    }
    return result;
  }

  async deleteDepartment(id: number) {
    const dept = await this.prisma.department.findUnique({ where: { id, deletedAt: null } });
    if (!dept) throw new NotFoundException({ code: ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '部门不存在' });
    const children = await this.prisma.department.count({ where: { parentId: id, deletedAt: null } });
    if (children > 0) throw new ConflictException({ code: ERROR_CODES.DEPARTMENT_HAS_CHILDREN, message: '该部门下有子部门，不能删除' });
    const empCount = await this.prisma.employee.count({ where: { departmentId: id, status: 'active' } });
    if (empCount > 0) throw new ConflictException({ code: ERROR_CODES.DEPARTMENT_HAS_EMPLOYEES, message: '该部门下有在职员工，不能删除' });
    await this.prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
      await this.redis.del('sys:departments:recycle');
    }
    // 部门被移入回收站后不应再作为负责人的可见范围
    await this.invalidateDataScopeForEmployees([dept.managerId]);
    return { success: true };
  }

  async restoreDepartment(id: number) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException({ code: ERROR_CODES.DEPARTMENT_NOT_FOUND, message: '部门不存在' });
    if (!dept.deletedAt) {
      throw new ConflictException({ code: ERROR_CODES.DEPARTMENT_NOT_DELETED, message: '部门未被删除，不可恢复' });
    }
    await this.prisma.department.update({ where: { id }, data: { deletedAt: null } });
    if (this.redis.isEnabled) {
      await this.redis.del(DEPT_CACHE_KEY);
      await this.redis.del('sys:departments:recycle');
    }
    // 恢复部门后负责人重新获得该部门可见范围
    await this.invalidateDataScopeForEmployees([dept.managerId]);
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
    if (exists) throw new ConflictException({ code: ERROR_CODES.POSITION_NAME_EXISTS, message: '岗位名称已存在' });
    return this.prisma.position.create({
      data: { name: dto.name },
      select: { id: true, name: true },
    });
  }

  async updatePosition(id: number, dto: { name: string }) {
    const pos = await this.prisma.position.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException({ code: ERROR_CODES.POSITION_NOT_FOUND, message: '岗位不存在' });
    if (dto.name !== pos.name) {
      const exists = await this.prisma.position.findFirst({ where: { name: dto.name } });
      if (exists) throw new ConflictException({ code: ERROR_CODES.POSITION_NAME_EXISTS, message: '岗位名称已存在' });
    }
    return this.prisma.position.update({
      where: { id },
      data: { name: dto.name },
      select: { id: true, name: true },
    });
  }

  async deletePosition(id: number) {
    const pos = await this.prisma.position.findUnique({ where: { id } });
    if (!pos) throw new NotFoundException({ code: ERROR_CODES.POSITION_NOT_FOUND, message: '岗位不存在' });
    const empCount = await this.prisma.employee.count({ where: { positionId: id } });
    if (empCount > 0) throw new ConflictException({ code: ERROR_CODES.POSITION_IN_USE, message: '该岗位下有员工，不能删除' });
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
