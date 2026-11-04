import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ApprovalSettingsPage from '@/features/approval/pages/settings';
import { approvalApi } from '@/services/approval';
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
// 克隆进来，因此仍能驱动真实的表单取值与校验链路
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  const Select: any = ({ value, onChange, children, placeholder }: any) => (
    <select
      data-testid="form-select"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="">{placeholder || '请选择'}</option>
      {children}
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
});
