import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SettingsPage from '@/features/expense/pages/settings';
import { reimbursementApi } from '@/services/reimbursement';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/reimbursement', () => ({
  reimbursementApi: {
    getAllTypes: jest.fn(),
    createType: jest.fn(),
    updateType: jest.fn(),
    deleteType: jest.fn(),
    getAllExpenseTypes: jest.fn(),
    createExpenseType: jest.fn(),
    updateExpenseType: jest.fn(),
    deleteExpenseType: jest.fn(),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/lib/request', () => ({
  notifyError: jest.fn(),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, subTitle, children }: any) => (
    <div data-testid="page-container">
      {title && <h2 data-testid="page-title">{title}</h2>}
      <div data-testid="page-sub">{subTitle}</div>
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@/components/DataState', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="data-state">{children}</div>,
}));

const mockTypes = [
  { id: 1, name: '差旅费', code: 'TRAVEL', status: 'active', description: '出差相关' },
  { id: 2, name: '餐饮费', code: 'MEAL', status: 'inactive' },
];

const mockExpenseTypes = [
  { id: 1, name: '市内交通费', unit: '次', sortOrder: 0, status: 'active' },
  { id: 2, name: '招待餐费', unit: '次', sortOrder: 1, status: 'active' },
];

describe('ReimbursementSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache(); // useCachedData 模块级共享缓存需在用例间清空，防止缓存串数据
    (reimbursementApi.getAllTypes as jest.Mock).mockResolvedValue({ code: 0, data: mockTypes });
    (reimbursementApi.getAllExpenseTypes as jest.Mock).mockResolvedValue({ code: 0, data: mockExpenseTypes });
    (reimbursementApi.createExpenseType as jest.Mock).mockResolvedValue({ code: 0, data: { id: 3 } });
    (reimbursementApi.updateExpenseType as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });
    (reimbursementApi.deleteExpenseType as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });
  });

  it('渲染两个页签并同时加载一级类型与二级费用类型', async () => {
    render(<SettingsPage />);
    await waitFor(() => {
      expect(reimbursementApi.getAllTypes).toHaveBeenCalled();
      expect(reimbursementApi.getAllExpenseTypes).toHaveBeenCalled();
    });
    expect(screen.getByRole('tab', { name: '报销类型' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '费用类型（二级）' })).toBeInTheDocument();
  });

  it('费用类型（二级）页签渲染二级费用类型列表', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await user.click(screen.getByRole('tab', { name: '费用类型（二级）' }));
    expect(await screen.findByText('市内交通费')).toBeInTheDocument();
    expect(screen.getByText('招待餐费')).toBeInTheDocument();
    expect(screen.getAllByText('次').length).toBe(2);
  });

  const getExpenseRow = async (name: string) => {
    const el = await screen.findByText(name);
    return el.closest('tr') as HTMLElement;
  };

  const switchToExpenseTab = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('tab', { name: '费用类型（二级）' }));
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /新增费用类型/ }).length).toBeGreaterThan(0);
    });
  };

  it('新增费用类型调用 createExpenseType', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await switchToExpenseTab(user);
    await user.click(screen.getAllByRole('button', { name: /新增费用类型/ })[0]);

    await user.type(screen.getByPlaceholderText('如：市内交通费'), '会议室茶歇');
    await user.type(screen.getByPlaceholderText('如：次 / 份 / 天'), '份');
    await user.type(screen.getByPlaceholderText('数值越小越靠前'), '3');

    await user.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => {
      expect(reimbursementApi.createExpenseType).toHaveBeenCalledWith(
        { name: '会议室茶歇', unit: '份', sortOrder: 3 },
      );
    });
  });

  it('编辑费用类型调用 updateExpenseType', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await switchToExpenseTab(user);
    const row = await getExpenseRow('招待餐费');
    await user.click(Array.from(row.querySelectorAll('button')).find((b) => b.textContent === '编辑')!);

    const nameInput = screen.getByPlaceholderText('如：市内交通费') as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, '商务招待费');

    await user.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => {
      expect(reimbursementApi.updateExpenseType).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ name: '商务招待费', status: 'active' }),
      );
    });
  });

  it('删除费用类型调用 deleteExpenseType', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await switchToExpenseTab(user);
    const row = await getExpenseRow('市内交通费');
    await user.click(Array.from(row.querySelectorAll('button')).find((b) => b.textContent === '删除')!);
    // Popconfirm 弹层处于动画态时 pointer-events:none，用 fireEvent 绕过
    const okBtn = await screen.findByRole('button', { name: /确定/ });
    fireEvent.click(okBtn);
    await waitFor(() => {
      expect(reimbursementApi.deleteExpenseType).toHaveBeenCalledWith(1);
    });
  });
});