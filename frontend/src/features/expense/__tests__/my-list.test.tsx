import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MyReimbursementPage from '@/features/expense/pages/my-list';
import { reimbursementApi } from '@/services/reimbursement';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/reimbursement', () => ({
  reimbursementApi: {
    getTypes: jest.fn(),
    getExpenseTypes: jest.fn(),
    getMyReimbursements: jest.fn(),
    getDetail: jest.fn(),
    createReimbursement: jest.fn(),
    submitApproval: jest.fn(),
    cancelReimbursement: jest.fn(),
    removeReimbursement: jest.fn(),
  },
}));


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      {title && <h2 data-testid="page-title">{title}</h2>}
      <div data-testid="page-action">{action}</div>
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, searchFields, toolbar, pagination, onSearch, onPageChange, onRowClick }: any) => (
    <div data-testid="pro-table" data-loading={loading}>
      {searchFields && (
        <div data-testid="search-area">
          {searchFields.map((f: any) => (
            <span key={f.key} data-testid={`search-${f.key}`}>{f.label}</span>
          ))}
        </div>
      )}
      {toolbar && (
        <div data-testid="toolbar">
          {toolbar.map((t: any) => (
            <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <table>
        <thead>
          <tr>
            {columns.map((c: any) => (
              <th key={c.dataIndex} data-testid={`col-${c.dataIndex}`}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr
              key={row[rowKey]}
              data-testid="table-row"
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((c: any) => (
                <td key={c.dataIndex} data-testid={`cell-${row[rowKey]}-${c.dataIndex}`}>
                  {c.render ? c.render(row[c.dataIndex], row) : row[c.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pagination && pagination !== false && (
        <div data-testid="pagination">
          <span data-testid="page-current">{pagination.current}</span>
          <span data-testid="page-total">{pagination.total}</span>
        </div>
      )}
    </div>
  ),
}));

jest.mock('@/components/StatusTag', () => ({
  __esModule: true,
  default: ({ status }: any) => (
    <span data-testid={`status-tag-${status}`}>{status}</span>
  ),
}));

const mockReimbursements = [
  {
    id: 1,
    title: '8月北京出差报销',
    totalAmount: 1500,
    status: 'draft',
    departmentName: '技术部',
    applicantName: '张三',
    createdAt: '2026-08-13T10:00:00+08:00',
  },
  {
    id: 2,
    title: '7月上海差旅费',
    totalAmount: 2000,
    status: 'pending',
    departmentName: '技术部',
    applicantName: '张三',
    currentApproverName: '李主管',
    createdAt: '2026-07-15T10:00:00+08:00',
  },
  {
    id: 3,
    title: '6月团建餐饮费',
    totalAmount: 800,
    status: 'approved',
    departmentName: '技术部',
    applicantName: '张三',
    createdAt: '2026-06-20T10:00:00+08:00',
  },
];

const mockTypes = [
  { id: 1, name: '差旅费', code: 'TRAVEL', status: 'active' },
  { id: 2, name: '餐饮费', code: 'MEAL', status: 'active' },
];

const mockExpenseTypes = [
  { id: 1, name: '市内交通费', unit: '次', sortOrder: 0, status: 'active' },
  { id: 2, name: '招待餐费', unit: '次', sortOrder: 1, status: 'active' },
];

const mockDetail = {
  id: 1,
  reimbursementNo: 'BX20260813123456',
  title: '8月北京出差报销',
  typeName: '差旅费',
  totalAmount: 1500,
  status: 'draft',
  departmentName: '技术部',
  applicantName: '张三',
  description: '北京出差产生的交通和住宿费用',
  createdAt: '2026-08-13T10:00:00+08:00',
  items: [
    { id: 1, itemType: '市内交通费', amount: 1000, expenseDate: '2026-08-10', description: '打车', attachmentUrl: '/uploads/reimbursement/a.png' },
    { id: 2, itemType: '招待餐费', amount: 500, expenseDate: '2026-08-11', description: '客户用餐' },
  ],
  attachments: [
    { id: 1, fileName: '发票汇总.pdf', fileUrl: '/uploads/reimbursement/b.pdf' },
  ],
};

describe('MyReimbursementPage', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (reimbursementApi.getTypes as jest.Mock).mockResolvedValue({ code: 0, data: mockTypes });
    (reimbursementApi.getExpenseTypes as jest.Mock).mockResolvedValue({ code: 0, data: mockExpenseTypes });
    (reimbursementApi.getMyReimbursements as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { list: mockReimbursements, total: 3, page: 1, pageSize: 20 },
    });
    (reimbursementApi.getDetail as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: mockDetail });
    (reimbursementApi.createReimbursement as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: { id: 4 } });
    (reimbursementApi.submitApproval as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: { id: 1, status: 'pending' } });
    (reimbursementApi.cancelReimbursement as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: { id: 2, status: 'cancelled' } });
    (reimbursementApi.removeReimbursement as jest.Mock).mockResolvedValue({ code: 0, message: 'ok', data: { id: 1 } });
  });

  describe('正常用例', () => {
    it('不渲染冗余页面大标题（顶部已有全局面包屑）', () => {
      render(<MyReimbursementPage />);
      expect(screen.queryByTestId('page-title')).toBeNull();
    });

    it('renders ProTable with reimbursement columns', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-title')).toHaveTextContent('标题');
      expect(screen.getByTestId('col-totalAmount')).toHaveTextContent('金额');
      expect(screen.getByTestId('col-status')).toHaveTextContent('状态');
      expect(screen.getByTestId('col-createdAt')).toHaveTextContent('创建时间');
      expect(screen.getByTestId('col-actions')).toHaveTextContent('操作');
    });

    it('fetches reimbursements on mount', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(reimbursementApi.getMyReimbursements).toHaveBeenCalled();
      });
    });

    it('renders reimbursement data in table', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getByTestId('cell-1-title')).toHaveTextContent('8月北京出差报销');
      expect(screen.getByTestId('cell-1-totalAmount')).toContainHTML('¥ 1,500.00');
    });

    it('renders status tags for each status', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getAllByTestId('status-tag-draft').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-pending').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-approved').length).toBeGreaterThan(0);
    });

    it('has 新建报销 button in toolbar', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      expect(screen.getByTestId('toolbar-create')).toHaveTextContent('新建报销');
    });

    it('renders search fields', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-keyword')).toHaveTextContent('关键词');
        expect(screen.getByTestId('search-status')).toHaveTextContent('状态');
      });
    });

    it('shows pagination info', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('page-total')).toHaveTextContent('3');
      });
    });
  });

  describe('列表操作', () => {
    it('draft 行展示 提交 与 删除，pending 行展示 撤销', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getAllByRole('button', { name: /提交/ }).length).toBe(1);
      expect(screen.getAllByRole('button', { name: /删除/ }).length).toBe(1);
      expect(screen.getAllByRole('button', { name: /撤销/ }).length).toBe(1);
    });

    it('approved 行不展示操作按钮', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      // approved 行（id=3）只有详情按钮（提交/撤销/删除均不渲染在有该状态的记录上需在该行内）
      const row3 = screen.getByTestId('cell-3-actions');
      expect(row3.textContent).not.toContain('提交');
      expect(row3.textContent).not.toContain('撤销');
      expect(row3.textContent).not.toContain('删除');
    });

    it('点击 提交 调用 submitApproval', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getAllByRole('button', { name: /提交/ })[0]);
      await waitFor(() => {
        expect(reimbursementApi.submitApproval).toHaveBeenCalledWith(1);
      });
    });

    it('点击 撤销 确认后调用 cancelReimbursement', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getAllByRole('button', { name: /撤销/ })[0]);
      await screen.findByRole('button', { name: /确认/ });
      await user.click(screen.getByRole('button', { name: /确认/ }));
      await waitFor(() => {
        expect(reimbursementApi.cancelReimbursement).toHaveBeenCalledWith(2);
      });
    });

    it('点击 删除 确认后调用 removeReimbursement', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getAllByRole('button', { name: /删除/ })[0]);
      await screen.findByRole('button', { name: /确认/ });
      await user.click(screen.getByRole('button', { name: /确认/ }));
      await waitFor(() => {
        expect(reimbursementApi.removeReimbursement).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('查看详情', () => {
    it('点击行调用 getDetail', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('cell-1-title'));
      await waitFor(() => {
        expect(reimbursementApi.getDetail).toHaveBeenCalledWith(1);
      });
    });

    it('详情展示报销单号/明细/凭证/附件', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      await user.click(screen.getByTestId('cell-1-title'));
      await waitFor(() => {
        expect(screen.getByText('BX20260813123456')).toBeInTheDocument();
      });
      expect(screen.getByText('市内交通费')).toBeInTheDocument();
      expect(screen.getByText('发票汇总.pdf')).toBeInTheDocument();
    });
  });

  describe('新建报销', () => {
    it('点击新建报销打开完整表单', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      expect(await screen.findByRole('button', { name: /正式提交/ })).toBeInTheDocument();
    });

    it('打开表单时加载一级类型与二级费用类型', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      await waitFor(() => {
        expect(reimbursementApi.getTypes).toHaveBeenCalled();
        expect(reimbursementApi.getExpenseTypes).toHaveBeenCalled();
      });
    });
  });

  describe('时间展示', () => {
    it('创建时间按北京时间格式化，不泄漏 ISO 原始串', async () => {
      (reimbursementApi.getMyReimbursements as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: {
          list: [
            {
              id: 9,
              title: '时区校验单',
              totalAmount: 1,
              status: 'draft',
              createdAt: '2026-09-28T10:36:44.000Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(1);
      });
      expect(screen.getByTestId('cell-9-createdAt')).toHaveTextContent('2026-09-28 18:36');
      expect(screen.queryByText(/2026-09-28T10:36:44/)).toBeNull();
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', async () => {
      (reimbursementApi.getMyReimbursements as jest.Mock).mockImplementation(
        () => new Promise(() => {}),
      );
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
      });
    });

    it('handles empty list', async () => {
      (reimbursementApi.getMyReimbursements as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(reimbursementApi.getMyReimbursements).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles permission error (code 5003)', async () => {
      (reimbursementApi.getMyReimbursements as jest.Mock).mockResolvedValue({
        code: 5003,
        message: '无权限访问该数据',
      });
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(reimbursementApi.getMyReimbursements).toHaveBeenCalled();
      });
    });
  });
});