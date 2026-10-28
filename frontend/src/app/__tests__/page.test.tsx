import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import HomePage from '@/app/(dashboard)/page';
import { dashboardApi } from '@/services/dashboard';
import { clearDataCache } from '@/hooks/use-cached-data';

const mockedGetStats = dashboardApi.getStats as jest.Mock;

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
    // 工作台四区块空态现在直接在 HomePage 渲染 Empty（此前仅在未渲染的 OrgChart 中使用）
    Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
    // DataState（OrgChart 骨架/错误态）依赖的组件
    Skeleton: ({ children }: any) => <div data-testid="skeleton">{children}</div>,
    Result: ({ subTitle, extra }: any) => (
      <div data-testid="result">{subTitle}{extra}</div>
    ),
    List,
    Message: { success: jest.fn(), error: jest.fn() },
    // 快捷操作管理面板（QuickActionsManager）用到的组件，缺一个就会在渲染期抛
    // "Element type is invalid"，导致整页测试全挂
    Modal: ({ visible, children, title, footer }: any) =>
      visible ? (
        <div data-testid="qa-modal">
          <div data-testid="qa-modal-title">{title}</div>
          {children}
          <div data-testid="qa-modal-footer">{footer}</div>
        </div>
      ) : null,
    Input: ({ value, onChange, placeholder, 'aria-label': ariaLabel }: any) => (
      <input
        value={value ?? ''}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
    Checkbox: ({ checked, onChange, 'aria-label': ariaLabel }: any) => (
      <input type="checkbox" checked={!!checked} aria-label={ariaLabel} onChange={onChange} />
    ),
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

// ============================================================
// 工作台四区块接真实接口字段（todoTop / notificationTop / myWeek / mySubmissionsTop）
// ============================================================

const FULL_STATS = {
  employeeCount: 12,
  attendanceCount: 8,
  todayLateCount: 1,
  monthOvertimeHours: 6.5,
  pendingApprovals: 2,
  monthlySalary: null,
  employeeId: 1,
  todoTop: [
    { id: 11, instanceId: 3, title: '张三的请假申请', createdAt: new Date().toISOString() },
    { id: 12, instanceId: 4, title: '李四的报销申请', createdAt: new Date().toISOString() },
  ],
  notificationTop: [
    { id: 21, title: '本月工资条已发放', type: 'system', read: false, createdAt: new Date().toISOString() },
  ],
  mySubmissionsTop: [
    { id: 31, title: '年假申请（2天）', status: 'approved', createdAt: new Date().toISOString() },
    { id: 32, title: '加班申请（3小时）', status: 'pending', createdAt: new Date().toISOString() },
  ],
  myWeek: { workDays: 4, lateDays: 1, absentDays: 0, avgWorkHours: 8.5 },
};

describe('HomePage — 工作台四区块渲染 stats 新字段', () => {  beforeEach(() => {
    clearDataCache();
    mockedGetStats.mockResolvedValue({ code: 0, data: { ...FULL_STATS } });
  });

  afterEach(() => {
    // 还原为文件顶部模块级 mock 的默认返回，避免污染其他 describe
    mockedGetStats.mockResolvedValue({ code: 0, data: null });
  });

  it('待办事项渲染 todoTop 条目（点击跳转 /approval/todo）', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('张三的请假申请')).toBeInTheDocument());
    expect(screen.getByText('李四的报销申请')).toBeInTheDocument();

    await user.click(screen.getByText('张三的请假申请'));
    expect(mockPush).toHaveBeenCalledWith('/approval/todo');
  });

  it('最新通知渲染 notificationTop 条目', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('本月工资条已发放')).toBeInTheDocument());
  });

  it('本周考勤概览渲染 myWeek 数值（出勤/迟到/缺勤/平均工时）', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('正常出勤')).toBeInTheDocument());
    // KPI 数值随 stats 异步到达，需 waitFor
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('8.5h')).toBeInTheDocument());
  });

  it('我的申请进度渲染 mySubmissionsTop 并按状态映射文案与颜色', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('年假申请（2天）')).toBeInTheDocument());
    expect(screen.getByText('已通过')).toBeInTheDocument();
    expect(screen.getByText('审批中')).toBeInTheDocument();
  });

  it('stats 为 null 时四区块走空态（待办显示「暂无待办」，考勤概览显示 —）', async () => {
    mockedGetStats.mockResolvedValue({ code: 0, data: null });
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('暂无待办')).toBeInTheDocument());
    expect(screen.getByText('暂无通知')).toBeInTheDocument();
    expect(screen.getByText('暂无申请')).toBeInTheDocument();
    // myWeek 为 null → 四个 KPI 值显示 '—'
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('统计接口失败时 KPI 区展示错误态与重试，不再伪装成 0', async () => {
    mockedGetStats.mockRejectedValueOnce(new Error('统计数据加载失败'));
    render(<HomePage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('统计数据加载失败'));
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    // 失败时不应把「在职员工 0 人」这类假数据摆出来
    expect(screen.queryByText('在职员工')).toBeNull();

    mockedGetStats.mockResolvedValue({ code: 0, data: { ...FULL_STATS } });
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(screen.getByText('在职员工')).toBeInTheDocument());
  });
});