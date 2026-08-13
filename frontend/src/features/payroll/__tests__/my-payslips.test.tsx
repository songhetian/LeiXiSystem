import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MyPayslipsPage from '@/features/payroll/pages/my-payslips';
import { payslipApi } from '@/services/payslip';

jest.mock('@/services/payslip', () => ({
  payslipApi: {
    getMyPayslips: jest.fn(),
    getMyPayslipDetail: jest.fn(),
    markAsViewed: jest.fn(),
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

const mockPayslips = [
  {
    id: 1,
    month: '2026-08',
    status: 'unviewed',
    baseSalary: 5000,
    totalIncome: 5700,
    totalDeduction: 500,
    netSalary: 5200,
    createdAt: '2026-08-13T10:00:00+08:00',
  },
  {
    id: 2,
    month: '2026-07',
    status: 'viewed',
    baseSalary: 5000,
    totalIncome: 5500,
    totalDeduction: 500,
    netSalary: 5000,
    createdAt: '2026-07-31T10:00:00+08:00',
    viewedAt: '2026-07-31T15:00:00+08:00',
  },
];

const mockPayslipDetail = {
  id: 1,
  employeeNo: 'E001',
  employeeName: '张三',
  departmentName: '技术部',
  month: '2026-08',
  status: 'unviewed',
  baseSalary: 5000,
  overtimePay: 500,
  absenceDeduction: 0,
  bonus: 200,
  totalIncome: 5700,
  totalDeduction: 500,
  netSalary: 5200,
  items: [
    { code: 'BASE_SALARY', name: '基本工资', amount: 5000, type: 'income' },
    { code: 'OVERTIME', name: '加班费', amount: 500, type: 'income' },
    { code: 'BONUS', name: '全勤奖', amount: 200, type: 'income' },
    { code: 'SOCIAL_SECURITY', name: '社保', amount: 500, type: 'deduction' },
  ],
  adjustments: [],
  createdAt: '2026-08-13T10:00:00+08:00',
  viewedAt: null,
};

describe('MyPayslipsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockPayslips,
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    (payslipApi.getMyPayslipDetail as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: mockPayslipDetail,
    });
    (payslipApi.markAsViewed as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: { id: 1, status: 'viewed' },
    });
  });

  describe('正常用例', () => {
    it('renders inside AppLayout with correct menu', () => {
      render(<MyPayslipsPage />);
      expect(screen.getByTestId('app-layout')).toHaveAttribute('data-active-menu', 'my-payslips');
    });

    it('renders PageContainer with title 我的工资条', () => {
      render(<MyPayslipsPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('我的工资条');
    });

    it('renders ProTable with payslip columns', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-month')).toHaveTextContent('月份');
      expect(screen.getByTestId('col-status')).toHaveTextContent('状态');
      expect(screen.getByTestId('col-baseSalary')).toHaveTextContent('基本工资');
      expect(screen.getByTestId('col-totalIncome')).toHaveTextContent('应发合计');
      expect(screen.getByTestId('col-totalDeduction')).toHaveTextContent('扣款合计');
      expect(screen.getByTestId('col-netSalary')).toHaveTextContent('实发工资');
      expect(screen.getByTestId('col-createdAt')).toHaveTextContent('发放时间');
    });

    it('fetches payslips on mount', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
    });

    it('renders payslip data in table', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      expect(screen.getByTestId('cell-1-month')).toHaveTextContent('2026-08');
      expect(screen.getByTestId('cell-1-netSalary')).toHaveTextContent('5200');
      expect(screen.getByTestId('cell-2-month')).toHaveTextContent('2026-07');
      expect(screen.getByTestId('cell-2-netSalary')).toHaveTextContent('5000');
    });

    it('renders status tag for each payslip', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      expect(screen.getAllByTestId('status-tag-unviewed').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-viewed').length).toBeGreaterThan(0);
    });

    it('renders search field for month filter', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-month')).toHaveTextContent('月份');
    });

    it('shows pagination info', async () => {
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
      expect(screen.getByTestId('page-total')).toHaveTextContent('2');
    });
  });

  describe('查看明细', () => {
    it('opens detail modal when row clicked', async () => {
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      await user.click(screen.getByTestId('cell-1-month'));
      await waitFor(() => {
        expect(payslipApi.getMyPayslipDetail).toHaveBeenCalledWith(1);
      });
    });

    it('marks as viewed when viewing unviewed payslip', async () => {
      const user = userEvent.setup();
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      await user.click(screen.getByTestId('cell-1-month'));
      await waitFor(() => {
        expect(payslipApi.markAsViewed).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', () => {
      let resolveFn: (value: any) => void;
      (payslipApi.getMyPayslips as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<MyPayslipsPage />);
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
    });

    it('handles empty list', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles payslip not found error (code 4004)', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 4004,
        message: '工资条不存在',
      });
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
    });

    it('handles permission error (code 5003)', async () => {
      (payslipApi.getMyPayslips as jest.Mock).mockResolvedValue({
        code: 5003,
        message: '无权限访问该数据',
      });
      render(<MyPayslipsPage />);
      await waitFor(() => {
        expect(payslipApi.getMyPayslips).toHaveBeenCalled();
      });
    });
  });
});
