import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import HomePage from '@/app/(dashboard)/page';
import { dashboardApi } from '@/services/dashboard';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

const mockedGetStats = dashboardApi.getStats as jest.Mock;
const mockedGetTodayPunch = attendanceApi.getTodayPunch as jest.Mock;
const mockedGetMyBalances = attendanceApi.getMyBalances as jest.Mock;

// 角色开关：工作台 KPI / 考勤概览按 isAdmin 分两套，测试按需切换
let mockIsAdmin = true;
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({
    can: (code?: string) => (code ? mockIsAdmin : false),
  }),
}));

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getTodayPunch: jest.fn().mockResolvedValue({ code: 0, data: null }),
    getMyBalances: jest.fn().mockResolvedValue({ code: 0, data: [] }),
  },
}));

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
    // 组织看板（管理员可见）依赖这两个接口，缺 mock 会在渲染期抛「不是函数」
    getDepartmentStats: jest.fn().mockResolvedValue({ code: 0, data: [] }),
    getAttendanceTrend: jest.fn().mockResolvedValue({ code: 0, data: [] }),
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
    mockIsAdmin = true;
  });

  it('wraps content with PageContainer', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByTestId('page-container')).toBeInTheDocument());
  });

  it('不渲染冗余页面大标题（顶部已有全局面包屑）', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.queryByTestId('page-title')).toBeNull());
  });

  it('问候语与日期按北京时间渲染（不受宿主机时区影响）', async () => {
    jest.useFakeTimers();
    // 2026-10-27T16:30:00Z = 北京时间 2026-10-28 00:30（周三）
    jest.setSystemTime(new Date('2026-10-27T16:30:00Z'));

    render(<HomePage />);

    expect(screen.getByText('夜深了，欢迎回来')).toBeInTheDocument();
    expect(screen.getByText('10月28日 · 星期三')).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('renders dashboard metric cards', async () => {
    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText('在职员工')).toBeInTheDocument();
      expect(screen.getByText('今日出勤')).toBeInTheDocument();
      expect(screen.getAllByText('待审批').length).toBeGreaterThan(0);
      expect(screen.getByText('本月加班')).toBeInTheDocument();
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
    mockIsAdmin = true;
    mockedGetStats.mockResolvedValue({ code: 0, data: { ...FULL_STATS } });
  });

  afterEach(() => {
    // 还原为文件顶部模块级 mock 的默认返回，避免污染其他 describe
    mockedGetStats.mockResolvedValue({ code: 0, data: null });
  });

  it('待办事项渲染 todoTop 条目并直达单据详情', async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText('张三的请假申请')).toBeInTheDocument());
    expect(screen.getByText('李四的报销申请')).toBeInTheDocument();

    // 跳跃列表页直达详情，用户不必在列表里二次查找
    await user.click(screen.getByText('张三的请假申请'));
    expect(mockPush).toHaveBeenCalledWith('/approval/instances/3');
    await user.click(screen.getByText('李四的报销申请'));
    expect(mockPush).toHaveBeenCalledWith('/approval/instances/4');
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

  it('KPI 展示本月加班与今日迟到人数（后端已在算，别再挂着恒为 — 的假工资卡）', async () => {
    render(<HomePage />);

    // 本月加班：后端 monthOvertimeHours 的真实聚合值（StatCard 有数字滚动，需等终值）
    await waitFor(() => expect(screen.getByText('本月加班')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('6.5')).toBeInTheDocument());
    // 迟到人数作为「今日出勤」的补充说明，而不是摆一个空卡
    expect(screen.getByText('其中迟到 1 人')).toBeInTheDocument();
    // 恒为 null 的薪资字段不再占 KPI 位
    expect(screen.queryByText('本月工资')).toBeNull();
    expect(screen.queryByText(/¥/)).toBeNull();
  });

  it('没有迟到时「今日出勤」改报出勤率，不显示「其中迟到 0 人」', async () => {
    mockedGetStats.mockResolvedValue({
      code: 0,
      data: { ...FULL_STATS, todayLateCount: 0 },
    });
    render(<HomePage />);

    // 8 / 12 = 67%，比「今日打卡」这种把标签换个说法的填充词更有信息量
    await waitFor(() => expect(screen.getByText('出勤率 67%')).toBeInTheDocument());
    expect(screen.queryByText(/其中迟到/)).toBeNull();
  });

  it('今日无人打卡时明说「暂无打卡记录」，避免用户误判数据没同步', async () => {
    mockedGetStats.mockResolvedValue({
      code: 0,
      data: { ...FULL_STATS, attendanceCount: 0, todayLateCount: 0 },
    });
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('今日暂无打卡记录')).toBeInTheDocument());
    expect(screen.queryByText(/出勤率/)).toBeNull();
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

    await waitFor(() =>
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent('统计数据加载失败'),
    );
    expect(screen.getAllByRole('button', { name: '重试' }).length).toBeGreaterThan(0);
    // 失败时不应把「在职员工 0 人」这类假数据摆出来
    expect(screen.queryByText('在职员工')).toBeNull();

    mockedGetStats.mockResolvedValue({ code: 0, data: { ...FULL_STATS } });
    await userEvent.click(screen.getAllByRole('button', { name: '重试' })[0]);
    await waitFor(() => expect(screen.getByText('在职员工')).toBeInTheDocument());
  });

  it('统计接口失败时四个区块不把失败伪装成「暂无待办 / 暂无通知 / 暂无申请」', async () => {
    mockedGetStats.mockRejectedValueOnce(new Error('统计数据加载失败'));
    render(<HomePage />);

    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(screen.queryByText('暂无待办')).toBeNull();
    expect(screen.queryByText('暂无通知')).toBeNull();
    expect(screen.queryByText('暂无申请')).toBeNull();
    // 本周考勤概览也不能以「—」冒充真实结果
    expect(screen.queryByText('正常出勤')).toBeNull();
  });

  it('统计接口加载中不先摆出 0 人 0 项', async () => {
    mockedGetStats.mockReturnValue(new Promise(() => {}));
    render(<HomePage />);

    await waitFor(() => expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0));
    expect(screen.queryByText('在职员工')).toBeNull();
    expect(screen.queryByText('暂无待办')).toBeNull();
  });
});

// ============================================================
// 角色差异化 / 今日状态 / 交互断链
// ============================================================

describe('HomePage — 角色差异化与今日状态', () => {
  beforeEach(() => {
    clearDataCache();
    mockPush.mockClear();
    mockIsAdmin = true;
    mockedGetStats.mockResolvedValue({ code: 0, data: { ...FULL_STATS } });
    mockedGetTodayPunch.mockResolvedValue({ code: 0, data: null });
    mockedGetMyBalances.mockResolvedValue({ code: 0, data: [] });
  });

  afterEach(() => {
    mockedGetStats.mockResolvedValue({ code: 0, data: null });
  });

  it('普通员工看不到全局人力数字，只看与自己相关的指标', async () => {
    mockIsAdmin = false;
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('本周出勤')).toBeInTheDocument());
    // 全局人力/全员加班对普通员工没有决策价值
    expect(screen.queryByText('在职员工')).toBeNull();
    expect(screen.queryByText('今日出勤')).toBeNull();
    expect(screen.queryByText('本月加班')).toBeNull();
    // 本周考勤概览与组织看板同属管理者视角，员工侧重复数据不再出现
    expect(screen.queryByText('正常出勤')).toBeNull();
  });

  it('管理员保留全局视角，且组织看板下沉到页面末尾', async () => {
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('在职员工')).toBeInTheDocument());
    // 管理员侧不出现员工专属指标，两套卡不混排
    expect(screen.queryByText('本周出勤')).toBeNull();
    // 组织看板标题在「最新通知」之后（DOM 顺序上处于页尾）
    const headings = screen.getAllByRole('heading').map((h) => h.textContent);
    expect(headings.indexOf('部门人力分布')).toBeGreaterThan(headings.indexOf('最新通知'));
  });

  it('今日打卡渲染上下班时间、班次与后端口径的准入提示', async () => {
    mockedGetTodayPunch.mockResolvedValue({
      code: 0,
      data: {
        status: 'normal',
        firstPunch: '2026-10-30T01:02:00.000Z', // 北京时间 09:02
        lastPunch: null,
        hasSchedule: true,
        isRestDay: false,
        shift: { startTime: '09:00', endTime: '18:00' },
        clockIn: { allowed: false, message: '已打卡上班' },
        clockOut: { allowed: false, message: '还需等待 45 分钟' },
      },
    });
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('09:02')).toBeInTheDocument());
    expect(screen.getByText('09:00–18:00')).toBeInTheDocument();
    expect(screen.getByText('正常')).toBeInTheDocument();
    // 提示文案直接取后端准入 message，与打卡页保持同一口径
    expect(screen.getByText('还需等待 45 分钟')).toBeInTheDocument();
  });

  it('休息日 / 未排班给出明确原因，而不是把按钮置灰让人猜', async () => {
    mockedGetTodayPunch.mockResolvedValue({
      code: 0,
      data: { status: 'rest', hasSchedule: true, isRestDay: true, clockIn: null, clockOut: null },
    });
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('休息日，无需打卡')).toBeInTheDocument());
  });

  it('未排班时提示先去排班', async () => {
    mockedGetTodayPunch.mockResolvedValue({
      code: 0,
      data: { status: 'absent', hasSchedule: false, isRestDay: false, clockIn: null, clockOut: null },
    });
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('今日未排班，请先联系排班人')).toBeInTheDocument());
  });

  it('假期余额优先展示年假，剩余天数 = 总额度 − 已用', async () => {
    mockedGetMyBalances.mockResolvedValue({
      code: 0,
      data: [
        { id: 1, vacationType: { code: 'personal', name: '事假', isPaid: false }, totalDays: 10, usedDays: 3 },
        { id: 2, vacationType: { code: 'annual', name: '年假', isPaid: true }, totalDays: 5, usedDays: 2 },
      ],
    });
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('年假剩余')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('已用')).toBeInTheDocument();
  });

  it('我的申请条目可点击（不再是只读死块）', async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await waitFor(() => expect(screen.getByText('年假申请（2天）')).toBeInTheDocument());
    await user.click(screen.getByText('年假申请（2天）'));
    expect(mockPush).toHaveBeenCalledWith('/approval/submissions');
  });

  it('hero 展示数据更新时间，让「0 人」这类数值可自证新鲜度', async () => {
    render(<HomePage />);
    await waitFor(() => expect(screen.getByText(/更新于/)).toBeInTheDocument());
  });
});