import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VacationOvertimePage from '@/features/attendance/pages/vacation-overtime';
import { attendanceApi } from '@/services/attendance';
import { exportToExcel } from '@/lib/excel';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMyOvertimes: jest.fn(),
    createOvertime: jest.fn(),
    submitOvertime: jest.fn(),
  },
}));

jest.mock('@/lib/excel', () => ({ exportToExcel: jest.fn(() => true) }));


jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid="page-container">
      {title && <h2 data-testid="page-title">{title}</h2>}
      <div data-testid="page-content">{children}</div>
    </div>
  ),
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ columns, data, loading, rowKey, toolbar, pagination, onPageChange }: any) => (
    <div
      data-testid="pro-table"
      data-loading={loading}
      data-current={pagination?.current}
      data-total={pagination?.total}
    >
      {toolbar && toolbar.map((t: any) => (
        <button key={t.key} data-testid={`toolbar-${t.key}`} onClick={t.onClick} disabled={t.disabled}>
          {t.label}
        </button>
      ))}
      <button
        data-testid="page-next"
        onClick={() => onPageChange?.((pagination?.current ?? 1) + 1, pagination?.pageSize ?? 20)}
      >
        下一页
      </button>
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

// 真实接口返回的是 Date 序列化后的 ISO 串（UTC），不再是纯时刻
const mockOvertimes = [
  {
    id: 1,
    employeeId: 1,
    overtimeDate: '2026-08-14T00:00:00.000Z',
    startTime: '2026-08-14T10:00:00.000Z', // 北京 18:00
    endTime: '2026-08-14T13:00:00.000Z', // 北京 21:00
    hours: 3,
    reason: '项目赶工',
    status: 'pending',
  },
  {
    id: 2,
    employeeId: 1,
    overtimeDate: '2026-08-10T00:00:00.000Z',
    startTime: '2026-08-10T11:00:00.000Z', // 北京 19:00
    endTime: '2026-08-10T14:00:00.000Z', // 北京 22:00
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

  it('不渲染冗余页面大标题（顶部已有全局面包屑）', () => {
    render(<VacationOvertimePage />);
    expect(screen.queryByTestId('page-title')).toBeNull();
  });

  it('翻页时保留目标页码，不被重置回第 1 页', async () => {
    (attendanceApi.getMyOvertimes as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockOvertimes, total: 42, page: 1, pageSize: 20 },
    });

    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-current', '1');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('page-next'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-current', '2');
    });
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

  it('加班起止时间按北京时间格式化展示，不泄漏 ISO 原始串', async () => {
    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row')).toHaveLength(2);
    });
    // ISO 原始串为 UTC 10:00/13:00，展示应为北京时间 18:00/21:00
    expect(screen.getByText('2026-08-14 18:00')).toBeInTheDocument();
    expect(screen.getByText('2026-08-14 21:00')).toBeInTheDocument();
    expect(screen.queryByText('2026-08-14T10:00:00.000Z')).toBeNull();
    expect(screen.queryByText('2026-08-14T13:00:00.000Z')).toBeNull();
  });

  it('导出 Excel 的加班起止时间同样按北京时间格式化', async () => {
    render(<VacationOvertimePage />);
    await waitFor(() => {
      expect(screen.getByTestId('toolbar-export')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('toolbar-export'));
    });

    expect(exportToExcel).toHaveBeenCalled();
    const columns = (exportToExcel as jest.Mock).mock.calls[0][2] as any[];
    const row = mockOvertimes[0];
    expect(columns.find((c) => c.title === '加班日期').value(row)).toBe('2026-08-14');
    expect(columns.find((c) => c.title === '开始时间').value(row)).toBe('2026-08-14 18:00');
    expect(columns.find((c) => c.title === '结束时间').value(row)).toBe('2026-08-14 21:00');
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
