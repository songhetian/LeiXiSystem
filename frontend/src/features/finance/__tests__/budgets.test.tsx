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

// 部门参考数据：后端预算表只有 departmentId，部门名要靠这里映射
let mockDepartments: Array<{ id: number; name: string }> = [];
jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({ departments: mockDepartments, loading: false }),
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
  default: ({ columns, data, rowKey, loading, error, searchInitialValues, onSearch, toolbar = [] }: any) => (
    <div
      data-testid="pro-table"
      data-loading={!!loading}
      data-error={error ?? ''}
      // 页面默认按当前年查询，筛选框必须回填同一个年份
      data-initial-year={searchInitialValues?.year ?? ''}
    >
      {toolbar.map((t: any) => (
        <button key={t.key} type="button" disabled={t.disabled} onClick={t.onClick}>
          {t.label}
        </button>
      ))}
      <button
        data-testid="search-global"
        onClick={() => onSearch?.({ ...(searchInitialValues ?? {}), departmentId: 'global' })}
      >
        筛选公司总预算
      </button>
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

// 后端 Budget 真实字段：amount / usedAmount / note（Prisma Decimal 序列化为字符串）
const budget = {
  id: 1,
  year: new Date().getFullYear(),
  departmentId: null,
  category: '差旅',
  amount: '120000.00',
  usedAmount: '30000.00',
  note: '',
};

describe('BudgetsPage（预算管理）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockDepartments = [];
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({ code: 0, data: { list: [budget] } });
    (financeApi.createBudget as jest.Mock).mockResolvedValue({ code: 0, data: { id: 2 } });
  });

  it('总额/已用/剩余按后端 amount 字段展示，Decimal 字符串也能正确格式化', async () => {
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getByText('¥ 120,000.00')).toBeInTheDocument());
    expect(screen.getByText('¥ 30,000.00')).toBeInTheDocument();
    // 剩余 = amount - usedAmount
    expect(screen.getByText('¥ 90,000.00')).toBeInTheDocument();
  });

  it('部门为空时标注「公司总预算」，部门有值时映射成部门名而非公司总预算', async () => {
    mockDepartments = [{ id: 2, name: '研发部' }];
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        list: [
          budget,
          { ...budget, id: 2, departmentId: 2, category: '办公' },
          // 部门被删除/不可见时不能谎称是公司总预算
          { ...budget, id: 3, departmentId: 99, category: '培训' },
        ],
      },
    });
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(3));
    expect(screen.getByText('公司总预算')).toBeInTheDocument();
    expect(screen.getByText('研发部')).toBeInTheDocument();
    expect(screen.getByText('部门 #99')).toBeInTheDocument();
  });

  it('类别与备注为空时回退为 --', async () => {
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [{ ...budget, category: '', note: null }] },
    });
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));
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

    try {
      render(<BudgetsPage />);

      await waitFor(() =>
        expect(financeApi.listBudgets).toHaveBeenCalledWith(expect.objectContaining({ year: 2026 })),
      );
      // 默认筛选条件必须回填到界面上，否则用户不知道数据已被某一年过滤
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-initial-year', '2026');
    } finally {
      jest.useRealTimers();
    }
  });

  it('「公司总预算」筛选只展示没有部门的预算（后端不支持该条件，需本地过滤）', async () => {
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [budget, { ...budget, id: 2, departmentId: 2, category: '办公' }] },
    });
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

    fireEvent.click(screen.getByTestId('search-global'));

    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));
  });

  it('点击编辑回填该行数据（不是空表单）', async () => {
    (financeApi.listBudgets as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [{ ...budget, note: '差旅说明' }] },
    });
    render(<BudgetsPage />);

    await waitFor(() => expect(screen.getByText('编辑')).toBeInTheDocument());
    fireEvent.click(screen.getByText('编辑'));

    await waitFor(() => expect(screen.getByText('编辑预算')).toBeInTheDocument());
    // 备注字段名是 note：读 remark 的话这里永远回填不出内容
    expect(screen.getByDisplayValue('差旅说明')).toBeInTheDocument();
    // 金额字段名是 amount：Decimal 字符串要能回填成数字（InputNumber 会按 precision 格式化）
    expect(screen.getByPlaceholderText('请输入预算总额')).toHaveValue('120000.00');
  });

  it('新建预算提交 amount / note（提交 totalAmount / remark 会被后端 zod 挡回 400）', async () => {
    render(<BudgetsPage />);
    await waitFor(() => expect(screen.getByText('+ 新建预算')).toBeInTheDocument());

    fireEvent.click(screen.getByText('+ 新建预算'));
    await waitFor(() => expect(screen.getByText('新建预算')).toBeInTheDocument());

    // 类别：点击下拉后选择预设值（表格里也有「差旅」单元格，需限定 role=option）
    fireEvent.click(screen.getByPlaceholderText('选择或输入预算类别'));
    fireEvent.click(await screen.findByRole('option', { name: '差旅' }));

    const amountInput = screen.getByPlaceholderText('请输入预算总额');
    fireEvent.change(amountInput, { target: { value: '50000' } });

    const noteInput = screen.getByPlaceholderText('请输入备注（可选）');
    fireEvent.change(noteInput, { target: { value: '年度差旅预算' } });

    fireEvent.click(screen.getByText('确定'));

    await waitFor(() => expect(financeApi.createBudget).toHaveBeenCalled());
    const dto = (financeApi.createBudget as jest.Mock).mock.calls[0][0];
    expect(dto).toEqual(
      expect.objectContaining({ amount: 50000, note: '年度差旅预算', departmentId: null }),
    );
    expect(dto).not.toHaveProperty('totalAmount');
    expect(dto).not.toHaveProperty('remark');
  });
});
