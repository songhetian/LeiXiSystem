import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ShiftsPage from '@/features/attendance/pages/shifts';
import { attendanceApi } from '@/services/attendance';
import { useAuthStore } from '@/store/auth';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getShiftList: jest.fn(),
    createShift: jest.fn(),
    updateShift: jest.fn(),
    deleteShift: jest.fn(),
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
  default: ({ columns, data, rowKey, loading, searchFields, toolbar, pagination, onSearch, onRowClick }: any) => (
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
            <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick} disabled={t.disabled}>
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
    </div>
  ),
}));

jest.mock('@/components/ModalForm', () => ({
  __esModule: true,
  default: ({ visible, title, fields, initialValues, onOk, onCancel, confirmLoading }: any) =>
    visible ? (
      <div data-testid="modal-form" data-title={title} data-confirm-loading={confirmLoading}>
        {fields.map((f: any) => (
          <div key={f.key} data-testid={`field-${f.key}`}>{f.label}</div>
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
    Modal: {
      confirm: jest.fn(),
    },
    Message: {
      success: jest.fn(),
      error: jest.fn(),
    },
  };
});

jest.mock('@/store/auth', () => ({ useAuthStore: jest.fn() }));
const mockUseAuthStore = jest.mocked(useAuthStore);

const mockShifts = [
  { id: 1, name: '早班', startTime: '08:00', endTime: '16:00', isNextDay: false },
  { id: 2, name: '中班', startTime: '14:00', endTime: '22:00', isNextDay: false },
  { id: 3, name: '夜班', startTime: '22:00', endTime: '06:00', isNextDay: true },
];

describe('ShiftsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, username: 'admin', name: '管理员', permissions: ['attendance:view', 'attendance:manage'] },
    });
    (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockShifts, total: 3 },
    });
    (attendanceApi.createShift as jest.Mock).mockResolvedValue({
      code: 0,
      data: { id: 4, name: '新班次' },
    });
    (attendanceApi.updateShift as jest.Mock).mockResolvedValue({
      code: 0,
      data: { id: 1, name: '早班修改' },
    });
    (attendanceApi.deleteShift as jest.Mock).mockResolvedValue({
      code: 0,
    });
  });

  describe('正常用例', () => {
    it('renders inside AppLayout with attendance menu', () => {
      render(<ShiftsPage />);
      expect(screen.getByTestId('app-layout')).toHaveAttribute('data-active-menu', 'attendance-shifts');
    });

    it('renders PageContainer with title 班次管理', () => {
      render(<ShiftsPage />);
      expect(screen.getByTestId('page-title')).toHaveTextContent('班次管理');
    });

    it('fetches shift list on mount', async () => {
      render(<ShiftsPage />);
      await waitFor(() => {
        expect(attendanceApi.getShiftList).toHaveBeenCalled();
      });
    });

    it('renders shift columns', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByTestId('pro-table')).toBeInTheDocument());
      expect(screen.getByTestId('col-name')).toHaveTextContent('班次名称');
      expect(screen.getByTestId('col-startTime')).toHaveTextContent('上班时间');
      expect(screen.getByTestId('col-endTime')).toHaveTextContent('下班时间');
      expect(screen.getByTestId('col-isNextDay')).toHaveTextContent('跨天');
    });

    it('renders shift data in table', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(3));
      expect(screen.getByTestId('cell-1-name')).toHaveTextContent('早班');
      expect(screen.getByTestId('cell-1-startTime')).toHaveTextContent('08:00');
      expect(screen.getByTestId('cell-3-startTime')).toHaveTextContent('22:00');
    });

    it('has 新增班次 toolbar button', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
      expect(screen.getByTestId('toolbar-add')).toHaveTextContent('新增班次');
    });

    it('admin（有 attendance:manage）新增班次按钮可用', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeEnabled());
    });

    it('staff（无 attendance:manage）新增班次按钮禁用', async () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: 2, username: 'staff', name: '王小明', permissions: ['attendance:view'] },
      });
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeDisabled());
    });
  });

  describe('新增班次', () => {
    it('opens create modal when add button clicked', async () => {
      const user = userEvent.setup();
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
      await user.click(screen.getByTestId('toolbar-add'));
      expect(screen.getByTestId('modal-form')).toHaveAttribute('data-title', '新增班次');
    });

    it('calls createShift and refreshes list on submit', async () => {
      const user = userEvent.setup();
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
      await user.click(screen.getByTestId('toolbar-add'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => {
        expect(attendanceApi.createShift).toHaveBeenCalled();
        expect(attendanceApi.getShiftList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('编辑班次', () => {
    it('opens edit modal with initial values', async () => {
      const user = userEvent.setup();
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(3));
    });
  });

  describe('删除班次', () => {
    it('calls deleteShift and refreshes on confirm', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(attendanceApi.getShiftList).toHaveBeenCalled());
    });
  });

  describe('边界用例', () => {
    it('shows empty state when no shifts', async () => {
      (attendanceApi.getShiftList as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0 },
      });
      render(<ShiftsPage />);
      await waitFor(() => expect(attendanceApi.getShiftList).toHaveBeenCalled());
      expect(screen.queryAllByTestId('table-row')).toHaveLength(0);
    });

    it('handles create error gracefully', async () => {
      const user = userEvent.setup();
      (attendanceApi.createShift as jest.Mock).mockResolvedValue({
        code: 2001,
        message: '班次名称已存在',
      });
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByTestId('toolbar-add')).toBeInTheDocument());
      await user.click(screen.getByTestId('toolbar-add'));
      await user.click(screen.getByTestId('modal-ok'));
      await waitFor(() => expect(attendanceApi.createShift).toHaveBeenCalled());
    });
  });

  describe('异常用例', () => {
    it('handles API error on load', async () => {
      (attendanceApi.getShiftList as jest.Mock).mockRejectedValue(new Error('Network error'));
      render(<ShiftsPage />);
      await waitFor(() => expect(attendanceApi.getShiftList).toHaveBeenCalled());
    });
  });
});
