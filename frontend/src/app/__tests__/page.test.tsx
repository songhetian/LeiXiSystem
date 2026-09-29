import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import HomePage from '@/app/(dashboard)/page';

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      {title && <div data-testid="page-title">{title}</div>}
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

  it('不渲染冗余页面大标题（顶部已有全局面包屑）', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.queryByTestId('page-title')).toBeNull());
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

  it('快捷入口是语义 button（键盘可达，WCAG SC 2.1.1）', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('员工管理')).toBeInTheDocument());
    const entry = screen.getByRole('button', { name: /员工管理/ });
    expect(entry.tagName).toBe('BUTTON');
    expect(entry).toHaveAttribute('type', 'button');
  });

  it('键盘 Enter 可触发快捷入口（与鼠标点击等价）', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('员工管理')).toBeInTheDocument());
    const entry = screen.getByRole('button', { name: /员工管理/ });
    entry.focus();
    expect(document.activeElement).toBe(entry);
    await user.keyboard('{Enter}');
    expect(mockPush).toHaveBeenCalledWith('/employees');
  });

  it('「查看全部 / 查看详情」入口是 button 而非仅 hover 可点的 span', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('待办事项')).toBeInTheDocument());
    for (const name of [/查看全部/, /查看详情/]) {
      const btns = screen.getAllByRole('button', { name });
      expect(btns.length).toBeGreaterThan(0);
      for (const b of btns) expect(b.tagName).toBe('BUTTON');
    }
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