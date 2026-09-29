import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VacationBalancePage from '@/features/attendance/pages/vacation-balance';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMyBalances: jest.fn(),
  },
}));


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
  default: ({ columns, data, loading, rowKey }: any) => (
    <div data-testid="pro-table" data-loading={loading}>
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

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@arco-design/web-react', () => {
  const Tag = ({ color, children }: any) => (
    <span data-testid="tag" data-color={color}>{children}</span>
  );
  const Message = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() };
  const Select = ({ value, options, onChange, placeholder }: any) => (
    <select
      data-testid="month-filter"
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value === '' ? undefined : Number(e.target.value))}
    >
      <option value="">{placeholder || '全部'}</option>
      {(options || []).map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  return { Tag, Message, Select };
});

const mockBalances = [
  {
    id: 1,
    employeeId: 1,
    vacationTypeId: 1,
    year: 2026,
    month: 0,
    totalDays: 10,
    usedDays: 3,
    vacationType: { id: 1, code: 'annual', name: '年假' },
  },
  {
    id: 2,
    employeeId: 1,
    vacationTypeId: 2,
    year: 2026,
    month: 0,
    totalDays: 15,
    usedDays: 0,
    vacationType: { id: 2, code: 'sick', name: '病假' },
  },
  {
    id: 3,
    employeeId: 1,
    vacationTypeId: 3,
    year: 2026,
    month: 7,
    totalDays: 4,
    usedDays: 1,
    vacationType: {
      id: 3,
      code: 'monthly',
      name: '月假',
      monthlyDays: [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5],
    },
  },
  {
    id: 4,
    employeeId: 1,
    vacationTypeId: 3,
    year: 2026,
    month: 8,
    totalDays: 5,
    usedDays: 2,
    vacationType: {
      id: 3,
      code: 'monthly',
      name: '月假',
      monthlyDays: [4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5],
    },
  },
];

describe('VacationBalancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
    (attendanceApi.getMyBalances as jest.Mock).mockResolvedValue({
      code: 0,
      data: mockBalances,
    });
  });

  it('不渲染冗余页面大标题（顶部已有全局面包屑）', () => {
    render(<VacationBalancePage />);
    expect(screen.queryByTestId('page-title')).toBeNull();
  });

  it('loads balances on mount', async () => {
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyBalances).toHaveBeenCalled();
    });
  });

  it('renders balance items with correct columns', async () => {
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(screen.getByText('年假')).toBeInTheDocument();
      expect(screen.getByText('病假')).toBeInTheDocument();
    });
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders remaining days tag', async () => {
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('tag').length).toBeGreaterThan(0);
    });
  });

  it('handles empty balance list', async () => {
    (attendanceApi.getMyBalances as jest.Mock).mockResolvedValue({
      code: 0,
      data: [],
    });
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyBalances).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('table-row')).not.toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    (attendanceApi.getMyBalances as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(attendanceApi.getMyBalances).toHaveBeenCalled();
    });
  });

  it('渲染月份列：非月假显示「全年」，月假显示对应月份', async () => {
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(4);
    });
    const rows = screen.getAllByTestId('table-row');
    expect(rows.filter((r) => r.textContent?.includes('全年')).length).toBe(2);
    expect(rows.filter((r) => r.textContent?.includes('7 月')).length).toBe(1);
    expect(rows.filter((r) => r.textContent?.includes('8 月')).length).toBe(1);
  });

  it('按月份筛选后仅保留该月的额度行', async () => {
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(4);
    });

    fireEvent.change(screen.getByTestId('month-filter'), { target: { value: '8' } });

    await waitFor(() => {
      const rows = screen.getAllByTestId('table-row');
      expect(rows.length).toBe(1);
      expect(rows[0]).toHaveTextContent('8 月');
      expect(rows[0]).not.toHaveTextContent('7 月');
    });
  });
});
