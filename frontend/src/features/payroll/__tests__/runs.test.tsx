import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import PayrollRunsPage from '@/features/payroll/pages/runs';
import { payrollApi } from '@/services/payroll';

jest.mock('@/services/payroll', () => ({
  payrollApi: {
    getPayrollRuns: jest.fn(),
    createPayrollRun: jest.fn(),
    confirmPayrollRun: jest.fn(),
    publishPayrollRun: jest.fn(),
    recallPayrollRun: jest.fn(),
  },
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
  default: ({ columns, data, rowKey, loading, searchFields, toolbar, pagination, onSearch, onPageChange }: any) => (
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
            <tr key={row[rowKey]} data-testid="table-row">
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

const mockRuns = [
  {
    id: 1,
    month: '2026-08',
    status: 'draft',
    totalEmployees: 10,
    totalAmount: 50000,
    createdByName: '管理员',
    createdAt: '2026-08-13T10:00:00+08:00',
  },
  {
    id: 2,
    month: '2026-07',
    status: 'confirmed',
    totalEmployees: 10,
    totalAmount: 52000,
    createdByName: '管理员',
    createdAt: '2026-07-31T10:00:00+08:00',
    confirmedByName: 'HR主管',
    confirmedAt: '2026-07-31T15:00:00+08:00',
  },
  {
    id: 3,
    month: '2026-06',
    status: 'published',
    totalEmployees: 10,
    totalAmount: 51000,
    createdByName: '管理员',
    createdAt: '2026-06-30T10:00:00+08:00',
    publishedByName: 'HR主管',
    publishedAt: '2026-06-30T15:00:00+08:00',
  },
];

describe('PayrollRunsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (payrollApi.getPayrollRuns as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockRuns,
        total: 3,
        page: 1,
        pageSize: 20,
      },
    });
  });

  describe('正常用例', () => {
    it('renders PageContainer with title 算薪批次', () => {
      render(<PayrollRunsPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('算薪批次');
    });

    it('renders ProTable with payroll run columns', async () => {
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-month')).toHaveTextContent('月份');
      expect(screen.getByTestId('col-status')).toHaveTextContent('状态');
      expect(screen.getByTestId('col-totalEmployees')).toHaveTextContent('员工数');
      expect(screen.getByTestId('col-totalAmount')).toHaveTextContent('总金额');
      expect(screen.getByTestId('col-createdByName')).toHaveTextContent('创建人');
      expect(screen.getByTestId('col-createdAt')).toHaveTextContent('创建时间');
      expect(screen.getByTestId('col-actions')).toHaveTextContent('操作');
    });

    it('fetches payroll runs on mount', async () => {
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(payrollApi.getPayrollRuns).toHaveBeenCalled();
      });
    });

    it('renders payroll run data in table', async () => {
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getByTestId('cell-1-month')).toHaveTextContent('2026-08');
      expect(screen.getByTestId('cell-1-totalEmployees')).toHaveTextContent('10');
      expect(screen.getByTestId('cell-1-totalAmount')).toHaveTextContent('50000');
    });

    it('renders status tag for each run status', async () => {
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getAllByTestId('status-tag-draft').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-confirmed').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-published').length).toBeGreaterThan(0);
    });

    it('has 创建批次 button in toolbar', async () => {
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      expect(screen.getByTestId('toolbar-create')).toHaveTextContent('创建批次');
    });

    it('renders search fields for filtering', async () => {
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-month')).toHaveTextContent('月份');
      expect(screen.getByTestId('search-status')).toHaveTextContent('状态');
    });

    it('shows pagination info', async () => {
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
      expect(screen.getByTestId('page-total')).toHaveTextContent('3');
    });
  });

  describe('创建批次', () => {
    it('opens create modal when create button clicked', async () => {
      const user = userEvent.setup();
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      expect(screen.getByTestId('modal-form')).toBeInTheDocument();
      expect(screen.getByTestId('modal-form')).toHaveAttribute('data-title', '创建算薪批次');
    });

    it('calls createPayrollRun when modal ok clicked', async () => {
      const user = userEvent.setup();
      (payrollApi.createPayrollRun as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { id: 4, month: '2026-09', status: 'draft' },
      });
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(payrollApi.createPayrollRun).toHaveBeenCalled();
      });
    });

    it('refreshes list after successful create', async () => {
      const user = userEvent.setup();
      (payrollApi.createPayrollRun as jest.Mock).mockResolvedValue({
        code: 0,
        data: { id: 4, month: '2026-09', status: 'draft' },
      });
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(payrollApi.getPayrollRuns).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('toolbar-create'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(payrollApi.getPayrollRuns).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', () => {
      let resolveFn: (value: any) => void;
      (payrollApi.getPayrollRuns as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<PayrollRunsPage />);
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
    });

    it('handles empty list', async () => {
      (payrollApi.getPayrollRuns as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(payrollApi.getPayrollRuns).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles duplicate month error (code 3001)', async () => {
      const user = userEvent.setup();
      (payrollApi.createPayrollRun as jest.Mock).mockResolvedValue({
        code: 3001,
        message: '该月份批次已存在',
      });
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-create')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-create'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(payrollApi.createPayrollRun).toHaveBeenCalled();
      });
    });

    it('handles permission error (code 5003)', async () => {
      (payrollApi.getPayrollRuns as jest.Mock).mockResolvedValue({
        code: 5003,
        message: '无权限访问该数据',
      });
      render(<PayrollRunsPage />);
      await waitFor(() => {
        expect(payrollApi.getPayrollRuns).toHaveBeenCalled();
      });
    });
  });
});
