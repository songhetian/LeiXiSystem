import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import VacationOvertimePage from '@/features/attendance/pages/vacation-overtime';
import { attendanceApi } from '@/services/attendance';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMyOvertimes: jest.fn(),
    createOvertime: jest.fn(),
    submitOvertime: jest.fn(),
  },
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
  default: ({ columns, data, loading, rowKey, toolbar }: any) => (
    <div data-testid="pro-table" data-loading={loading}>
      {toolbar && toolbar.map((t: any) => (
        <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick} disabled={t.disabled}>
          {t.label}
        </button>
      ))}
      <table>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.dataIndex}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row: any) => (
            <tr key={row[rowKey]} data-testid="table-row">
              {columns.map((col: any) => (
                <td key={col.dataIndex}>
                  {col.render ? col.render(row[col.dataIndex], row) : row[col.dataIndex]}
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
  default: ({ visible, title, fields, onOk, onCancel, confirmLoading }: any) => {
    if (!visible) return null;
    return (
      <div data-testid="modal-form" data-title={title} data-loading={confirmLoading}>
        {fields.map((f: any) => (
          <div key={f.key} data-testid={`field-${f.key}`}>{f.label}</div>
        ))}
        <button data-testid="modal-ok" onClick={onOk}>确定</button>
        <button data-testid="modal-cancel" onClick={onCancel}>取消</button>
      </div>
    );
  },
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@arco-design/web-react', () => {
  const Button = ({ children, onClick, type, disabled, size }: any) => (
    <button type="button" data-testid={`btn-${children}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
  const Tag = ({ color, children }: any) => (
    <span data-testid="tag" data-color={color}>{children}</span>
  );
  const Space = ({ children }: any) => <div data-testid="space">{children}</div>;
  const Message = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
  const Card = ({ children, title }: any) => <div data-testid="card" data-title={title}>{children}</div>;
  const Grid = {
    Row: ({ children }: any) => <div data-testid="grid-row">{children}</div>,
    Col: ({ children, span }: any) => <div data-testid="grid-col" data-span={span}>{children}</div>,
  };
  const DatePicker = {
    RangePicker: ({ value, onChange }: any) => (
      <input data-testid="range-picker" value={value || ''} onChange={(e) => onChange?.(e.target.value)} />
    ),
  };
  return { Button, Tag, Space, Message, Card, Grid, DatePicker };
});

const mockOvertimes = [
  {
    id: 1,
    employeeId: 1,
    overtimeDate: '2026-08-14',
    startTime: '18:00',
    endTime: '21:00',
    hours: 3,
    reason: '项目赶工',
    status: 'pending',
  },
  {
    id: 2,
    employeeId: 1,
    overtimeDate: '2026-08-10',
    startTime: '19:00',
    endTime: '22:00',
    hours: 3,
    reason: '系统部署',
    status: 'approved',
  },
];

describe('VacationOvertimePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (attendanceApi.getMyOvertimes as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockOvertimes, total: 2, page: 1, pageSize: 20 },
    });
  });

  it('renders PageContainer with title 我的加班', () => {
    render(<VacationOvertimePage />);
    expect(screen.getByTestId('page-title')).toHaveTextContent('我的加班');
  });

  it('loads overtimes on mount', async () => {
    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyOvertimes).toHaveBeenCalled();
    });
  });

  it('renders overtime items with correct columns', async () => {
    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(screen.getByText('2026-08-14')).toBeInTheDocument();
      expect(screen.getByText('2026-08-10')).toBeInTheDocument();
    });
    expect(screen.getByText('项目赶工')).toBeInTheDocument();
    expect(screen.getByText('系统部署')).toBeInTheDocument();
  });

  it('shows status tags for different statuses', async () => {
    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('tag').length).toBeGreaterThan(0);
    });
  });

  it('has 申请加班 button in toolbar', async () => {
    render(<VacationOvertimePage />);
    expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
  });

  it('opens modal form when 申请加班 clicked', async () => {
    render(<VacationOvertimePage />);
    const btn = screen.getByTestId('toolbar-add');
    await act(async () => { btn.click(); });
    expect(screen.getByTestId('modal-form')).toBeInTheDocument();
  });

  it('handles empty list', async () => {
    (attendanceApi.getMyOvertimes as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });
    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyOvertimes).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('table-row')).not.toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    (attendanceApi.getMyOvertimes as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyOvertimes).toHaveBeenCalled();
    });
  });
});
