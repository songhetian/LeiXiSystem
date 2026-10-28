import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ExpenseStandardsPage from '@/features/finance/pages/expense-standards';
import { financeApi } from '@/services/finance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/finance', () => ({
  financeApi: {
    listExpenseStandards: jest.fn(),
    createExpenseStandard: jest.fn(),
    updateExpenseStandard: jest.fn(),
    toggleExpenseStandard: jest.fn(),
    deleteExpenseStandard: jest.fn(),
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
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

const standard = {
  id: 1,
  name: '差旅住宿标准',
  category: '住宿',
  amount: 500,
  unit: '元/晚',
  description: '一线城市上限',
  status: 'enabled' as const,
};

describe('ExpenseStandardsPage（费用标准）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (financeApi.listExpenseStandards as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [standard], total: 1, page: 1, pageSize: 20 },
    });
  });

  it('金额走 formatMoney，状态展示业务文案（启用）', async () => {
    render(<ExpenseStandardsPage />);

    await waitFor(() => expect(screen.getByText('¥ 500.00')).toBeInTheDocument());
    expect(screen.getByTestId('status-tag')).toHaveTextContent('启用');
    expect(screen.queryByText('enabled')).toBeNull();
  });

  it('业务码非 0 时向 ProTable 传错误态，而非「暂无费用标准数据」', async () => {
    (financeApi.listExpenseStandards as jest.Mock).mockResolvedValue({
      code: 500,
      message: '费用标准读取失败',
    });
    render(<ExpenseStandardsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-error', '费用标准读取失败');
    });
  });

  it('点击编辑回填该行数据（不是空表单）', async () => {
    render(<ExpenseStandardsPage />);

    await waitFor(() => expect(screen.getByText('编辑')).toBeInTheDocument());
    fireEvent.click(screen.getByText('编辑'));

    await waitFor(() => expect(screen.getByText('编辑费用标准')).toBeInTheDocument());
    expect(screen.getByDisplayValue('差旅住宿标准')).toBeInTheDocument();
    expect(screen.getByDisplayValue('一线城市上限')).toBeInTheDocument();
  });
});
