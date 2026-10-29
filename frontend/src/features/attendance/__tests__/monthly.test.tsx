import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Modal } from '@arco-design/web-react';
import AttendanceMonthlyPage from '@/features/attendance/pages/monthly';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

// Arco Button 在表格「操作」列中渲染，mock 成原生 button 以保证断言稳定；
// 其余 Arco 能力（如 Message）保留原实现。
// Modal.confirm 换成可断言桩：真实 confirm 会往 body 挂一个独立 React 根，
// RTL cleanup 清不掉，残留弹窗会让后续用例查到重复的「开始生成」按钮。
jest.mock('@arco-design/web-react', () => {
  const actual = jest.requireActual('@arco-design/web-react');
  return {
    ...actual,
    Button: ({ children, disabled, onClick }: any) => (
      <button data-testid="arco-btn" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
    Modal: Object.assign(actual.Modal, { confirm: jest.fn() }),
  };
});

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMonthlyList: jest.fn(),
    generateMonthly: jest.fn(),
    confirmMonthly: jest.fn(),
    unconfirmMonthly: jest.fn(),
    exportMonthlyUrl: jest.fn(
      (month: string) => `/api/v1/reports/attendance-monthly/export?month=${month}`,
    ),
  },
}));

jest.mock('@/services/system', () => ({
  systemApi: {
    listDepartments: jest.fn().mockResolvedValue({
      code: 0,
      data: [
        { id: 1, name: '技术部' },
        { id: 2, name: '产品部' },
      ],
    }),
  },
}));

// 部门参考数据用共享 hook：直接给固定值，避免 useDict 的异步 setState 落到用例结束后
// 触发「not wrapped in act」告警
jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({
    departments: [
      { id: 1, name: '技术部' },
      { id: 2, name: '产品部' },
    ],
    loading: false,
  }),
}));

// 权限门：默认放开权限，使「生成月报」「确认」等按钮可点击；个别用例切到无权限
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (code?: string) => mockCan(code) }),
}));

// 导出已改为本地生成 Excel
jest.mock('@/lib/excel', () => ({
  exportToExcel: jest.fn().mockReturnValue(true),
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
  default: ({ columns, data, rowKey, loading, error, searchFields, toolbar, pagination, onSearch, onPageChange }: any) => (
    <div data-testid="pro-table" data-loading={loading} data-error={error ?? ''}>
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
    mockCan.mockReturnValue(true);
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
    it('不渲染冗余页面大标题（顶部已有全局面包屑）', async () => {
      render(<AttendanceMonthlyPage />);
      expect(screen.queryByTestId('page-title')).toBeNull();
      // 等首屏请求落地，避免测试结束后 setState 落在 act 之外
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));
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

    it('renders department search field after departments load', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-departmentId')).toHaveTextContent('部门');
      });
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
    it('默认月份按北京时间取（宿主机还在上个月时也不生成上月月报）', async () => {
      jest.useFakeTimers();
      // 2026-10-31T16:30:00Z = 北京时间 2026-11-01 00:30
      jest.setSystemTime(new Date('2026-10-31T16:30:00Z'));
      (attendanceApi.generateMonthly as jest.Mock).mockResolvedValue({ code: 0, data: { count: 1 } });

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-generate')).toBeInTheDocument();
      });
      // 部门参考数据在这轮微任务里落地，先等它进 DOM，
      // 否则测试结束后才 setState 会触发「not wrapped in act」告警
      await waitFor(() => {
        expect(screen.getByTestId('search-departmentId')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('toolbar-generate'));
      const opts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      await act(async () => {
        await opts.onOk();
      });

      expect(attendanceApi.generateMonthly).toHaveBeenCalledWith({ month: '2026-11' });
      jest.useRealTimers();
    });

    it('点「生成月报」先弹确认框，未确认不发起生成', async () => {
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

      // 生成会覆盖当月草稿月报，必须先二次确认
      expect(attendanceApi.generateMonthly).not.toHaveBeenCalled();
      const opts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      expect(opts.title).toBe('生成考勤月报');
      expect(opts.okText).toBe('开始生成');
      // 文案要说清覆盖的是哪个月
      expect(opts.content).toMatch(/将按 \d{4}-\d{2} 的日报重算/);
    });

    it('确认后调用 generateMonthly', async () => {
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
      const opts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      await act(async () => {
        await opts.onOk();
      });
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
      const opts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      await act(async () => {
        await opts.onOk();
      });
      await waitFor(() => {
        expect(attendanceApi.getMonthlyList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('确认操作', () => {
    it('草稿行展示「确认」，已确认行展示「撤销确认」', async () => {
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });
      // 草稿行（id=1）可确认
      expect(screen.getByTestId('cell-1-operation')).toHaveTextContent('确认');
      // 已确认行（id=2）可撤销确认：确认会锁住当月，没有撤销入口就只能等后端修数据
      expect(screen.getByTestId('cell-2-operation')).toHaveTextContent('撤销确认');
      expect(screen.getAllByTestId('arco-btn')).toHaveLength(2);
    });

    it('确认前有二次确认，确认后才调用 confirmMonthly', async () => {
      const user = userEvent.setup();
      (attendanceApi.confirmMonthly as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
      });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });

      await user.click(screen.getByTestId('cell-1-operation').querySelector('button')!);
      // 还没点确认按钮时不该发请求
      expect(attendanceApi.confirmMonthly).not.toHaveBeenCalled();

      const opts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      expect(opts.okText).toBe('确认并锁定');
      await act(async () => {
        await opts.onOk();
      });
      expect(attendanceApi.confirmMonthly).toHaveBeenCalledWith(1);
    });

    it('撤销确认同样二次确认，确认后才调用 unconfirmMonthly 并刷新', async () => {
      const user = userEvent.setup();
      (attendanceApi.unconfirmMonthly as jest.Mock).mockResolvedValue({
        code: 0,
        message: 'ok',
      });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getAllByTestId('table-row')).toHaveLength(2);
      });

      await user.click(screen.getByTestId('cell-2-operation').querySelector('button')!);
      expect(attendanceApi.unconfirmMonthly).not.toHaveBeenCalled();

      const opts = (Modal.confirm as jest.Mock).mock.calls[0][0];
      expect(opts.okText).toBe('确认撤销');
      await act(async () => {
        await opts.onOk();
      });
      expect(attendanceApi.unconfirmMonthly).toHaveBeenCalledWith(2);
      await waitFor(() => expect(attendanceApi.getMonthlyList).toHaveBeenCalledTimes(2));
    });
  });

  describe('权限门', () => {
    it('无 attendance:manage 时生成月报/确认/撤销确认不渲染，导出仍可见', async () => {
      mockCan.mockReturnValue(false);
      render(<AttendanceMonthlyPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

      // 按钮无权限不渲染（PermissionGate），而非禁用
      expect(screen.queryByTestId('toolbar-generate')).not.toBeInTheDocument();
      expect(screen.getByTestId('cell-1-operation').querySelector('button')).toBeNull();
      expect(screen.getByTestId('cell-2-operation').querySelector('button')).toBeNull();
      // 导出为查看类动作，不受考勤管理权限点限制
      expect(screen.getByTestId('toolbar-export')).toBeInTheDocument();
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

    it('导出会翻页取全量（后端 pageSize 上限 100，写 10000 会被静默截断成第一页）', async () => {
      const { exportToExcel } = jest.requireMock('@/lib/excel') as any;
      const rows = Array.from({ length: 120 }, (_, i) => ({
        ...mockRecords[0],
        id: i + 1,
        employee: { ...mockRecords[0].employee, employeeNo: `E${i + 1}` },
      }));
      (attendanceApi.getMonthlyList as jest.Mock).mockImplementation(({ page, pageSize }: any) => ({
        code: 0,
        data: {
          list: rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
          total: rows.length,
          page,
          pageSize,
        },
      }));

      const user = userEvent.setup();
      render(<AttendanceMonthlyPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(20));

      await user.click(screen.getByTestId('toolbar-export'));

      await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
      const [, , , exported] = (exportToExcel as jest.Mock).mock.calls[0];
      expect(exported).toHaveLength(120);
      const pages = (attendanceApi.getMonthlyList as jest.Mock).mock.calls
        .map((c) => c[0])
        .filter((p: any) => p.pageSize !== 20)
        .map((p: any) => p.page);
      expect(pages).toEqual([1, 2]);
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

    it('业务码非 0 时向 ProTable 传错误态，而非静默显示空表', async () => {
      (attendanceApi.getMonthlyList as jest.Mock).mockResolvedValue({
        code: 500,
        message: '月报读取失败',
      });
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toHaveAttribute('data-error', '月报读取失败');
      });
    });

    it('导出接口业务码非 0 时提示失败，不谎报「没有可导出的数据」', async () => {
      const { exportToExcel } = jest.requireMock('@/lib/excel') as any;
      const { Message } = jest.requireActual('@arco-design/web-react');
      const errorSpy = jest.spyOn(Message, 'error').mockImplementation(() => ({}) as any);
      const user = userEvent.setup();
      render(<AttendanceMonthlyPage />);
      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export')).toBeInTheDocument();
      });

      (attendanceApi.getMonthlyList as jest.Mock).mockResolvedValueOnce({
        code: 500,
        message: '导出取数失败',
      });
      await user.click(screen.getByTestId('toolbar-export'));

      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('导出取数失败'));
      expect(exportToExcel).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
