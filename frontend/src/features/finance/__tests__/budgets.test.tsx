import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import BudgetsPage from '@/features/finance/pages/budgets';
import { financeApi } from '@/services/finance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/finance', () => ({
  financeApi: {
    listBudgets: jest.fn(),
    createBudget: jest.fn(),
    updateBudget: jest.fn(),
    deleteBudget: jest.fn(),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({ departments: [] }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ children }: any) => <>{children}</>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, error }: any) => (
    <div data-testid="pro-table" data-loading={!!loading} data-error={error ?? ''}>
      <table>
        <thead>
          <tr>
            {columns.map((c: any) => (
              <th key={c.dataIndex}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((c: any) => (
                <td key={c.dataIndex}>
                  {c.render ? c.render(row[c.dataIndex], row, 0) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
}));

const budget = {
  id: 1,
  year: new Date().getFullYear(),
  departmentId: null,
  departmentName: '',
  category: '差旅',
  totalAmount: 120000,
  usedAmount: 30000,
  remark: '',
};

describe('BudgetsPage（预算管理）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({ code: 0, data: { list: [budget] } });
  });

  it('总额/已用/剩余按 formatMoney 展示，并算出剩余', async () => {
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getByText('¥ 120,000.00')).toBeInTheDocument());
    expect(screen.getByText('¥ 30,000.00')).toBeInTheDocument();
    expect(screen.getByText('¥ 90,000.00')).toBeInTheDocument();
  });

  it('部门为空时标注「公司总预算」，类别为空时显示 --', async () => {
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [{ ...budget, category: '' }] },
    });
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getByText('公司总预算')).toBeInTheDocument());
    // 类别与备注都为空 → 均回退为 '--'
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
  });

  it('业务码非 0 时向 ProTable 传错误态，而非「暂无预算数据」', async () => {
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({ code: 500, message: '预算读取失败' });
    render(<BudgetsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-error', '预算读取失败');
    });
  });

  it('默认筛选年份按北京时间取：元旦早晨（UTC 仍是上一年）查的是新年度', async () => {
    jest.useFakeTimers();
    // 2025-12-31T16:30:00Z = 北京时间 2026-01-01 00:30
    jest.setSystemTime(new Date('2025-12-31T16:30:00Z'));

    render(<BudgetsPage />);

    await waitFor(() =>
      expect(financeApi.listBudgets).toHaveBeenCalledWith(expect.objectContaining({ year: 2026 })),
    );
    jest.useRealTimers();
  });

  it('点击编辑回填该行数据（不是空表单）', async () => {
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [{ ...budget, remark: '差旅说明' }] },
    });
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getByText('编辑')).toBeInTheDocument());
    fireEvent.click(screen.getByText('编辑'));

    await waitFor(() => expect(screen.getByText('编辑预算')).toBeInTheDocument());
    // 备注是普通输入框，最直观地证明表单被回填；此前点编辑永远是空表单
    expect(screen.getByDisplayValue('差旅说明')).toBeInTheDocument();
  });
});
