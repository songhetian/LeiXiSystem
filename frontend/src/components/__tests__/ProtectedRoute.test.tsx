import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/auth';
import { usePathname, useRouter } from 'next/navigation';

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

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockPathname = '/';
  });

  describe('认证检查', () => {
    it('已认证时渲染子内容', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        isAuthenticated: true,
        checkAuth: () => Promise.resolve(true),
        user: { permissions: [] },
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Secret</div>
        </ProtectedRoute>,
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('未认证时重定向到登录页', async () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        checkAuth: () => Promise.resolve(false),
        user: null,
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Secret</div>
        </ProtectedRoute>,
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('检查认证中显示加载状态', () => {
      (useAuthStore as unknown as jest.Mock).mockReturnValue({
        isAuthenticated: false,
        checkAuth: () => Promise.resolve(false),
        user: null,
      });

      render(
        <ProtectedRoute>
          <div data-testid="protected-content">Secret</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
      // 用 min-h-dvh 而非 100vh，避免移动端地址栏占高导致内容被推出视口（SC 1.4.10）
      expect(screen.getByText(/加载中/i).closest('div')).toHaveClass('min-h-dvh');
    });
  });

  describe('权限检查', () => {
    const mockAuthenticatedUser = (permissions: string[]) => ({
      isAuthenticated: true,
      checkAuth: () => Promise.resolve(true),
      user: { id: 1, name: '测试用户', permissions },
    });

    it('路径无权限要求时直接放行', () => {
      mockPathname = '/dashboard';
      (useAuthStore as unknown as jest.Mock).mockReturnValue(
        mockAuthenticatedUser([]),
      );

      render(
        <ProtectedRoute>
          <div data-testid="content">首页内容</div>
        </ProtectedRoute>,
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('用户有对应页面权限时正常访问', () => {
      mockPathname = '/employees';
      (useAuthStore as unknown as jest.Mock).mockReturnValue(
        mockAuthenticatedUser(['employee:view']),
      );

      render(
        <ProtectedRoute>
          <div data-testid="content">员工列表</div>
        </ProtectedRoute>,
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('用户没有对应页面权限时显示 403', () => {
      mockPathname = '/payroll';
      (useAuthStore as unknown as jest.Mock).mockReturnValue(
        mockAuthenticatedUser(['employee:view']),
      );

      render(
        <ProtectedRoute>
          <div data-testid="content">薪资页面</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText('403')).toBeInTheDocument();
      expect(screen.getByText(/没有权限访问此页面/)).toBeInTheDocument();
      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });

    it('403 页面有返回首页按钮', () => {
      mockPathname = '/system';
      (useAuthStore as unknown as jest.Mock).mockReturnValue(
        mockAuthenticatedUser(['employee:view']),
      );

      render(
        <ProtectedRoute>
          <div>系统管理</div>
        </ProtectedRoute>,
      );

      const btn = screen.getByRole('button', { name: /返回首页/ });
      expect(btn).toBeInTheDocument();
    });

    it('最长前缀匹配：子路径继承父路径权限', () => {
      mockPathname = '/employees/123/detail';
      (useAuthStore as unknown as jest.Mock).mockReturnValue(
        mockAuthenticatedUser(['employee:view']),
      );

      render(
        <ProtectedRoute>
          <div data-testid="content">员工详情</div>
        </ProtectedRoute>,
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('所有权限映射路径都能正确匹配', () => {
      const testCases = [
        { path: '/employees', perm: 'employee:view' },
        { path: '/attendance', perm: 'attendance:view' },
        { path: '/approval/todo', perm: 'approval:todo:view' },
        { path: '/payroll/runs', perm: 'payroll:view' },
        { path: '/expense/my-list', perm: 'reimbursement:view' },
        { path: '/knowledge/list', perm: 'knowledge:view' },
        { path: '/reports', perm: 'reports:view' },
        { path: '/system/users', perm: 'system:user:view' },
        { path: '/settings', perm: 'system:setting:view' },
      ];

      for (const { path, perm } of testCases) {
        mockPathname = path;
        (useAuthStore as unknown as jest.Mock).mockReturnValue(
          mockAuthenticatedUser([perm]),
        );

        const { unmount } = render(
          <ProtectedRoute>
            <div data-testid={`content-${path}`}>{path}</div>
          </ProtectedRoute>,
        );

        expect(screen.getByTestId(`content-${path}`)).toBeInTheDocument();
        unmount();
      }
    });

    // 深层管理页需要独立的管理权限，不能被父级 view 权限放行
    const deepRouteCases = [
      { path: '/attendance/vacation/settings', parentPerm: 'attendance:view', required: 'vacation:manage' },
      { path: '/attendance/settings', parentPerm: 'attendance:view', required: 'attendance:manage' },
      { path: '/attendance/devices', parentPerm: 'attendance:view', required: 'attendance:manage' },
      { path: '/attendance/exception-rules', parentPerm: 'attendance:view', required: 'attendance:exception:view' },
      { path: '/attendance/deduction-rules', parentPerm: 'attendance:view', required: 'attendance:deduction:view' },
      { path: '/approval/settings', parentPerm: 'approval:todo:view', required: 'approval:workflow:manage' },
      { path: '/approval/role-workflow', parentPerm: 'approval:todo:view', required: 'approval:workflow:manage' },
      { path: '/approval/approvers', parentPerm: 'approval:todo:view', required: 'approval:manage' },
      { path: '/expense/settings', parentPerm: 'reimbursement:view', required: 'reimbursement:manage' },
      { path: '/expense/approval', parentPerm: 'reimbursement:view', required: 'reimbursement:approve' },
      { path: '/knowledge/admin', parentPerm: 'knowledge:view', required: 'knowledge:manage' },
      { path: '/system/roles', parentPerm: 'system:user:view', required: 'system:role:manage' },
      { path: '/system/permissions', parentPerm: 'system:user:view', required: 'system:role:manage' },
      { path: '/system/departments', parentPerm: 'system:user:view', required: 'department:manage' },
      { path: '/system/positions', parentPerm: 'system:user:view', required: 'position:manage' },
      { path: '/system/broadcasts', parentPerm: 'system:user:view', required: 'system:broadcast:manage' },
      { path: '/system/logs', parentPerm: 'system:user:view', required: 'system:log:view' },
      { path: '/notifications/settings', parentPerm: 'system:user:view', required: 'system:notification:settings' },
      { path: '/okr', parentPerm: 'employee:view', required: 'okr:view' },
      { path: '/helpdesk', parentPerm: 'employee:view', required: 'helpdesk:view' },
      { path: '/performance/cycles', parentPerm: 'employee:view', required: 'performance:view' },
      { path: '/finance/budgets', parentPerm: 'employee:view', required: 'finance:budget:view' },
      { path: '/finance/expense-standards', parentPerm: 'employee:view', required: 'finance:expense-standard:view' },
    ];

    it('仅持父级 view 权限访问深层管理页时显示 403', () => {
      for (const { path, parentPerm } of deepRouteCases) {
        mockPathname = path;
        (useAuthStore as unknown as jest.Mock).mockReturnValue(
          mockAuthenticatedUser([parentPerm]),
        );

        const { unmount } = render(
          <ProtectedRoute>
            <div data-testid={`deep-${path}`}>{path}</div>
          </ProtectedRoute>,
        );

        expect(screen.getByText('403')).toBeInTheDocument();
        unmount();
      }
    });

    it('持对应管理权限时可访问深层管理页', () => {
      for (const { path, required } of deepRouteCases) {
        mockPathname = path;
        (useAuthStore as unknown as jest.Mock).mockReturnValue(
          mockAuthenticatedUser([required]),
        );

        const { unmount } = render(
          <ProtectedRoute>
            <div data-testid={`deep-${path}`}>{path}</div>
          </ProtectedRoute>,
        );

        expect(screen.getByTestId(`deep-${path}`)).toBeInTheDocument();
        unmount();
      }
    });

    it('无权限要求的公开页面不被限制', () => {
      for (const path of ['/broadcasts', '/notifications', '/profile']) {
        mockPathname = path;
        (useAuthStore as unknown as jest.Mock).mockReturnValue(mockAuthenticatedUser([]));

        const { unmount } = render(
          <ProtectedRoute>
            <div data-testid={`open-${path}`}>{path}</div>
          </ProtectedRoute>,
        );

        expect(screen.getByTestId(`open-${path}`)).toBeInTheDocument();
        unmount();
      }
    });

    it('所有权限映射路径 - 无权限时都显示 403', () => {
      const testCases = [
        { path: '/employees', perm: 'employee:view' },
        { path: '/attendance', perm: 'attendance:view' },
        { path: '/approval', perm: 'approval:todo:view' },
        { path: '/payroll', perm: 'payroll:view' },
        { path: '/expense', perm: 'reimbursement:view' },
        { path: '/knowledge', perm: 'knowledge:view' },
        { path: '/reports', perm: 'reports:view' },
        { path: '/system', perm: 'system:user:view' },
        { path: '/settings', perm: 'system:setting:view' },
      ];

      for (const { path } of testCases) {
        mockPathname = path;
        (useAuthStore as unknown as jest.Mock).mockReturnValue(
          mockAuthenticatedUser([]),
        );

        const { unmount } = render(
          <ProtectedRoute>
            <div>{path}</div>
          </ProtectedRoute>,
        );

        expect(screen.getByText('403')).toBeInTheDocument();
        unmount();
      }
    });
  });
});
