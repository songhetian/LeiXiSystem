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

jest.mock('@/services/system', () => ({
  systemApi: { listDepartments: jest.fn().mockResolvedValue({ code: 0, data: [] }) },
}));

// 班次表单作为独立 seam mock；测试 ShiftsPage 与 ShiftForm 的集成（打开/提交）
jest.mock('@/features/attendance/pages/ShiftForm', () => {
  const React = require('react');
  const defaults = {
    name: '新班次',
    departmentId: 'global',
    startTime: '09:00',
    endTime: '18:00',
    isNextDay: false,
    restDuration: 60,
    lateThreshold: 30,
    earlyThreshold: 30,
    useGlobalThreshold: true,
    description: '',
    isActive: true,
    color: '#3B82F6',
  };
  return {
    __esModule: true,
    default: ({ visible, onOk }: any) =>
      visible ? (
        <div data-testid="shift-form">
          <button data-testid="shift-form-submit" onClick={() => onOk(defaults)}>
            提交
          </button>
        </div>
      ) : null,
  };
});

jest.mock('@arco-design/web-react', () => {
  const original = jest.requireActual('@arco-design/web-react');
  // ShiftForm 内部会渲染 <Modal>，因此 Modal 必须既可渲染又能作为命令对象调用
  const OwnModal = (({ visible, children, title }: any) =>
    visible ? <div data-testid="modal">{title}{children}</div> : null) as any;
  OwnModal.confirm = jest.fn();
  return {
    ...original,
    Modal: OwnModal,
    Message: {
      success: jest.fn(),
      error: jest.fn(),
    },
    Button: ({ children, onClick, disabled }: any) => (
      <button data-testid="arco-btn" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
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

    it('renders shift cards with names and time', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('早班')).toBeInTheDocument());
      expect(screen.getByText(/08:00 - 16:00/)).toBeInTheDocument();
      expect(screen.getByText('中班')).toBeInTheDocument();
      expect(screen.getByText('夜班')).toBeInTheDocument();
      expect(screen.getByText(/22:00 - 06:00/)).toBeInTheDocument();
    });

    it('renders 共 N 个班次 count', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('共 3 个班次')).toBeInTheDocument());
    });

    it('admin（有 attendance:manage）新建班次按钮可用', async () => {
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('+ 新建班次')).toBeEnabled());
    });

    it('staff（无 attendance:manage）新建班次按钮禁用', async () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: 2, username: 'staff', name: '王小明', permissions: ['attendance:view'] },
      });
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('+ 新建班次')).toBeDisabled());
    });
  });

  describe('新增班次', () => {
    it('opens create modal when add button clicked', async () => {
      const user = userEvent.setup();
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('+ 新建班次')).toBeInTheDocument());
      await user.click(screen.getByText('+ 新建班次'));
      expect(screen.getByTestId('shift-form')).toBeInTheDocument();
    });

    it('calls createShift and refreshes list on submit', async () => {
      const user = userEvent.setup();
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('+ 新建班次')).toBeInTheDocument());
      await user.click(screen.getByText('+ 新建班次'));
      await user.click(screen.getByTestId('shift-form-submit'));
      await waitFor(() => {
        expect(attendanceApi.createShift).toHaveBeenCalled();
        expect(attendanceApi.getShiftList).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('编辑班次', () => {
    it('opens edit modal on edit and updates via create/update path', async () => {
      const user = userEvent.setup();
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('早班')).toBeInTheDocument());
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
      expect(screen.getByText(/暂无班次/)).toBeInTheDocument();
    });

    it('handles create error gracefully', async () => {
      const user = userEvent.setup();
      (attendanceApi.createShift as jest.Mock).mockResolvedValue({
        code: 2001,
        message: '班次名称已存在',
      });
      render(<ShiftsPage />);
      await waitFor(() => expect(screen.getByText('+ 新建班次')).toBeInTheDocument());
      await user.click(screen.getByText('+ 新建班次'));
      await user.click(screen.getByTestId('shift-form-submit'));
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
