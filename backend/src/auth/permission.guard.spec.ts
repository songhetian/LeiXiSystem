import { PermissionGuard } from '../auth/permission.guard';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

function createMockReflector(requiredPerm: string | undefined) {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(requiredPerm),
  } as unknown as Reflector;
}

function createMockPermCache(permissions: string[]) {
  return {
    getUserPermissions: jest.fn().mockResolvedValue(new Set(permissions)),
    getUserInfo: jest.fn(),
    invalidateUser: jest.fn(),
  };
}

function createMockContext(userId: number | undefined) {
  const request: any = {};
  if (userId !== undefined) {
    request.user = { id: userId };
  }
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('PermissionGuard', () => {
  describe('canActivate', () => {
    it('无权限要求时直接放行', async () => {
      const reflector = createMockReflector(undefined);
      const permCache = createMockPermCache([]);
      const guard = new PermissionGuard(reflector, permCache as any);
      const ctx = createMockContext(1);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(permCache.getUserPermissions).not.toHaveBeenCalled();
    });

    it('有权限要求且用户拥有该权限 → 放行', async () => {
      const reflector = createMockReflector('employee:view');
      const permCache = createMockPermCache(['employee:view', 'attendance:view']);
      const guard = new PermissionGuard(reflector, permCache as any);
      const ctx = createMockContext(1);

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(permCache.getUserPermissions).toHaveBeenCalledWith(1);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        REQUIRED_PERMISSION_KEY,
        expect.arrayContaining([expect.any(Object), expect.any(Object)]),
      );
    });

    it('有权限要求但用户没有该权限 → 抛出 ForbiddenException', async () => {
      const reflector = createMockReflector('payroll:manage');
      const permCache = createMockPermCache(['employee:view']);
      const guard = new PermissionGuard(reflector, permCache as any);
      const ctx = createMockContext(1);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('用户未登录（无 userId）→ 抛出 UnauthorizedException', async () => {
      const reflector = createMockReflector('employee:view');
      const permCache = createMockPermCache([]);
      const guard = new PermissionGuard(reflector, permCache as any);
      const ctx = createMockContext(undefined);

      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('错误响应包含 code 和 message', async () => {
      const reflector = createMockReflector('secret:perm');
      const permCache = createMockPermCache([]);
      const guard = new PermissionGuard(reflector, permCache as any);
      const ctx = createMockContext(1);

      try {
        await guard.canActivate(ctx);
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e.response).toBeDefined();
        expect(e.response.code).toBeDefined();
        expect(e.response.message).toBe('无权限访问该资源');
      }
    });

    it('精确匹配权限码，前缀不匹配不算通过', async () => {
      const reflector = createMockReflector('employee:manage');
      const permCache = createMockPermCache(['employee:view']);
      const guard = new PermissionGuard(reflector, permCache as any);
      const ctx = createMockContext(1);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
