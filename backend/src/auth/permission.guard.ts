import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';

// RBAC 按钮/菜单级权限守卫：比较用户权限点集合与所需权限（ADR-0010 数据隔离由 Service 层注入）
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    const permissionCodes = new Set(
      user?.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.code)) ?? [],
    );
    if (!permissionCodes.has(required)) {
      throw new ForbiddenException({ code: 5003, message: '无权限访问该资源' });
    }
    return true;
  }
}
