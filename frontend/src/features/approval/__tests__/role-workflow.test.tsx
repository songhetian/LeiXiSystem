import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoleWorkflowPage from '@/features/approval/pages/role-workflow';
import { approvalApi } from '@/services/approval';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listWorkflowRoleBindings: jest.fn(),
    setWorkflowRoles: jest.fn(),
    setWorkflowRolesBatch: jest.fn(),
  },
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ action, children }: any) => (
    <div data-testid="page-container">
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
    // 弹窗只看 visible：真 Modal 走 portal，jsdom 里取不到内容
    Modal: ({ visible, title, children, onOk, okText, okButtonProps }: any) =>
      visible ? (
        <div data-testid="bulk-modal">
          <h3>{title}</h3>
          {children}
          <button data-testid="bulk-ok" onClick={onOk} disabled={okButtonProps?.disabled}>
            {okText}
          </button>
        </div>
      ) : null,
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
    (approvalApi.setWorkflowRoles as jest.Mock).mockResolvedValue({ code: 0, data: {} });
    (approvalApi.setWorkflowRolesBatch as jest.Mock).mockResolvedValue({
      code: 0,
      data: { success: true },
    });
  });

  it('按业务模块分组：模块中文名 + 每组条数，行内是流程名与业务编码', async () => {
    render(<RoleWorkflowPage />);

    expect(await screen.findByText('请假审批')).toBeInTheDocument();
    // 模块显示中文，而不是 attendance / reimbursement 这种内部值；一个模块一个分组头
    expect(screen.getByText('考勤')).toBeInTheDocument();
    expect(screen.getByText('报销')).toBeInTheDocument();
    expect(screen.getByText('员工事务')).toBeInTheDocument();
    // 业务编码作为副标题，便于和「流程设置」里的编码对上
    expect(screen.getByText('leave')).toBeInTheDocument();
    // 分组头给出本组进度（考勤与员工事务各 1 条、都已指定角色），页头给出全局进度
    expect(screen.getAllByText('1 条流程 · 1 条已指定角色')).toHaveLength(2);
    expect(screen.getByText('3 条流程 · 2 条已指定角色')).toBeInTheDocument();
  });

  it('多选框的选项是全部角色，当前值是该流程已绑定的角色', async () => {
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    const selects = screen.getAllByTestId('role-select');
    expect(selects).toHaveLength(3);
    expect(screen.getAllByTestId('role-opt-205').length).toBe(3);
    expect(screen.getAllByTestId('role-opt-207').length).toBe(3);
    expect(selects[0]).toHaveAttribute('data-value', JSON.stringify([205]));
    expect(selects[1]).toHaveAttribute('data-value', JSON.stringify([]));
  });

  it('勾选角色后按流程 id 提交完整角色集合（覆盖式保存）', async () => {
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getAllByTestId('role-opt-207')[0]);

    await waitFor(() =>
      expect(approvalApi.setWorkflowRoles).toHaveBeenCalledWith(101, [205, 207]),
    );
  });

  it('点选后立刻回显，不等服务端返回（否则标签会先消失、revalidate 回来才出现）', async () => {
    // Arco 的 Select 完全受控：value 只认 props。若这里不挂乐观值，
    // 点选后那次重渲染会把它弹回旧集合，用户看到的是「点了没反应」。
    let finishSave: (v: unknown) => void = () => {};
    (approvalApi.setWorkflowRoles as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        finishSave = resolve;
      }),
    );
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getAllByTestId('role-opt-207')[0]);

    // 请求还悬着，界面必须已经显示新集合
    expect(screen.getAllByTestId('role-select')[0]).toHaveAttribute(
      'data-value',
      JSON.stringify([205, 207]),
    );

    finishSave({ code: 0, data: {} });
    await waitFor(() =>
      expect(approvalApi.listWorkflowRoleBindings).toHaveBeenCalledTimes(2),
    );
  });

  it('行内「全部角色」一键套用全部角色，不再逐个人点选', async () => {
    render(<RoleWorkflowPage />);
    await screen.findByText('报销审批');

    // 行内快捷按钮按行出现：请假 / 报销 / 入职
    fireEvent.click(screen.getAllByText('全部角色')[1]);

    await waitFor(() =>
      expect(approvalApi.setWorkflowRoles).toHaveBeenCalledWith(104, [205, 206, 207]),
    );
  });

  it('行内「清空」提交空数组（解除绑定，不删流程）', async () => {
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    fireEvent.click(screen.getAllByText('清空')[0]);

    await waitFor(() => expect(approvalApi.setWorkflowRoles).toHaveBeenCalledWith(101, []));
  });

  it('已绑定全部角色的行，「全部角色」按钮不可再点', async () => {
    (approvalApi.listWorkflowRoleBindings as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        ...bindings,
        workflows: [
          {
            ...bindings.workflows[0],
            roles: [
              { id: 205, code: 'hr', name: 'HR' },
              { id: 206, code: 'admin', name: '管理员' },
              { id: 207, code: 'staff', name: '普通员工' },
            ],
          },
        ],
      },
    });
    render(<RoleWorkflowPage />);
    await screen.findByText('请假审批');

    // Arco Button 把文案包在 <span> 里，禁用属性在按钮上
    expect(screen.getByText('全部角色').closest('button')).toBeDisabled();
  });

  it('保存被后端拒绝时提示原因，并回到服务端的真实绑定', async () => {
    (approvalApi.setWorkflowRoles as jest.Mock).mockResolvedValue({
      code: 5000,
      message: '保存失败',
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
    expect(screen.getAllByTestId('role-select')[1]).toHaveAttribute(
      'data-placeholder',
      '未指定角色',
    );
  });

  describe('批量设置', () => {
    it('全部流程 + 全选角色 → 一次事务提交所有流程（不再逐条请求）', async () => {
      render(<RoleWorkflowPage />);
      await screen.findByText('请假审批');

      fireEvent.click(screen.getByText('批量设置'));
      const modal = screen.getByTestId('bulk-modal');
      fireEvent.click(within(modal).getByText('全选'));
      fireEvent.click(screen.getByTestId('bulk-ok'));

      await waitFor(() =>
        expect(approvalApi.setWorkflowRolesBatch).toHaveBeenCalledWith({
          workflowIds: [101, 104, 105],
          roleIds: [205, 206, 207],
          mode: 'replace',
        }),
      );
      // 单条接口不该被顺带调用：13 条流程循环发请求会留下「一半新一半旧」
      expect(approvalApi.setWorkflowRoles).not.toHaveBeenCalled();
    });

    it('未选角色时先说明「将清空」的后果，避免误把 13 条流程一起清空', async () => {
      render(<RoleWorkflowPage />);
      await screen.findByText('请假审批');

      fireEvent.click(screen.getByText('批量设置'));

      const summary = screen.getByText('将清空「全部流程」3 条流程的全部适用角色');
      // 覆盖式清空是合法操作，但必须挂警示色，不能和「设为某组角色」长得一样
      expect(summary).toHaveClass('is-warn');
      expect(screen.getByTestId('bulk-ok')).not.toBeDisabled();
    });

    it('模块头的「本组批量设置」把范围收窄到该模块', async () => {
      render(<RoleWorkflowPage />);
      await screen.findByText('请假审批');

      // 三个模块各有一个入口，第一个是考勤（只有请假审批一条）
      fireEvent.click(screen.getAllByText('本组批量设置')[0]);
      const modal = screen.getByTestId('bulk-modal');
      fireEvent.click(within(modal).getByText('全选'));
      fireEvent.click(screen.getByTestId('bulk-ok'));

      await waitFor(() =>
        expect(approvalApi.setWorkflowRolesBatch).toHaveBeenCalledWith({
          workflowIds: [101],
          roleIds: [205, 206, 207],
          mode: 'replace',
        }),
      );
    });
  });
});
