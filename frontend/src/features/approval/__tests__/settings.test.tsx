import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApprovalSettingsPage from '@/features/approval/pages/settings';
import { approvalApi } from '@/services/approval';
import { systemApi } from '@/services/system';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/approval', () => ({
  approvalApi: {
    listWorkflows: jest.fn(),
    createWorkflow: jest.fn(),
    updateWorkflow: jest.fn(),
    deleteWorkflow: jest.fn(),
    restoreWorkflow: jest.fn(),
    getWorkflowDetail: jest.fn(),
    updateWorkflowNodes: jest.fn(),
    // 节点配置弹窗的参考数据：审批组 / 角色
    listGroups: jest.fn(),
    listRoleWorkflows: jest.fn(),
  },
}));

// 成员姓名来自用户列表；弹窗只读展示，这里给最小可用数据
jest.mock('@/services/system', () => ({
  systemApi: {
    listUsers: jest.fn(),
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

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

// Arco Select 在 jsdom 中不可操作，替换为原生 select；Form.Item 会把 value/onChange
// 克隆进来，因此仍能驱动真实的表单取值与校验链路。
// options 数组也必须铺成 <option>，否则「审批类型 / 人员」这类用 options 的下拉在测试里
// 只剩占位项；onChange 回传原始 value 类型（number 保持 number），与 Arco 行为一致。
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  const Select: any = ({ value, onChange, children, placeholder, options }: any) => (
    <select
      data-testid="form-select"
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        const matched = (options ?? []).find((o: any) => String(o.value) === raw);
        onChange?.(matched ? matched.value : raw);
      }}
    >
      <option value="">{placeholder || '请选择'}</option>
      {children}
      {(options ?? []).map((o: any) => (
        <option key={String(o.value)} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  Select.Option = ({ value, children }: any) => <option value={value}>{children}</option>;
  return { ...actual, Select };
});

const workflows = [
  {
    id: 1,
    code: 'leave',
    name: '请假审批流程',
    module: 'attendance',
    status: 'active',
    nodes: [],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    code: 'reimbursement',
    name: '报销审批流程',
    module: 'reimbursement',
    status: 'active',
    nodes: [],
    createdAt: '',
    updatedAt: '',
  },
];

describe('ApprovalSettingsPage（流程设置）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (approvalApi.listWorkflows as jest.Mock).mockResolvedValue({ code: 0, data: workflows });
    (approvalApi.createWorkflow as jest.Mock).mockResolvedValue({ code: 0, data: { id: 3 } });
    (approvalApi.updateWorkflow as jest.Mock).mockResolvedValue({ code: 0, data: {} });
    (approvalApi.listGroups as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [], total: 0 },
    });
    (approvalApi.listRoleWorkflows as jest.Mock).mockResolvedValue({ code: 0, data: [] });
    (systemApi.listUsers as jest.Mock).mockResolvedValue({ code: 0, data: { list: [], total: 0 } });
  });

  it('列表用中文业务名标注业务编码，配置流程可追溯到具体业务流', async () => {
    render(<ApprovalSettingsPage />);

    expect(await screen.findByText('请假审批（leave）')).toBeInTheDocument();
    expect(await screen.findByText('报销审批（reimbursement）')).toBeInTheDocument();
    // 业务分组用中文展示，不暴露内部 module 值
    expect(screen.getAllByText('考勤').length).toBeGreaterThan(0);
  });

  it('新建流程必须选择业务编码，并按业务归属自动推导 module 后提交', async () => {
    render(<ApprovalSettingsPage />);
    await screen.findByText('请假审批（leave）');

    fireEvent.click(screen.getByText('新建审批流程'));
    const nameInput = await screen.findByPlaceholderText('请输入流程名称');
    fireEvent.change(nameInput, { target: { value: '加班审批流程' } });

    // 业务编码下拉里包含登记的业务编码
    const selects = screen.getAllByTestId('form-select');
    const bizSelect = selects[0];
    expect(bizSelect.querySelector('option[value="overtime"]')).not.toBeNull();

    fireEvent.change(bizSelect, { target: { value: 'overtime' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => expect(approvalApi.createWorkflow).toHaveBeenCalledTimes(1));
    expect(approvalApi.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'overtime',
        module: 'attendance',
        name: '加班审批流程',
        nodes: [],
      }),
    );
  });

  it('编辑已有流程时不提交 code（编码不可变），并沿用其业务分组', async () => {
    render(<ApprovalSettingsPage />);
    await screen.findByText('请假审批（leave）');

    const editButtons = screen.getAllByText('编辑信息');
    fireEvent.click(editButtons[0]);

    const codeInput = await screen.findByDisplayValue('leave');
    expect(codeInput).toBeDisabled();

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => expect(approvalApi.updateWorkflow).toHaveBeenCalledTimes(1));
    const payload = (approvalApi.updateWorkflow as jest.Mock).mock.calls[0][1];
    expect(payload).not.toHaveProperty('code');
    expect(payload.module).toBe('attendance');
  });

  it('节点配置弹窗用中文选择器配置审批人，不再让用户手填组 ID / 英文字段名', async () => {
    render(<ApprovalSettingsPage />);
    await screen.findByText('请假审批（leave）');

    fireEvent.click(screen.getAllByText('配置节点')[0]);
    // Arco Modal 是 portal 到 body 的，用 document 查询；+ 按钮在左侧「节点列表」标题栏
    const addButton = document.querySelector('.appr-flow-col-head .arco-btn');
    expect(addButton).not.toBeNull();
    fireEvent.click(addButton as Element);

    // 右侧配置项全部中文
    expect(await screen.findByText('节点名称')).toBeInTheDocument();
    expect(screen.getByText('审批类型')).toBeInTheDocument();
    expect(screen.getByText('审批人')).toBeInTheDocument();
    expect(screen.getByText('生效条件')).toBeInTheDocument();
    expect(screen.getByText('条件字段')).toBeInTheDocument();

    // 手填 ID 与英文占位符必须消失（原先的「审批组 ID」「如：amount、days」）
    const dialogText = document.body.textContent ?? '';
    expect(dialogText).not.toContain('审批组 ID');
    expect(dialogText).not.toContain('如：amount');
    expect(dialogText).not.toContain('角色编码');
  });

  it('节点可指定具体审批人：选中后展示人员卡片，保存时提交 userId', async () => {
    (systemApi.listUsers as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [
          {
            id: 7,
            username: 'zhangwei',
            name: '张伟',
            status: 'active',
            createdAt: '',
            roles: [{ id: 1, code: 'manager', name: '主管' }],
          },
        ],
        total: 1,
      },
    });

    render(<ApprovalSettingsPage />);
    await screen.findByText('请假审批（leave）');

    fireEvent.click(screen.getAllByText('配置节点')[0]);
    fireEvent.click(document.querySelector('.appr-flow-col-head .arco-btn') as Element);

    // 审批类型切到「指定人员」
    const typeSelect = document.querySelectorAll('select[data-testid="form-select"]')[0];
    fireEvent.change(typeSelect, { target: { value: 'user' } });
    expect(await screen.findByText('尚未选择审批人')).toBeInTheDocument();

    // 人员下拉里能选到具体账号
    await waitFor(() => {
      const userSelect = document.querySelectorAll('select[data-testid="form-select"]')[1];
      expect(userSelect?.querySelector('option[value="7"]')).not.toBeNull();
    });
    const userSelect = document.querySelectorAll('select[data-testid="form-select"]')[1];
    fireEvent.change(userSelect, { target: { value: '7' } });

    // 人员卡片：姓名 + 登录名/角色，未选人提示消失
    await waitFor(() => expect(screen.getAllByText('张伟').length).toBeGreaterThan(0));
    expect(screen.getByText('zhangwei · 主管')).toBeInTheDocument();
    expect(screen.queryByText('尚未选择审批人')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('保存配置'));
    await waitFor(() => expect(approvalApi.updateWorkflow).toHaveBeenCalledTimes(1));
    const payload = (approvalApi.updateWorkflow as jest.Mock).mock.calls[0][1];
    expect(payload.nodes[0]).toEqual(
      expect.objectContaining({ type: 'user', userId: 7 }),
    );
  });
});
