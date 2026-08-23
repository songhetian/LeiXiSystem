import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AppLayout from '@/components/AppLayout';
import AppSider from '@/components/AppSider';
import AppHeader from '@/components/AppHeader';

jest.mock('@arco-design/web-react', () => {
  const Menu = ({ children, selectedKeys, onClickMenuItem, style, className }: any) => (
    <div role="menu" style={style} className={className} data-selected={selectedKeys?.join(',')}>
      {children}
    </div>
  );
  Menu.Item = ({ children, onClick, _key, style, className }: any) => (
    <div role="menuitem" style={style} className={className} onClick={onClick}>
      {children}
    </div>
  );
  Menu.SubMenu = ({ children, title }: any) => (
    <div role="menu-group">
      <div>{title}</div>
      {children}
    </div>
  );

  const Layout = ({ children, style }: any) => <div data-testid="layout" style={style}>{children}</div>;
  Layout.Header = ({ children, style }: any) => <header data-testid="layout-header" style={style}>{children}</header>;
  Layout.Sider = ({ children, style, width }: any) => <aside data-testid="layout-sider" style={style}>{children}</aside>;
  Layout.Content = ({ children, style }: any) => <main data-testid="layout-content" style={style}>{children}</main>;

  const Avatar = ({ children, size, style }: any) => <div data-testid="avatar" style={style}>{children}</div>;

  const Dropdown = ({ children, droplist, position }: any) => (
    <div data-testid="dropdown">{children}</div>
  );

  const Typography = {
    Title: ({ heading, children, style }: any) => <h6 data-testid="logo-title" style={style}>{children}</h6>,
  };

  const Badge = ({ children, count, offset }: any) => (
    <span data-testid="badge" data-count={count}>{children}</span>
  );

  return { Layout, Menu, Avatar, Dropdown, Typography, Badge };
});

// 侧边栏/命令面板使用大量图标。为避免固定 mock 遗漏新图标导致渲染崩溃，
// 用 Proxy 兜底：任意图标名都返回可渲染的组件（data-testid=`icon-${name}`）。
jest.mock('@arco-design/web-react/icon', () => {
  const React = require('react');
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        if (typeof prop === 'symbol') return undefined;
        const name = String(prop);
        return (props: any) =>
          React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
      },
    },
  );
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// AppLayout 现在调用 useSocket() 初始化实时连接；测试中置为空操作，避免真实建连
jest.mock('@/hooks/use-socket', () => ({
  useSocket: () => null,
}));

// AppHeader 头部角标会拉取未读数；mock 掉避免真实网络请求
jest.mock('@/services/notification', () => ({
  notificationApi: {
    list: jest.fn(),
    unreadCount: jest.fn().mockResolvedValue({ code: 0, data: { count: 0 } }),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  },
}));

jest.mock('@/store/auth', () => {
  const state = {
    user: {
      id: 1,
      username: 'admin',
      name: '管理员',
      permissions: [
        'employee:view', 'attendance:view', 'attendance:manage',
        'attendance:exception:view', 'attendance:deduction:view',
        'approval:todo:view', 'approval:submitted:view', 'approval:workflow:manage',
        'payroll:view', 'reimbursement:view', 'reimbursement:approve',
        'knowledge:view', 'knowledge:manage',
        'performance:view', 'okr:view',
        'finance:budget:view', 'finance:expense-standard:view',
        'helpdesk:view',
        'system:user:view', 'system:user:manage', 'system:role:manage',
        'department:manage', 'system:broadcast:manage', 'system:log:view',
        'system:setting:view',
      ],
    },
    logout: jest.fn(),
    refreshUser: jest.fn(),
    isAuthenticated: true,
    checkAuth: () => Promise.resolve(true),
  };
  // 同时支持无参调用（返回整个 store）和 selector 调用（返回选中片段）
  const useAuthStore = jest.fn((selector?: (s: typeof state) => unknown) =>
    selector ? selector(state) : state,
  );
  (useAuthStore as any).getState = () => state;
  return { useAuthStore };
});

jest.mock('@/components/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AppSider', () => {
  it('renders logo and top-level menu labels', () => {
    render(<AppSider />);
    expect(screen.getByText(/雷犀管理系统/i)).toBeInTheDocument();
    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.getByText('考勤管理')).toBeInTheDocument();
    expect(screen.getByText('薪资管理')).toBeInTheDocument();
    expect(screen.getByText('员工管理')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });

  it('renders submenu children (班次/排班/日报/休假额度/请假/加班/打卡设备)', () => {
    render(<AppSider />);
    expect(screen.getByText(/班次管理/i)).toBeInTheDocument();
    expect(screen.getByText(/排班管理/i)).toBeInTheDocument();
    expect(screen.getByText(/考勤日报/i)).toBeInTheDocument();
    expect(screen.getByText(/休假额度/i)).toBeInTheDocument();
    expect(screen.getByText(/请假记录/i)).toBeInTheDocument();
    expect(screen.getByText(/加班记录/i)).toBeInTheDocument();
    expect(screen.getByText(/打卡设备/i)).toBeInTheDocument();
  });

  it('marks the active menu item (activeKey)', () => {
    render(<AppSider activeKey="attendance-daily" />);
    const item = screen.getByText(/考勤日报/i).closest('.side-item');
    expect(item).toHaveClass('active');
  });

  it('calls onMenuClick when a leaf menu item is clicked', async () => {
    const user = userEvent.setup();
    const onMenuClick = jest.fn();
    render(<AppSider onMenuClick={onMenuClick} />);
    await user.click(screen.getByText(/考勤日报/i));
    expect(onMenuClick).toHaveBeenCalledWith('attendance-daily');
  });

  it('uses default activeKey when not provided (工作台 active)', () => {
    render(<AppSider />);
    const item = screen.getByText('工作台').closest('.side-item');
    expect(item).toHaveClass('active');
  });

  it('filters menu by permissions (staff: 仅员工/考勤/知识库)', () => {
    render(
      <AppSider permissions={['employee:view', 'attendance:view', 'knowledge:view']} />,
    );
    expect(screen.getByText('员工管理')).toBeInTheDocument();
    expect(screen.getByText('考勤管理')).toBeInTheDocument();
    expect(screen.getByText('知识库')).toBeInTheDocument();
    expect(screen.queryByText('薪资管理')).not.toBeInTheDocument();
    expect(screen.queryByText('审批中心')).not.toBeInTheDocument();
    expect(screen.queryByText('报销管理')).not.toBeInTheDocument();
    expect(screen.queryByText('系统管理')).not.toBeInTheDocument();
    expect(screen.queryByText('系统设置')).not.toBeInTheDocument();
    expect(screen.queryByText('财务预算')).not.toBeInTheDocument();
    expect(screen.queryByText('绩效 OKR')).not.toBeInTheDocument();
  });

  it('without permissions only shows unrestricted items (工作台/我的通知)', () => {
    render(<AppSider permissions={[]} />);
    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.getByText('我的通知')).toBeInTheDocument();
    expect(screen.queryByText('员工管理')).not.toBeInTheDocument();
    expect(screen.queryByText('考勤管理')).not.toBeInTheDocument();
  });

  it('shows all menus when permissions prop is not provided (兼容默认)', () => {
    render(<AppSider />);
    expect(screen.getByText('薪资管理')).toBeInTheDocument();
    expect(screen.getByText('系统设置')).toBeInTheDocument();
  });
});

describe('AppHeader', () => {
  it('renders breadcrumb from current pathname', () => {
    render(<AppHeader title="工作台" />);
    expect(screen.getByText('首页')).toBeInTheDocument();
  });

  it('renders user avatar and name', () => {
    render(<AppHeader title="工作台" />);
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
  });

  it('falls back to default title when pathname has no mapping', () => {
    render(<AppHeader title="工作台" />);
    expect(screen.getByText(/首页/i)).toBeInTheDocument();
  });

  it('renders dropdown for user menu', () => {
    render(<AppHeader title="工作台" />);
    expect(screen.getByTestId('dropdown')).toBeInTheDocument();
  });
});

describe('AppLayout', () => {
  it('renders sider, header and content area', () => {
    render(
      <AppLayout>
        <div data-testid="page-content">Page Content</div>
      </AppLayout>,
    );
    expect(document.querySelector('.app-sider')).toBeInTheDocument();
    expect(document.querySelector('.app-header')).toBeInTheDocument();
    expect(document.querySelector('.app-content')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('renders logo and menus inside sider', () => {
    render(
      <AppLayout>
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText(/雷犀管理系统/i)).toBeInTheDocument();
    expect(screen.getByText('考勤管理')).toBeInTheDocument();
  });

  it('renders children inside content', () => {
    render(
      <AppLayout>
        <div data-testid="child">Hello World</div>
      </AppLayout>,
    );
    const content = document.querySelector('.app-content');
    expect(content).toContainElement(screen.getByTestId('child'));
  });

  it('passes activeMenu to sider', () => {
    render(
      <AppLayout activeMenu="attendance-daily">
        <div>Content</div>
      </AppLayout>,
    );
    const item = screen.getByText(/考勤日报/i).closest('.side-item');
    expect(item).toHaveClass('active');
  });
});
