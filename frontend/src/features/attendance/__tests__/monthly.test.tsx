import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AttendanceMonthlyPage from '@/features/attendance/pages/monthly';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

// Arco Button 在表格「操作」列中渲染，mock 成原生 button 以保证断言稳定；
// 其余 Arco 能力（如 Message）保留原实现。
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Button: ({ children, disabled, onClick }: any) => (
      <button data-testid="arco-btn" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  };
});

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMonthlyList: jest.fn(),
    generateMonthly: jest.fn(),
    confirmMonthly: jest.fn(),
    exportMonthlyUrl: jest.fn(
      (month: string) => `/api/v1/reports/attendance-monthly/export?month=${month}`,
    ),
  },
}));

// 放开权限，使「生成月报」「确认」等按钮可点击
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

// 导出已改为本地生成 Excel
jest.mock('@/lib/excel', () => ({
  exportToExcel: jest.fn().mockReturnValue(true),
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
  {
    id: 1,
    employeeId: 1,
    month: '2026-08',
    workDays: 22,
    lateCount: 1,
    earlyCount: 0,
    absentDays: 0,
    leaveMinutes: 240,
    overtimeHours: 8,
    status: 'draft',
    confirmedBy: null,
    confirmedAt: null,
    employee: { id: 1, employeeNo: 'E001', name: '张三', department: { id: 1, name: '技术部' } },
  },
  {
    id: 2,
    employeeId: 2,
    month: '2026-08',
    workDays: 21,
    lateCount: 0,
    earlyCount: 1,
    absentDays: 1,
    leaveMinutes: 0,
    overtimeHours: 4,
    status: 'confirmed',
    confirmedBy: 9,
    confirmedAt: '2026-08-10T10:00:00+08:00',
    employee: { id: 2, employeeNo: 'E002', name: '李四', department: { id: 2, name: '产品部' } },
  },
];

describe('AttendanceMonthlyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (attendanceApi.getMonthlyList as jest.Mock).mockResolvedValue({
      code: 0,
      message: 'ok',
      data: {
        list: mockRecords,
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
  });

  describe('正常用例', () => {
    it('renders PageContainer with title 考勤月报', () => {
      render(<AttendanceMonthlyPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('考勤月报');
    });

    it('renders ProTable with monthly columns', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toBeInTheDocument();
      });
      expect(screen.getByTestId('col-employeeNo')).toHaveTextContent('工号');
      expect(screen.getByTestId('col-name')).toHaveTextContent('姓名');
      expect(screen.getByTestId('col-department')).toHaveTextContent('部门');
      expect(screen.getByTestId('col-month')).toHaveTextContent('月份');
      expect(screen.getByTestId('col-workDays')).toHaveTextContent('出勤天数');
      expect(screen.getByTestId('col-lateCount')).toHaveTextContent('迟到次数');
      expect(screen.getByTestId('col-earlyCount')).toHaveTextContent('早退次数');
      expect(screen.getByTestId('col-absentDays')).toHaveTextContent('缺勤天数');
      expect(screen.getByTestId('col-leaveMinutes')).toHaveTextContent('请假时长');
      expect(screen.getByTestId('col-overtimeHours')).toHaveTextContent('加班时长');
      expect(screen.getByTestId('col-status')).toHaveTextContent('状态');
      expect(screen.getByTestId('col-operation')).toHaveTextContent('操作');
    });

    it('calls attendanceApi.getMonthlyList on mount', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(attendanceApi.getMonthlyList).toHaveBeenCalled();
      });
    });

    it('renders monthly data in table (nested employee fields)', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      expect(screen.getByTestId('cell-1-employeeNo')).toHaveTextContent('E001');
      expect(screen.getByTestId('cell-1-name')).toHaveTextContent('张三');
      expect(screen.getByTestId('cell-1-department')).toHaveTextContent('技术部');
      expect(screen.getByTestId('cell-1-month')).toHaveTextContent('2026-08');
    });

    it('renders leaveMinutes as hours and overtimeHours with h suffix', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      // 240 分钟 => 4.0h
      expect(screen.getByTestId('cell-1-leaveMinutes')).toHaveTextContent('4.0h');
      expect(screen.getByTestId('cell-1-overtimeHours')).toHaveTextContent('8h');
    });

    it('renders status tag for monthly status', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      expect(screen.getAllByTestId('status-tag-draft').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-confirmed').length).toBeGreaterThan(0);
    });

    it('has 生成月报 and 导出CSV buttons in toolbar', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-generate')).toBeInTheDocument();
      });
      expect(screen.getByTestId('toolbar-generate')).toHaveTextContent('生成月报');
      expect(screen.getByTestId('toolbar-export')).toHaveTextContent('导出 Excel');
    });

    it('renders search fields for filtering', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-area')).toBeInTheDocument();
      });
      expect(screen.getByTestId('search-month')).toHaveTextContent('月份');
      expect(screen.getByTestId('search-status')).toHaveTextContent('状态');
    });

    it('shows pagination info', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
        expect(screen.getByTestId('page-total')).toHaveTextContent('2');
      });
    });
  });

  describe('生成月报', () => {
    it('calls generateMonthly when 生成月报 button clicked', async () => {
      const user = userEvent.setup();
      (attendanceApi.generateMonthly as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
        data: { count: 10 },
      });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-generate')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-generate'));
      expect(attendanceApi.generateMonthly).toHaveBeenCalled();
    });

    it('refreshes list after successful generate', async () => {
      const user = userEvent.setup();
      (attendanceApi.generateMonthly as jest.Mock).mockResolvedValue({
        code: 0,
        data: { count: 10 },
      });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(attendanceApi.getMonthlyList).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('toolbar-generate'));
      await waitFor(() => {
        expect(attendanceApi.getMonthlyList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('确认操作', () => {
    it('确认 button only shows for draft status records', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      // 草稿行（id=1）展示「确认」按钮
      expect(screen.getByTestId('cell-1-operation')).toHaveTextContent('确认');
      // 已确认行（id=2）不展示「确认」按钮
      expect(screen.getByTestId('cell-2-operation')).toBeEmptyDOMElement();
      // 仅有一条草稿记录 => 仅一个确认按钮
      expect(screen.getAllByTestId('arco-btn')).toHaveLength(1);
    });

    it('calls confirmMonthly when 确认 button clicked', async () => {
      const user = userEvent.setup();
      (attendanceApi.confirmMonthly as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
      });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      await user.click(screen.getByTestId('arco-btn'));
      await waitFor(() => {
        expect(attendanceApi.confirmMonthly).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('导出 Excel', () => {
    it('calls exportToExcel when 导出 Excel clicked', async () => {
      const user = userEvent.setup();
      const { exportToExcel } = jest.requireMock('@/lib/excel') as any;
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-export'));
      expect(exportToExcel).toHaveBeenCalled();
    });
  });

  describe('边界用例', () => {
    it('shows loading state while fetching', () => {
      let resolveFn: (value: any) => void;
      (attendanceApi.getMonthlyList as jest.Mock).mockImplementation(
        () => new Promise((resolve) => { resolveFn = resolve; }),
      );
      render(<AttendanceMonthlyPage />);
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-loading', 'true');
    });

    it('handles empty list', async () => {
      (attendanceApi.getMonthlyList as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(attendanceApi.getMonthlyList).toHaveBeenCalled();
      });
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });
});
