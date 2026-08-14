import { renderHook } from '@testing-library/react';
import { usePermission } from '@/hooks/use-permission';
import { useAuthStore } from '@/store/auth';

jest.mock('@/store/auth', () => ({ useAuthStore: jest.fn() }));

const mockUseAuthStore = jest.mocked(useAuthStore);

describe('usePermission', () => {
  it('拥有权限点时 can(code) 返回 true', () => {
    mockUseAuthStore.mockReturnValue({ user: { permissions: ['attendance:view'] } });
    const { result } = renderHook(() => usePermission());
    expect(result.current.can('attendance:view')).toBe(true);
  });

  it('缺少权限点时 can(code) 返回 false', () => {
    mockUseAuthStore.mockReturnValue({ user: { permissions: ['attendance:view'] } });
    const { result } = renderHook(() => usePermission());
    expect(result.current.can('payroll:view')).toBe(false);
  });

  it('未登录（user 为 null）时全部 false，can(undefined) 放行', () => {
    mockUseAuthStore.mockReturnValue({ user: null });
    const { result } = renderHook(() => usePermission());
    expect(result.current.can('attendance:view')).toBe(false);
    expect(result.current.can(undefined)).toBe(true);
  });
});
