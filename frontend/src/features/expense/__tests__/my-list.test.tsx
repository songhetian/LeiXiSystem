import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MyReimbursementPage from '@/features/expense/pages/my-list';
import { reimbursementApi } from '@/services/reimbursement';

jest.mock('@/services/reimbursement', () => ({
  reimbursementApi: {
    getTypes: jest.fn(),
    getMyReimbursements: jest.fn(),
    getDetail: jest.fn(),
    createReimbursement: jest.fn(),
    submitApproval: jest.fn(),
  },
}));

jest.mock('@/components/AppLayout', () => ({
  __esModule: true,
  default: ({ children, title, activeMenu }: any) => (
    <div data-testid="app-layout" data-title={title} data-active-menu={activeMenu}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, action, children }: any) => (
    <div data-testid="page-container">
      <h2 data-testid="page-title">{title}</h2>
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

jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title, fields, onOk, onCancel, loading }: any) => (
    visible ? (
      <div data-testid="modal-form" data-title={title} data-loading={loading}>
        {fields?.map((f: any) => (
          <div key={f.key} data-testid={`modal-field-${f.key}`}>{f.label}</div>
        ))}
        <button data-testid="modal-ok" onClick={onOk}>确定</button>
        <button data-testid="modal-cancel" onClick={onCancel}>取消</button>
      </div>
    ) : null
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
  { id: 3, name: '交通费', code: 'TRANSPORT', status: 'active' },
];

describe('MyReimbursementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (reimbursementApi.getTypes as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: mockTypes,
    });
    (reimbursementApi.getMyReimbursements as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockReimbursements,
        total: 3,
        page: 1,
        pageSize: 20,
      },
    });
    (reimbursementApi.getDetail as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        ...mockReimbursements[0],
        items: [
          { id: 1, typeId: 1, typeName: '差旅费', amount: 1000, description: '交通费', date: '2026-08-10' },
          { id: 2, typeId: 1, typeName: '差旅费', amount: 500, description: '住宿费', date: '2026-08-11' },
        ],
        description: '北京出差产生的交通和住宿费用',
      },
    });
    (reimbursementApi.createReimbursement as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { id: 4 },
    });
    (reimbursementApi.submitApproval as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { id: 1, status: 'pending' },
    });
  });

  describe('正常用例', () => {
    it('renders inside AppLayout with correct menu', () => {
      render(<MyReimbursementPage />);
      expect(screen.getByTestId('app-layout')).toHaveAttribute('data-active-menu', 'my-reimbursement');
    });

    it('renders PageContainer with title 我的报销', () => {
      render(<MyReimbursementPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('我的报销');
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
    });

    it('fetches types and reimbursements on mount', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(reimbursementApi.getTypes).toHaveBeenCalled();
        expect(reimbursementApi.getMyReimbursements).toHaveBeenCalled();
      });
    });

    it('renders reimbursement data in table', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getByTestId('cell-1-title')).toHaveTextContent('8月北京出差报销');
      expect(screen.getByTestId('cell-1-totalAmount')).toHaveTextContent('1500');
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
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-keyword')).toHaveTextContent('关键词');
      expect(screen.getByTestId('search-status')).toHaveTextContent('状态');
    });

    it('shows pagination info', async () => {
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
      expect(screen.getByTestId('page-total')).toHaveTextContent('3');
    });
  });

  describe('新建报销', () => {
    it('opens create modal when create button clicked', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      expect(screen.getByTestId('modal-form')).toBeInTheDocument();
      expect(screen.getByTestId('modal-form')).toHaveAttribute('data-title', '新建报销');
    });

    it('calls createReimbursement when modal ok clicked', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(reimbursementApi.createReimbursement).toHaveBeenCalled();
      });
    });

    it('refreshes list after successful create', async () => {
      const user = userEvent.setup();
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(reimbursementApi.getMyReimbursements).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('toolbar-create'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(reimbursementApi.getMyReimbursements).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('查看详情', () => {
    it('opens detail modal when row clicked', async () => {
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
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', () => {
      let resolveFn: (value: any) => void;
      (reimbursementApi.getMyReimbursements as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<MyReimbursementPage />);
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
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
    it('handles amount mismatch error (code 7001)', async () => {
      const user = userEvent.setup();
      (reimbursementApi.createReimbursement as jest.Mock).mockResolvedValue({
        code: 7001,
        message: '明细金额合计与总金额不一致',
      });
      render(<MyReimbursementPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(reimbursementApi.createReimbursement).toHaveBeenCalled();
      });
    });

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
