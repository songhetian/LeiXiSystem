import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SystemUserService {
  constructor(private prisma: PrismaService) {}

  async listUsers(params: {
    keyword?: string;
    roleId?: number;
    page: number;
    pageSize: number;
  }) {
    const { keyword, roleId, page, pageSize } = params;
    const where: any = {};
    if (keyword) {
      where.OR = [
        { username: { contains: keyword } },
        { name: { contains: keyword } },
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
      name: u.name,
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
    const passwordHash = await bcrypt.hash(params.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: params.username,
        passwordHash,
        name: params.name,
        roles: params.roleIds?.length
          ? { create: params.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    });
    return {
      id: user.id,
      username: user.username,
      name: user.name,
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
    const data: any = { name: params.name, status: params.status };
    if (params.password) {
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
    return { success: true };
  }
}
