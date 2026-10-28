import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SchedulesPage from '@/features/attendance/pages/schedules';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getScheduleList: jest.fn(),
    createSchedule: jest.fn(),
    updateSchedule: jest.fn(),
    deleteSchedule: jest.fn(),
    getShiftList: jest.fn(),
  },
}));

// 权限门：默认有 attendance:manage，个别用例切到无权限
const mockCan = jest.fn((_code?: string) => true);
jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: (code: string) => mockCan(code) }),
}));


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="page-container">
      <h2 data-testid="page-title">{title}</h2>
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, rowKey, loading, error, searchFields, toolbar, pagination }: any) => (
    <div data-testid="pro-table" data-loading={loading} data-error={error ?? ''}>
      {searchFields && <div data-testid="search-area" />}
      {toolbar && (
        <div data-testid="toolbar">
          {toolbar.map((t: any) => (
            <button
              key={t.key}
              data-testid={`toolbar-${t.key}`}
              disabled={t.disabled}
              onClick={t.onClick}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <table>
        <thead>
          <tr>{columns.map((c: any) => <th key={c.dataIndex} data-testid={`col-${c.dataIndex}`}>{c.title}</th>)}</tr>
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
        <div data-testid="pagination"><span data-testid="page-total">{pagination.total}</span></div>
      )}
    </div>
  ),
}));

jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title, fields, initialValues, onOk, onCancel, confirmLoading }: any) =>
    visible ? (
      <div data-testid="modal-form" data-title={title} data-confirm-loading={confirmLoading}>
        {fields.map((f: any) => (
          <div key={f.key} data-testid={`field-${f.key}`} data-type={f.type}>{f.label}</div>
        ))}
        <button data-testid="modal-ok" onClick={() => onOk(initialValues)}>确定</button>
        <button data-testid="modal-cancel" onClick={onCancel}>取消</button>
      </div>
    ) : null,
}));

jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  return {
    ...original,
    Modal: { confirm: jest.fn() },
    Message: { success: jest.fn(), error: jest.fn() },
  };
});

const mockSchedules = [
  { id: 1, employeeId: 1, shiftId: 1, workDate: '2026-08-13', employee: { id: 1, employeeNo: 'E001', name: '张三' }, shift: { id: 1, name: '早班', startTime: '08:00', endTime: '16:00', isNextDay: false } },
  { id: 2, employeeId: 2, shiftId: 2, workDate: '2026-08-13', employee: { id: 2, employeeNo: 'E002', name: '李四' }, shift: { id: 2, name: '中班', startTime: '14:00', endTime: '22:00', isNextDay: false } },
];

describe('SchedulesPage', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    mockCan.mockReturnValue(true);
    (attendanceApi.getScheduleList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockSchedules, total: 2, page: 1, pageSize: 20 },
    });
    (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [{ id: 1, name: '早班' }, { id: 2, name: '中班' }], total: 2 },
    });
    (attendanceApi.createSchedule as jest.Mock).mockResolvedValue({ code: 0, data: { id: 3 } });
    (attendanceApi.updateSchedule as jest.Mock).mockResolvedValue({ code: 0, data: { id: 1 } });
    (attendanceApi.deleteSchedule as jest.Mock).mockResolvedValue({ code: 0 });
  });

  describe('正常用例', () => {
    it('fetches schedules and shifts on mount', async () => {
      render(<SchedulesPage />);
      await waitFor(() => {
        expect(attendanceApi.getScheduleList).toHaveBeenCalled();
        expect(attendanceApi.getShiftList).toHaveBeenCalled();
      });
    });

    it('renders schedule data', async () => {
      render(<SchedulesPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));
      expect(screen.getByTestId('cell-1-workDate')).toHaveTextContent('2026-08-13');
    });

    it('has 新增排班 button', async () => {
      render(<SchedulesPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
    });
  });

  describe('新增排班', () => {
    it('opens create modal', async () => {
      const user = userEvent.setup();
      render(<SchedulesPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
      await user.click(screen.getByTestId('toolbar-add'));
      expect(screen.getByTestId('modal-form')).toHaveAttribute('data-title', '新增排班');
    });

    it('calls createSchedule on submit', async () => {
      const user = userEvent.setup();
      render(<SchedulesPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
      await user.click(screen.getByTestId('toolbar-add'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => expect(attendanceApi.createSchedule).toHaveBeenCalled());
    });
  });

  describe('编辑排班', () => {
    it('提交时将 datetime 形式的 workDate 归一化为 YYYY-MM-DD', async () => {
      (attendanceApi.getScheduleList as jest.Mock).mockResolvedValue({
        code: 0,
        data: {
          list: [
            {
              id: 9,
              employeeId: 1,
              shiftId: 2,
              workDate: '2026-08-13T00:00:00.000Z',
              employee: { id: 1, employeeNo: 'E001', name: '张三' },
              shift: { id: 2, name: '中班', startTime: '14:00', endTime: '22:00', isNextDay: false },
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
      const user = userEvent.setup();
      render(<SchedulesPage />);
      await waitFor(() => expect(screen.getByText('编辑')).toBeInTheDocument());
      await user.click(screen.getByText('编辑'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => expect(attendanceApi.updateSchedule).toHaveBeenCalled());
      expect(attendanceApi.updateSchedule).toHaveBeenCalledWith(9, {
        employeeId: 1,
        shiftId: 2,
        workDate: '2026-08-13',
      });
    });
  });

  describe('边界用例', () => {
    it('handles empty list', async () => {
      (attendanceApi.getScheduleList as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<SchedulesPage />);
      await waitFor(() => expect(attendanceApi.getScheduleList).toHaveBeenCalled());
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles API error', async () => {
      (attendanceApi.getScheduleList as jest.Mock).mockRejectedValue(new Error('error'));
      render(<SchedulesPage />);
      await waitFor(() => expect(attendanceApi.getScheduleList).toHaveBeenCalled());
    });

    it('排班列表业务码非 0 时向 ProTable 传错误信息', async () => {
      (attendanceApi.getScheduleList as jest.Mock).mockResolvedValue({
        code: 500,
        message: '排班读取失败',
      });
      render(<SchedulesPage />);
      await waitFor(() => {
        expect(screen.getByTestId('pro-table')).toHaveAttribute('data-error', '排班读取失败');
      });
    });

    it('班次参考数据失败时明示失败并可重试，同时禁用新增', async () => {
      (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
        code: 500,
        message: '班次读取失败',
      });
      render(<SchedulesPage />);

      const alert = await screen.findByText(/班次列表加载失败/);
      expect(alert.closest('[role="alert"]') ?? alert).toHaveTextContent('班次读取失败');
      // 班次没拿到时不能新增：否则只能提交一个没有班次的排班
      expect(screen.getByTestId('toolbar-add')).toBeDisabled();
      // 列表本身照常展示（排班数据是好的）
      expect(screen.getAllByTestId('table-row')).toHaveLength(2);

      (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [{ id: 1, name: '早班' }, { id: 2, name: '中班' }], total: 2 },
      });
      await userEvent.click(screen.getByText('重试'));

      await waitFor(() => expect(screen.queryByText(/班次列表加载失败/)).not.toBeInTheDocument());
      expect(screen.getByTestId('toolbar-add')).toBeEnabled();
    });

    it('没有任何班次时提示先去配置班次，而不是让人对着空下拉发愁', async () => {
      (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0 },
      });
      render(<SchedulesPage />);

      expect(await screen.findByText(/尚未配置班次/)).toBeInTheDocument();
      expect(screen.getByTestId('toolbar-add')).toBeDisabled();
    });
  });

  describe('权限门', () => {
    it('无 attendance:manage 时新增/编辑/删除全部禁用', async () => {
      mockCan.mockReturnValue(false);
      render(<SchedulesPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(2));

      expect(screen.getByTestId('toolbar-add')).toBeDisabled();
      expect(screen.getAllByText('编辑')[0].closest('button')).toBeDisabled();
      expect(screen.getAllByText('删除')[0].closest('button')).toBeDisabled();
    });
  });

  describe('表单字段', () => {
    it('员工字段用员工选择器，不要求手输员工 ID', async () => {
      const user = userEvent.setup();
      render(<SchedulesPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
      await user.click(screen.getByTestId('toolbar-add'));

      expect(screen.getByTestId('field-employeeId')).toHaveAttribute('data-type', 'employee');
    });
  });
});
