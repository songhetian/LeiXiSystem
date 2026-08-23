import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/auth';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn(),
}));

describe('权限流程集成测试', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockPathname = '/';
  });

  describe('场景1：普通员工登录 → 访问薪资页 → 403', () => {
    it('无 payroll:view 权限的用户访问 /payroll 显示 403', () => {
      mockPathname = '/payroll';
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        checkAuth: () => Promise.resolve(true),
        user: {
          id: 2,
          name: '普通员工',
          permissions: ['employee:view', 'attendance:view', 'approval:todo:view'],
        },
      });

      render(
        <ProtectedRoute>
          <div data-testid="payroll-page">薪资页面内容</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText('403')).toBeInTheDocument();
      expect(screen.getByText(/没有权限访问此页面/)).toBeInTheDocument();
      expect(screen.queryByTestId('payroll-page')).not.toBeInTheDocument();
    });

    it('403 页面有返回首页按钮，点击可跳转', () => {
      mockPathname = '/payroll';
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        checkAuth: () => Promise.resolve(true),
        user: { id: 2, name: '普通员工', permissions: ['employee:view'] },
      });

      render(
        <ProtectedRoute>
          <div>薪资</div>
        </ProtectedRoute>,
      );

      const btn = screen.getByRole('button', { name: /返回首页/ });
      btn.click();
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('场景2：管理员登录 → 访问所有页面 → 全部放行', () => {
    const adminPerms = [
      'employee:view',
      'employee:manage',
      'attendance:view',
      'attendance:manage',
      'approval:todo:view',
      'approval:workflow:manage',
      'payroll:view',
      'payroll:manage',
      'reimbursement:view',
      'reimbursement:approve',
      'knowledge:view',
      'knowledge:manage',
      'reports:view',
      'system:user:view',
      'system:user:manage',
      'system:role:view',
      'system:role:manage',
      'system:setting:view',
      'system:setting:update',
    ];

    const testCases = [
      { path: '/employees', label: '员工列表' },
      { path: '/attendance', label: '考勤管理' },
      { path: '/approval/todo', label: '审批待办' },
      { path: '/payroll', label: '薪资管理' },
      { path: '/expense', label: '报销管理' },
      { path: '/knowledge', label: '知识库' },
      { path: '/reports', label: '报表中心' },
      { path: '/system/users', label: '用户管理' },
      { path: '/system/roles', label: '角色管理' },
      { path: '/settings', label: '系统设置' },
    ];

    testCases.forEach(({ path, label }) => {
      it(`管理员访问 ${path} (${label}) 正常显示`, () => {
        mockPathname = path;
        (useAuthStore as unknown as jest.Mock).mockReturnValue({
          isAuthenticated: true,
          checkAuth: () => Promise.resolve(true),
          user: { id: 1, name: '管理员', permissions: adminPerms },
        });

        const testId = `page-${path.replace(/\//g, '-')}`;
        render(
          <ProtectedRoute>
            <div data-testid={testId}>{label}内容</div>
          </ProtectedRoute>,
        );

        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.queryByText('403')).not.toBeInTheDocument();
      });
    });
  });

  describe('场景3：未登录 → 访问任意页面 → 重定向登录', () => {
    it('未登录用户访问受保护页面时重定向到 /login', async () => {
      mockPathname = '/employees';
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        checkAuth: () => Promise.resolve(false),
        user: null,
      });

      render(
        <ProtectedRoute>
          <div>员工列表</div>
        </ProtectedRoute>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
    });

    it('未登录时显示加载中，而非直接 403', () => {
      mockPathname = '/system';
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        checkAuth: () => new Promise(() => {}),
        user: null,
      });

      render(
        <ProtectedRoute>
          <div>系统管理</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
      expect(screen.queryByText('403')).not.toBeInTheDocument();
    });
  });

  describe('场景4：权限变更后即时生效', () => {
    it('用户权限从无到有，页面从 403 变为正常显示', () => {
      mockPathname = '/payroll';

      const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

      // 初始：无薪资权限
      const { rerender } = render(
        <ProtectedRoute>
          <div data-testid="payroll-content">薪资数据</div>
        </ProtectedRoute>,
      );

      mockUseAuthStore.mockReturnValue({
        isAuthenticated: true,
        checkAuth: () => Promise.resolve(true),
        user: { id: 3, name: '用户A', permissions: ['employee:view'] },
      });

      rerender(
        <ProtectedRoute>
          <div data-testid="payroll-content">薪资数据</div>
        </ProtectedRoute>,
      );
      expect(screen.getByText('403')).toBeInTheDocument();

      // 权限更新后：有薪资权限
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: true,
        checkAuth: () => Promise.resolve(true),
        user: { id: 3, name: '用户A', permissions: ['employee:view', 'payroll:view'] },
      });

      rerender(
        <ProtectedRoute>
          <div data-testid="payroll-content">薪资数据</div>
        </ProtectedRoute>,
      );

      expect(screen.getByTestId('payroll-content')).toBeInTheDocument();
      expect(screen.queryByText('403')).not.toBeInTheDocument();
    });
  });

  describe('场景5：按钮级权限控制', () => {
    it('usePermission can() 返回正确结果', () => {
      // 这个场景已经在 use-permission.test.ts 详细覆盖
      // 这里只做一个简单的集成验证
      const { renderHook, act } = require('@testing-library/react');
      const { usePermission } = require('@/hooks/use-permission');

      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        user: { permissions: ['employee:view', 'employee:manage'] },
      });

      const { result } = renderHook(() => usePermission());

      expect(result.current.can('employee:view')).toBe(true);
      expect(result.current.can('employee:manage')).toBe(true);
      expect(result.current.can('payroll:manage')).toBe(false);
      expect(result.current.can()).toBe(false);
    });
  });
});
