import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoleWorkflowPage from '@/features/approval/pages/role-workflow';
import { approvalApi } from '@/services/approval';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listRoleWorkflows: jest.fn(),
    listWorkflows: jest.fn(),
    setRoleWorkflow: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="page-container">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

jest.mock('@/components/DataState', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="data-state">{children}</div>,
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Tag: ({ color, children }: any) => <span data-testid="tag" data-color={color}>{children}</span>,
    Select: ({ options, disabled, placeholder }: any) => (
      <select
        data-testid="workflow-select"
        data-options={JSON.stringify(options || [])}
        data-disabled={disabled ? 'true' : 'false'}
        data-placeholder={placeholder}
      >
        <option value="">默认</option>
        {(options || []).map((o: any) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ),
  };
});

const roleWorkflows = [
  { id: 1, code: 'ROLE001', name: '普通员工', description: '默认员工角色', workflowId: null },
  { id: 2, code: 'ROLE002', name: '部门主管', description: '主管角色', workflowId: 10, workflowName: '主管审批流程' },
];

const workflows = [
  { id: 10, code: 'WF01', name: '主管审批流程', module: 'attendance', status: 'active', nodes: [], createdAt: '', updatedAt: '' },
  { id: 11, code: 'WF02', name: 'HR审批流程', module: 'attendance', status: 'active', nodes: [], createdAt: '', updatedAt: '' },
];

describe('RoleWorkflowPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (approvalApi.listRoleWorkflows as jest.Mock).mockResolvedValue({ code: 0, data: roleWorkflows });
    (approvalApi.listWorkflows as jest.Mock).mockResolvedValue({ code: 0, data: workflows });
  });

  it('加载角色流程绑定列表并展示角色名与编码', async () => {
    render(<RoleWorkflowPage />);
    expect(await screen.findByText('普通员工')).toBeInTheDocument();
    expect(await screen.findByText('部门主管')).toBeInTheDocument();
    expect(screen.getAllByTestId('tag').length).toBeGreaterThan(0);
  });

  it('staleTime 内二次挂载复用缓存，listRoleWorkflows 仅请求一次', async () => {
    const { unmount } = render(<RoleWorkflowPage />);
    await waitFor(() => expect(approvalApi.listRoleWorkflows).toHaveBeenCalledTimes(1));
    unmount();
    render(<RoleWorkflowPage />);
    // useCachedData 模块级缓存未清空，二次挂载直接复用缓存，不重复请求
    await waitFor(() => expect(screen.getAllByText('普通员工').length).toBeGreaterThan(0));
    expect(approvalApi.listRoleWorkflows).toHaveBeenCalledTimes(1);
  });

  it('可选流程加载失败时明示失败并禁用绑定下拉，而非静默空下拉', async () => {
    (approvalApi.listWorkflows as jest.Mock).mockResolvedValue({
      code: 500,
      message: '获取审批流程列表失败',
    });
    render(<RoleWorkflowPage />);

    // 角色列表本身可用，仍要能看见角色行
    expect(await screen.findByText('普通员工')).toBeInTheDocument();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('审批流程列表加载失败');
    expect(alert).toHaveTextContent('获取审批流程列表失败');

    // 下拉禁用 + 占位文案点明原因，避免用户以为系统里没有可用流程
    const select = screen.getAllByTestId('workflow-select')[0];
    expect(select).toHaveAttribute('data-disabled', 'true');
    expect(select).toHaveAttribute('data-placeholder', '流程列表加载失败');
  });

  it('流程列表失败后点重试恢复下拉可选', async () => {
    (approvalApi.listWorkflows as jest.Mock).mockResolvedValueOnce({
      code: 500,
      message: '获取审批流程列表失败',
    });
    render(<RoleWorkflowPage />);
    const retry = await screen.findByText('重试');

    (approvalApi.listWorkflows as jest.Mock).mockResolvedValue({ code: 0, data: workflows });
    fireEvent.click(retry);

    await waitFor(() => {
      const select = screen.getAllByTestId('workflow-select')[0];
      expect(select).toHaveAttribute('data-disabled', 'false');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});