import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import HomePage from '@/app/(dashboard)/page';

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      <div data-testid="page-title">{title}</div>
      <div data-testid="page-action">{action}</div>
      {children}
    </div>
  ),
}));

// 首页自身测试的 seam：不深入真实布局（真实布局由 AppLayout.test 覆盖）
jest.mock('@/components/AppLayout', () => ({
  __esModule: true,
  default: ({ title, activeMenu, children }: any) => (
    <div data-testid="app-layout" data-title={title} data-active-menu={activeMenu}>
      {children}
    </div>
  ),
}));

jest.mock('@/services/dashboard', () => ({
  dashboardApi: {
    getStats: jest.fn().mockResolvedValue({ code: 0, data: null }),
  },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// 任意图标名都返回可渲染组件，避免固定 mock 遗漏导致渲染崩溃
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

jest.mock('@arco-design/web-react', () => {
  const React = require('react');
  const List: any = ({ dataSource, render }: any) => (
    <div data-testid="list">
      {dataSource?.map((item: any, i: number) => (
        <div key={item.id ?? i}>{render ? render(item) : null}</div>
      ))}
    </div>
  );
  List.Item = ({ children, key }: any) => <div data-testid="list-item" data-key={key}>{children}</div>;
  List.Item.Meta = ({ avatar, title, description }: any) => (
    <div data-testid="meta">{avatar}{title}{description}</div>
  );
  return {
    Card: ({ children, onClick, className, style, title, extra, bodyStyle, loading }: any) => (
      <div
        data-testid="card"
        data-card-title={title}
        data-loading={String(loading)}
        data-body-style-padding={bodyStyle?.padding}
        onClick={onClick}
        className={className}
        style={style}
      >
        {title}
        {extra}
        {children}
      </div>
    ),
    Grid: {
      Row: ({ children }: any) => <div data-testid="grid-row">{children}</div>,
      Col: ({ children, span }: any) => <div data-testid="grid-col" data-span={span}>{children}</div>,
    },
    Typography: {
      Title: ({ heading, style, children }: any) => <h5 data-testid="title" style={style}>{children}</h5>,
      Text: ({ children, type }: any) => <span data-type={type}>{children}</span>,
    },
    Button: ({ children, onClick, loading, disabled, icon }: any) => (
      <button data-testid={`btn-${children}`} onClick={onClick} disabled={disabled || loading}>
        {icon}
        {children}
      </button>
    ),
    Tag: ({ children, color }: any) => <span data-tag-color={color}>{children}</span>,
    Avatar: ({ children }: any) => <span data-testid="avatar">{children}</span>,
    Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
    List,
    Message: { success: jest.fn(), error: jest.fn() },
  };
});

describe('HomePage', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('wraps content with PageContainer', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByTestId('page-container')).toBeInTheDocument());
  });

  it('passes correct title to PageContainer', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('工作台'));
  });

  it('renders dashboard metric cards', async () => {
    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText('在职员工')).toBeInTheDocument();
      expect(screen.getByText('今日出勤')).toBeInTheDocument();
      expect(screen.getAllByText('待审批').length).toBeGreaterThan(0);
      expect(screen.getByText('本月工资')).toBeInTheDocument();
    });
  });

  it('renders quick action entries', async () => {
    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText('员工管理')).toBeInTheDocument();
      expect(screen.getByText('打卡')).toBeInTheDocument();
      expect(screen.getByText('考勤日报')).toBeInTheDocument();
      expect(screen.getByText('知识库')).toBeInTheDocument();
    });
  });

  it('navigates when a quick action card is clicked', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('员工管理')).toBeInTheDocument());
    await user.click(screen.getByText('员工管理'));
    expect(mockPush).toHaveBeenCalledWith('/employees');
    await user.click(screen.getByText('工单客服'));
    expect(mockPush).toHaveBeenCalledWith('/helpdesk');
  });
});