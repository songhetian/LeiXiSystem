import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationSettingsPage from '@/features/notification/pages/settings';
import { notificationSettingApi } from '@/services/notification';
import { approvalApi } from '@/services/approval';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/notification', () => ({
  notificationSettingApi: {
    list: jest.fn(),
    listRoles: jest.fn(),
    setTargets: jest.fn(),
    setTargetRoles: jest.fn(),
  },
}));

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listWorkflows: jest.fn(),
    listGroups: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

// Tabs 简化：默认渲染全部 TabPane，避免依赖 Arco 懒挂载
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  const Tabs = ({ children }: any) => <div data-testid="tabs">{children}</div>;
  Tabs.TabPane = ({ title, children }: any) => (
    <section data-testid={`tab-${title}`}>{children}</section>
  );
  return {
    ...actual,
    Tabs,
    Switch: ({ checked, onChange, 'aria-label': ariaLabel }: any) => (
      <button
        type="button"
        role="switch"
        aria-checked={checked ? 'true' : 'false'}
        aria-label={ariaLabel}
        onClick={() => onChange?.(!checked)}
      />
    ),
    Select: ({ value, options = [], disabled, 'aria-label': ariaLabel }: any) => (
      <div
        data-testid="standalone-select"
        aria-label={ariaLabel}
        data-value={value ?? ''}
        data-disabled={disabled ? 'true' : 'false'}
      >
        {(options as any[]).map((o) => (
          <span key={o.value}>{String(o.label)}</span>
        ))}
      </div>
    ),
    Tooltip: ({ children }: any) => <>{children}</>,
  };
});

const workflows = [
  {
    id: 1,
    code: 'leave',
    name: '请假审批',
    module: 'attendance',
    status: 'active',
    nodes: [
      { nodeKey: 'manager_approve', name: '部门主管审批', type: 'department_manager', order: 1 },
      { nodeKey: 'hr_approve', name: 'HR 审批', type: 'role', roleCode: 'HR', order: 2 },
    ],
  },
  {
    id: 2,
    code: 'overtime',
    name: '加班审批',
    module: 'attendance',
    status: 'active',
    nodes: [{ nodeKey: 'ot_manager', name: '主管审批', type: 'department_manager', order: 1 }],
  },
  {
    id: 3,
    code: 'punch_makeup',
    name: '补卡审批',
    module: 'attendance',
    status: 'active',
    nodes: [{ nodeKey: 'mk_manager', name: '主管审批', type: 'department_manager', order: 1 }],
  },
  {
    id: 4,
    code: 'reimbursement',
    name: '报销审批',
    module: 'reimbursement',
    status: 'active',
    nodes: [{ nodeKey: 'fin_approve', name: '财务审核', type: 'group', approvalGroupId: 1, order: 1 }],
  },
];

const baseSettings = [
  { eventType: 'leave_apply', targetRoles: [], targetNodes: ['manager_approve'] },
  { eventType: 'leave_approval', targetRoles: ['applicant'], targetNodes: null },
  { eventType: 'leave_rejection', targetRoles: ['applicant'], targetNodes: null },
  { eventType: 'late_notify', targetRoles: ['dept_manager'], targetNodes: null },
];

beforeEach(() => {
  jest.clearAllMocks();
  clearDataCache();
  (notificationSettingApi.list as jest.Mock).mockResolvedValue({ code: 0, data: baseSettings });
  (notificationSettingApi.listRoles as jest.Mock).mockResolvedValue({
    code: 0,
    data: [
      { value: 'dept_manager', label: '其所属部门主管' },
      { value: 'applicant', label: '业务发起人（本人）' },
    ],
  });
  (notificationSettingApi.setTargets as jest.Mock).mockResolvedValue({ code: 0 });
  (approvalApi.listWorkflows as jest.Mock).mockResolvedValue({ code: 0, data: workflows });
  (approvalApi.listGroups as jest.Mock).mockResolvedValue({
    code: 0,
    data: { list: [{ id: 1, name: '财务组', code: 'finance' }], total: 1, page: 1, pageSize: 200 },
  });
});

describe('NotificationSettingsPage（按审批流程配置节点通知）', () => {
  it('以流程为单位渲染卡片，并展示节点与处理方', async () => {
    render(<NotificationSettingsPage />);

    expect(await screen.findByText('请假审批')).toBeInTheDocument();
    expect(screen.getByText('加班审批')).toBeInTheDocument();
    expect(screen.getByText('补卡审批')).toBeInTheDocument();
    expect(screen.getByText('报销审批')).toBeInTheDocument();

    expect(screen.getByText('部门主管审批')).toBeInTheDocument();
    expect(screen.getByText('HR 审批')).toBeInTheDocument();
    expect(screen.getByText(/审批组：财务组/)).toBeInTheDocument();
    // 不再出现旧版的「事件 × 多选」项
    expect(screen.queryByText('请假申请触发')).not.toBeInTheDocument();
  });

  it('节点开关按已保存的 targetNodes 回填：未列出的节点为关闭', async () => {
    render(<NotificationSettingsPage />);
    await screen.findByText('请假审批');

    expect(screen.getByLabelText('部门主管审批 到达时通知')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('HR 审批 到达时通知')).toHaveAttribute('aria-checked', 'false');
  });

  it('打开最后一个未开启的节点后即为全开，保存时提交 null（新节点自动继承）', async () => {
    render(<NotificationSettingsPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getByLabelText('HR 审批 到达时通知'));
    fireEvent.click(screen.getAllByText('保存')[0]);

    await waitFor(() => {
      expect(notificationSettingApi.setTargets).toHaveBeenCalledWith('leave_apply', {
        targetNodes: null,
      });
    });
  });

  it('关闭全部节点时提交空数组（显式全关）', async () => {
    render(<NotificationSettingsPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getByLabelText('部门主管审批 到达时通知'));
    fireEvent.click(screen.getAllByText('保存')[0]);

    await waitFor(() => {
      expect(notificationSettingApi.setTargets).toHaveBeenCalledWith('leave_apply', {
        targetNodes: [],
      });
    });
  });

  it('全部开启时提交 null，让流程新增节点自动继承通知', async () => {
    (notificationSettingApi.list as jest.Mock).mockResolvedValue({
      code: 0,
      data: [{ eventType: 'leave_apply', targetRoles: [], targetNodes: null }],
    });
    render(<NotificationSettingsPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getAllByText('保存')[0]);

    await waitFor(() => {
      expect(notificationSettingApi.setTargets).toHaveBeenCalledWith('leave_apply', {
        targetNodes: null,
      });
    });
  });

  it('终态开关关闭时，通过/驳回两个事件都写入空数组', async () => {
    render(<NotificationSettingsPage />);
    await screen.findByText('请假审批');

    const resultSwitch = screen.getByLabelText('请假审批 结果通知申请人');
    expect(resultSwitch).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(resultSwitch);
    fireEvent.click(screen.getAllByText('保存')[0]);

    await waitFor(() => {
      expect(notificationSettingApi.setTargets).toHaveBeenCalledWith('leave_approval', {
        targetRoles: [],
      });
      expect(notificationSettingApi.setTargets).toHaveBeenCalledWith('leave_rejection', {
        targetRoles: [],
      });
    });
  });

  it('无流程事件退化为单收件方选择（不是多选）', async () => {
    render(<NotificationSettingsPage />);
    await screen.findByText('迟到行为提醒');

    const select = screen.getByLabelText('迟到行为提醒 收件方');
    expect(select).toHaveAttribute('data-value', 'dept_manager');
  });

  it('流程读取失败时提示且禁用节点保存，而不是静默显示空流程', async () => {
    (approvalApi.listWorkflows as jest.Mock).mockResolvedValue({
      code: 403,
      message: '无审批流程查看权限',
    });
    render(<NotificationSettingsPage />);

    const alerts = await screen.findAllByText(/审批流程读取失败/);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].textContent).toContain('无审批流程查看权限');
  });

  it('通知策略读取失败时展示错误态并可重试', async () => {
    (notificationSettingApi.list as jest.Mock).mockResolvedValue({ code: 500, message: '读取失败' });
    render(<NotificationSettingsPage />);
    expect(await screen.findByText('读取失败')).toBeInTheDocument();
  });
});
