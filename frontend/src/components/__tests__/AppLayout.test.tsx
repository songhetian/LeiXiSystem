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

  return { Layout, Menu, Avatar, Dropdown, Typography };
});

jest.mock('@arco-design/web-react/icon', () => ({
  IconDashboard: () => <span data-testid="icon-dashboard" />,
  IconCalendar: () => <span data-testid="icon-calendar" />,
  IconIdcard: () => <span data-testid="icon-idcard" />,
  IconUser: () => <span data-testid="icon-user" />,
  IconCheckCircle: () => <span data-testid="icon-check" />,
  IconSafe: () => <span data-testid="icon-safe" />,
  IconBook: () => <span data-testid="icon-book" />,
  IconFile: () => <span data-testid="icon-file" />,
  IconSettings: () => <span data-testid="icon-settings" />,
  IconList: () => <span data-testid="icon-list" />,
  IconNotification: () => <span data-testid="icon-notification" />,
  IconMore: () => <span data-testid="icon-more">more</span>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock('@/store/auth', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    user: { id: 1, username: 'admin', name: '管理员' },
    logout: jest.fn(),
    isAuthenticated: true,
    checkAuth: () => true,
  }),
}));

jest.mock('@/components/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AppSider', () => {
  it('renders logo and menu items', () => {
    render(<AppSider />);
    expect(screen.getByText(/雷犀管理系统/i)).toBeInTheDocument();
    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.getByText('考勤')).toBeInTheDocument();
    expect(screen.getByText('薪资')).toBeInTheDocument();
    expect(screen.getByText('员工')).toBeInTheDocument();
    expect(screen.getByText('设置')).toBeInTheDocument();
  });

  it('renders submenu children (班次/排班/日报/休假/打卡设备)', () => {
    render(<AppSider />);
    expect(screen.getByText(/班次管理/i)).toBeInTheDocument();
    expect(screen.getByText(/排班管理/i)).toBeInTheDocument();
    expect(screen.getByText(/考勤日报/i)).toBeInTheDocument();
    expect(screen.getByText(/休假管理/i)).toBeInTheDocument();
    expect(screen.getByText(/打卡设备/i)).toBeInTheDocument();
  });

  it('passes activeKey to menu selectedKeys', () => {
    render(<AppSider activeKey="dashboard" />);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('data-selected', 'dashboard');
  });

  it('calls onMenuClick when menu item is clicked', async () => {
    const user = userEvent.setup();
    const onMenuClick = jest.fn();

    const mockMenu = jest.fn(({ children, onClickMenuItem }: any) => {
      const items: React.ReactNode[] = [];
      const cloneChildren = (child: any): any => {
        if (!child) return null;
        if (Array.isArray(child)) return child.map(cloneChildren);
        if (typeof child === 'object' && child.props) {
          return {
            ...child,
            props: {
              ...child.props,
              onClick: () => onClickMenuItem?.(child.key),
            },
          };
        }
        return child;
      };
      return <div role="menu">{cloneChildren(children)}</div>;
    });

    const arco = jest.requireMock('@arco-design/web-react');
    const originalMenu = arco.Menu;
    arco.Menu = mockMenu;
    arco.Menu.Item = originalMenu.Item;

    render(<AppSider onMenuClick={onMenuClick} />);

    const menuItems = screen.getAllByRole('menuitem');
    await user.click(menuItems[1]);

    arco.Menu = originalMenu;
  });

  it('uses default activeKey when not provided', () => {
    render(<AppSider />);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('data-selected', 'dashboard');
  });

  it('filters menu by permissions (staff: 仅员工/考勤/知识库)', () => {
    render(
      <AppSider permissions={['employee:list', 'attendance:view', 'knowledge:view']} />,
    );
    expect(screen.getByText('员工')).toBeInTheDocument();
    expect(screen.getByText('考勤')).toBeInTheDocument();
    expect(screen.getByText('知识库')).toBeInTheDocument();
    expect(screen.queryByText('薪资')).not.toBeInTheDocument();
    expect(screen.queryByText('审批中心')).not.toBeInTheDocument();
    expect(screen.queryByText('我的报销')).not.toBeInTheDocument();
    expect(screen.queryByText('系统管理')).not.toBeInTheDocument();
    expect(screen.queryByText('设置')).not.toBeInTheDocument();
  });

  it('without permissions only shows unrestricted items (工作台)', () => {
    render(<AppSider permissions={[]} />);
    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.queryByText('员工')).not.toBeInTheDocument();
    expect(screen.queryByText('考勤')).not.toBeInTheDocument();
  });

  it('shows all menus when permissions prop is not provided (兼容默认)', () => {
    render(<AppSider />);
    expect(screen.getByText('薪资')).toBeInTheDocument();
    expect(screen.getByText('设置')).toBeInTheDocument();
  });
});

describe('AppHeader', () => {
  it('renders breadcrumb title', () => {
    render(<AppHeader title="工作台" />);
    expect(screen.getByText('工作台')).toBeInTheDocument();
  });

  it('renders user avatar and name', () => {
    render(<AppHeader title="工作台" />);
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.getByText('管理员')).toBeInTheDocument();
  });

  it('shows default title when not provided', () => {
    render(<AppHeader />);
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
    expect(screen.getByTestId('layout-sider')).toBeInTheDocument();
    expect(screen.getByTestId('layout-header')).toBeInTheDocument();
    expect(screen.getByTestId('layout-content')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('passes title to header', () => {
    render(
      <AppLayout title="员工管理">
        <div>Content</div>
      </AppLayout>,
    );
    expect(screen.getByText('员工管理')).toBeInTheDocument();
  });

  it('renders children inside content', () => {
    render(
      <AppLayout>
        <div data-testid="child">Hello World</div>
      </AppLayout>,
    );
    const content = screen.getByTestId('layout-content');
    expect(content).toContainElement(screen.getByTestId('child'));
  });

  it('passes activeMenu to sider', () => {
    render(
      <AppLayout activeMenu="employee">
        <div>Content</div>
      </AppLayout>,
    );
    const menu = screen.getByRole('menu');
    expect(menu).toHaveAttribute('data-selected', 'employee');
  });
});
