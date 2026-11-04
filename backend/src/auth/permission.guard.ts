import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSION_KEY } from './require-permission.decorator';
import { ERROR_CODES } from '../common/error-codes';
import { PermissionCacheService } from '../common/permission-cache.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | string[]>(REQUIRED_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || (Array.isArray(required) && required.length === 0)) return true;

    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: 'token 无效或过期',
      });
    }
    const permissionCodes = await this.permCache.getUserPermissions(userId);

    // 数组按 OR 判定：任一权限点命中即放行
    const requiredList = Array.isArray(required) ? required : [required];
    if (!requiredList.some((code) => permissionCodes.has(code))) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权限访问该资源' });
    }
    return true;
  }
}
