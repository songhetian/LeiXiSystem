import { renderHook } from '@testing-library/react';
import { usePermission } from '@/hooks/use-permission';
import { useAuthStore } from '@/store/auth';

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));

describe('usePermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('can()', () => {
    it('用户拥有该权限时返回 true', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { permissions: ['employee:view', 'attendance:manage'] },
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.can('employee:view')).toBe(true);
      expect(result.current.can('attendance:manage')).toBe(true);
    });

    it('用户没有该权限时返回 false', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { permissions: ['employee:view'] },
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.can('payroll:manage')).toBe(false);
      expect(result.current.can('system:user:manage')).toBe(false);
    });

    it('不传 code 时返回 false（安全默认）', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { permissions: ['employee:view'] },
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.can(undefined)).toBe(false);
      expect(result.current.can('')).toBe(false);
    });

    it('用户未登录（无 user）时返回 false', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: null,
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.can('employee:view')).toBe(false);
      expect(result.current.can('anything')).toBe(false);
    });

    it('permissions 为空数组时返回 false', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { permissions: [] },
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.can('employee:view')).toBe(false);
    });

    it('精确匹配，前缀不匹配不算通过', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { permissions: ['employee:view'] },
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.can('employee')).toBe(false);
      expect(result.current.can('employee:view:detail')).toBe(false);
      expect(result.current.can('employee:manage')).toBe(false);
    });

    it('不支持 system:manage 这种已废弃的合并权限 code（必须用细粒度 code）', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: {
          permissions: [
            'system:user:manage',
            'system:role:manage',
            'system:broadcast:manage',
          ],
        },
      });

      const { result } = renderHook(() => usePermission());

      // 合并的"system:manage" 并不存在于 seed；这里强制契约
      expect(result.current.can('system:manage')).toBe(false);
      // 真实权限位依旧可用
      expect(result.current.can('system:user:manage')).toBe(true);
      expect(result.current.can('system:role:manage')).toBe(true);
      expect(result.current.can('system:broadcast:manage')).toBe(true);
    });
  });
});
