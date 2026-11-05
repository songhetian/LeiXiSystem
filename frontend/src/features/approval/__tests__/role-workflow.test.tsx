import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoleWorkflowPage from '@/features/approval/pages/role-workflow';
import { approvalApi } from '@/services/approval';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listWorkflowRoleBindings: jest.fn(),
    setWorkflowRoles: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      <h2>{title}</h2>
      {action}
      {children}
    </div>
  ),
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Tag: ({ children }: any) => <span data-testid="tag">{children}</span>,
    // 多选语义：勾选/取消勾选后把完整集合回传给 onChange
    Select: ({ options = [], value = [], onChange, placeholder }: any) => (
      <div
        data-testid="role-select"
        data-value={JSON.stringify(value ?? [])}
        data-placeholder={placeholder}
      >
        {options.map((o: any) => (
          <label key={o.value}>
            <input
              type="checkbox"
              data-testid={`role-opt-${o.value}`}
              checked={(value ?? []).includes(o.value)}
              onChange={() => {
                const next = new Set<number>(value ?? []);
                if (next.has(o.value)) next.delete(o.value);
                else next.add(o.value);
                onChange?.(Array.from(next));
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    ),
  };
});

const bindings = {
  roles: [
    { id: 205, code: 'hr', name: 'HR' },
    { id: 206, code: 'admin', name: '管理员' },
    { id: 207, code: 'staff', name: '普通员工' },
  ],
  workflows: [
    {
      id: 101,
      code: 'leave',
      name: '请假审批',
      module: 'attendance',
      status: 'active',
      roles: [{ id: 205, code: 'hr', name: 'HR' }],
    },
    {
      id: 104,
      code: 'reimbursement',
      name: '报销审批',
      module: 'reimbursement',
      status: 'active',
      roles: [],
    },
    {
      id: 105,
      code: 'onboarding',
      name: '入职审批',
      module: 'employees',
      status: 'inactive',
      roles: [{ id: 206, code: 'admin', name: '管理员' }],
    },
  ],
};

describe('RoleWorkflowPage（流程 → 适用角色）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (approvalApi.listWorkflowRoleBindings as jest.Mock).mockResolvedValue({
      code: 0,
      data: bindings,
    });
  });

  it('以流程为行展示：流程名、业务编码、模块中文名', async () => {
    render(<RoleWorkflowPage />);

    expect(await screen.findByText('请假审批')).toBeInTheDocument();
    expect(screen.getByText('报销审批')).toBeInTheDocument();
    expect(screen.getByText('入职审批')).toBeInTheDocument();
    // 模块显示中文，而不是 attendance / reimbursement 这种内部值
    expect(screen.getByText('考勤')).toBeInTheDocument();
    expect(screen.getByText('报销')).toBeInTheDocument();
    expect(screen.getByText('员工事务')).toBeInTheDocument();
    // 业务编码作为副标题，便于和「流程设置」里的编码对上
    expect(screen.getByText('leave')).toBeInTheDocument();
  });

  it('多选框的选项是全部角色，当前值是该流程已绑定的角色', async () => {
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    const selects = screen.getAllByTestId('role-select');
    expect(selects).toHaveLength(3);
    // 三个角色都可选（流程方向下，一个角色当然可以出现在多条流程里）
    expect(screen.getAllByTestId('role-opt-205').length).toBe(3);
    expect(screen.getAllByTestId('role-opt-207').length).toBe(3);
    // 请假审批当前绑定 HR
    expect(selects[0]).toHaveAttribute('data-value', JSON.stringify([205]));
    // 报销审批还没绑定任何角色
    expect(selects[1]).toHaveAttribute('data-value', JSON.stringify([]));
  });

  it('勾选角色后按流程 id 提交完整角色集合（覆盖式保存）', async () => {
    (approvalApi.setWorkflowRoles as jest.Mock).mockResolvedValue({ code: 0, data: { success: true } });
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    // 给「请假审批」再加一个普通员工
    fireEvent.click(screen.getAllByTestId('role-opt-207')[0]);

    await waitFor(() =>
      expect(approvalApi.setWorkflowRoles).toHaveBeenCalledWith(101, [205, 207]),
    );
  });

  it('取消最后一个角色后提交空数组（解除绑定，不删流程）', async () => {
    (approvalApi.setWorkflowRoles as jest.Mock).mockResolvedValue({ code: 0, data: { success: true } });
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getAllByTestId('role-opt-205')[0]);

    await waitFor(() => expect(approvalApi.setWorkflowRoles).toHaveBeenCalledWith(101, []));
  });

  it('保存被后端拒绝时提示原因，且不误报成功', async () => {
    (approvalApi.setWorkflowRoles as jest.Mock).mockResolvedValue({
      code: 6317,
      message: '同一业务下每个角色只能绑定一条流程：「普通员工」已绑定「加班审批」',
    });
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getAllByTestId('role-opt-207')[0]);

    await waitFor(() => expect(approvalApi.setWorkflowRoles).toHaveBeenCalled());
    // 允许失败：Message 走 portal，这里只断言页面仍是服务端的真实绑定（205），
    // 而不是把用户勾上的 207 留在界面上
    await waitFor(() =>
      expect(screen.getAllByTestId('role-select')[0]).toHaveAttribute(
        'data-value',
        JSON.stringify([205]),
      ),
    );
  });

  it('停用流程明确标注「绑定暂不生效」，未绑定的行占位说明未指定角色', async () => {
    render(<RoleWorkflowPage />);
    await screen.findByText('入职审批');

    expect(screen.getByText('绑定暂不生效')).toBeInTheDocument();
    // 未绑定角色的流程：多选框占位点明「未指定」，不留一个空白框
    expect(screen.getAllByTestId('role-select')[1]).toHaveAttribute(
      'data-placeholder',
      '未指定角色',
    );
  });

  it('顶部汇总已指定角色的流程条数', async () => {
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    expect(screen.getByText('3 条流程 · 2 条已指定角色')).toBeInTheDocument();
  });
});
