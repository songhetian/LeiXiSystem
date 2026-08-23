import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import VacationLeavePage from '@/features/attendance/pages/vacation-leave';
import { attendanceApi } from '@/services/attendance';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMyLeaves: jest.fn(),
    getMyBalances: jest.fn(),
    createLeave: jest.fn(),
    submitLeave: jest.fn(),
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
  const Statistic = ({ title, value }: any) => (
    <div data-testid="statistic">
      <div data-testid="statistic-title">{title}</div>
      <div data-testid="statistic-value">{value}</div>
    </div>
  );
  const Grid = {
    Row: ({ children }: any) => <div data-testid="grid-row">{children}</div>,
    Col: ({ children, span }: any) => <div data-testid="grid-col" data-span={span}>{children}</div>,
  };
  const DatePicker = {
    RangePicker: ({ value, onChange }: any) => (
      <input data-testid="range-picker" value={value || ''} onChange={(e) => onChange?.(e.target.value)} />
    ),
  };
  return { Button, Tag, Space, Message, Card, Statistic, Grid, DatePicker };
});

const mockLeaves = [
  {
    id: 1,
    employeeId: 1,
    vacationTypeId: 1,
    startDate: '2026-08-10',
    endDate: '2026-08-12',
    days: 3,
    reason: '家中有事',
    status: 'pending',
    vacationType: { id: 1, code: 'annual', name: '年假' },
  },
  {
    id: 2,
    employeeId: 1,
    vacationTypeId: 2,
    startDate: '2026-07-01',
    endDate: '2026-07-02',
    days: 2,
    reason: '感冒',
    status: 'approved',
    vacationType: { id: 2, code: 'sick', name: '病假' },
  },
];

const mockBalances = [
  {
    id: 1,
    vacationTypeId: 1,
    year: 2026,
    totalDays: 10,
    usedDays: 3,
    vacationType: { id: 1, code: 'annual', name: '年假' },
  },
  {
    id: 2,
    vacationTypeId: 2,
    year: 2026,
    totalDays: 15,
    usedDays: 0,
    vacationType: { id: 2, code: 'sick', name: '病假' },
  },
];

describe('VacationLeavePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (attendanceApi.getMyLeaves as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockLeaves, total: 2, page: 1, pageSize: 20 },
    });
    (attendanceApi.getMyBalances as jest.Mock).mockResolvedValue({
      code: 0,
      data: mockBalances,
    });
  });

  it('renders PageContainer with title 我的请假', () => {
    render(<VacationLeavePage />);
    expect(screen.getByTestId('page-title')).toHaveTextContent('我的请假');
  });

  it('loads leaves on mount', async () => {
    render(<VacationLeavePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyLeaves).toHaveBeenCalled();
    });
  });

  it('renders leave items with correct columns', async () => {
    render(<VacationLeavePage />);
    await waitFor(() => {
      expect(screen.getAllByText('年假').length).toBeGreaterThan(0);
      expect(screen.getAllByText('病假').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('2026-08-10')).toBeInTheDocument();
    expect(screen.getByText('家中有事')).toBeInTheDocument();
  });

  it('shows status tags for different statuses', async () => {
    render(<VacationLeavePage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('tag').length).toBeGreaterThan(0);
    });
  });

  it('has 申请请假 button in toolbar', async () => {
    render(<VacationLeavePage />);
    expect(screen.getByTestId('toolbar-add')).toBeInTheDocument();
  });

  it('opens modal form when 申请请假 clicked', async () => {
    render(<VacationLeavePage />);
    const btn = screen.getByTestId('toolbar-add');
    await act(async () => { btn.click(); });
    expect(screen.getByTestId('modal-form')).toBeInTheDocument();
  });

  it('handles empty list', async () => {
    (attendanceApi.getMyLeaves as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [], total: 0, page: 1, pageSize: 20 },
    });
    render(<VacationLeavePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyLeaves).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('table-row')).not.toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    (attendanceApi.getMyLeaves as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<VacationLeavePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyLeaves).toHaveBeenCalled();
    });
  });
});
