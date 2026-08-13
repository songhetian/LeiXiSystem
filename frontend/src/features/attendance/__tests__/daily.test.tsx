import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AttendanceDailyPage from '@/features/attendance/pages/daily';
import { attendanceApi } from '@/services/attendance';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getDailyList: jest.fn(),
    recalcDaily: jest.fn(),
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

const mockRecords = [
  { id: 1, employeeNo: 'E001', employeeName: '张三', departmentName: '技术部', date: '2026-08-13', shiftName: '早班', workHours: 8, status: 'normal' },
  { id: 2, employeeNo: 'E002', employeeName: '李四', departmentName: '产品部', date: '2026-08-13', shiftName: '早班', workHours: 7.5, status: 'abnormal', abnormalType: '迟到' },
  { id: 3, employeeNo: 'E003', employeeName: '王五', departmentName: '技术部', date: '2026-08-13', shiftName: '早班', workHours: 0, status: 'leave' },
];

describe('AttendanceDailyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (attendanceApi.getDailyList as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockRecords,
        total: 3,
        page: 1,
        pageSize: 20,
      },
    });
  });

  describe('正常用例', () => {
    it('renders inside AppLayout with correct menu', () => {
      render(<AttendanceDailyPage />);
      expect(screen.getByTestId('app-layout')).toHaveAttribute('data-active-menu', 'attendance-daily');
    });

    it('renders PageContainer with title 考勤日报', () => {
      render(<AttendanceDailyPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('考勤日报');
    });

    it('renders ProTable with attendance columns', async () => {
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-employeeNo')).toHaveTextContent('工号');
      expect(screen.getByTestId('col-employeeName')).toHaveTextContent('姓名');
      expect(screen.getByTestId('col-departmentName')).toHaveTextContent('部门');
      expect(screen.getByTestId('col-date')).toHaveTextContent('日期');
      expect(screen.getByTestId('col-shiftName')).toHaveTextContent('班次');
      expect(screen.getByTestId('col-workHours')).toHaveTextContent('工时');
      expect(screen.getByTestId('col-status')).toHaveTextContent('状态');
    });

    it('fetches attendance list on mount', async () => {
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(attendanceApi.getDailyList).toHaveBeenCalled();
      });
    });

    it('renders attendance data in table', async () => {
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getByTestId('cell-1-employeeNo')).toHaveTextContent('E001');
      expect(screen.getByTestId('cell-1-employeeName')).toHaveTextContent('张三');
      expect(screen.getByTestId('cell-1-date')).toHaveTextContent('2026-08-13');
    });

    it('renders status tag for attendance status', async () => {
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(3);
      });
      expect(screen.getAllByTestId('status-tag-normal').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-abnormal').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-leave').length).toBeGreaterThan(0);
    });

    it('has 重新计算 button in toolbar', async () => {
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-recalc')).toBeInTheDocument();
      });
      expect(screen.getByTestId('toolbar-recalc')).toHaveTextContent('重新计算');
    });

    it('renders search fields for filtering', async () => {
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-employeeNo')).toHaveTextContent('工号');
      expect(screen.getByTestId('search-startDate')).toHaveTextContent('开始日期');
      expect(screen.getByTestId('search-endDate')).toHaveTextContent('结束日期');
      expect(screen.getByTestId('search-status')).toHaveTextContent('状态');
    });

    it('shows pagination info', async () => {
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
      });
      expect(screen.getByTestId('page-total')).toHaveTextContent('3');
    });
  });

  describe('重新计算', () => {
    it('calls recalcDaily when recalc button clicked', async () => {
      const user = userEvent.setup();
      (attendanceApi.recalcDaily as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { updated: 3 },
      });
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-recalc')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-recalc'));
      expect(attendanceApi.recalcDaily).toHaveBeenCalled();
    });

    it('refreshes list after successful recalc', async () => {
      const user = userEvent.setup();
      (attendanceApi.recalcDaily as jest.Mock).mockResolvedValue({
        code: 0,
        data: { updated: 3 },
      });
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(attendanceApi.getDailyList).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('toolbar-recalc'));
      await waitFor(() => {
        expect(attendanceApi.getDailyList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', () => {
      let resolveFn: (value: any) => void;
      (attendanceApi.getDailyList as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<AttendanceDailyPage />);
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
    });

    it('handles empty list', async () => {
      (attendanceApi.getDailyList as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(attendanceApi.getDailyList).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles recalc schedule not configured error (code 2005)', async () => {
      const user = userEvent.setup();
      (attendanceApi.recalcDaily as jest.Mock).mockResolvedValue({
        code: 2005,
        message: '排班未配置',
      });
      render(<AttendanceDailyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-recalc')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-recalc'));
      await waitFor(() => {
        expect(attendanceApi.recalcDaily).toHaveBeenCalled();
      });
    });
  });
});
