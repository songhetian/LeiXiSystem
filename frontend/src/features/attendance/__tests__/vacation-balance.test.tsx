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
  default: ({ columns, data, loading, rowKey, error, searchFields, onSearch, onReset }: any) => (
    <div data-testid="pro-table" data-loading={loading} data-error={error ?? ''}>
      {searchFields && (
        <div data-testid="search-area">
          {searchFields.map((f: any) => (
            <select
              key={f.key}
              data-testid={`search-${f.key}`}
              onChange={(e) =>
                onSearch?.({ [f.key]: e.target.value === '' ? undefined : Number(e.target.value) })
              }
            >
              <option value="">{f.allLabel || '全部'}</option>
              {(f.options || []).map((o: any) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
          <button onClick={() => onReset?.()}>重置</button>
        </div>
      )}
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
  return { Tag, Message };
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

    fireEvent.change(screen.getByTestId('search-month'), { target: { value: '8' } });

    await waitFor(() => {
      const rows = screen.getAllByTestId('table-row');
      expect(rows.length).toBe(1);
      expect(rows[0]).toHaveTextContent('8 月');
      expect(rows[0]).not.toHaveTextContent('7 月');
    });
  });

  it('重置月份筛选后恢复全部额度行', async () => {
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(screen.getAllByTestId('table-row').length).toBe(4);
    });

    fireEvent.change(screen.getByTestId('search-month'), { target: { value: '7' } });
    await waitFor(() => expect(screen.getAllByTestId('table-row').length).toBe(1));

    fireEvent.click(screen.getByText('重置'));
    await waitFor(() => expect(screen.getAllByTestId('table-row').length).toBe(4));
  });

  it('年度按北京时间取：元旦早晨（UTC 仍是上一年）请求的是新年度', async () => {
    jest.useFakeTimers();
    // 2025-12-31T16:30:00Z = 北京时间 2026-01-01 00:30
    jest.setSystemTime(new Date('2025-12-31T16:30:00Z'));

    render(<VacationBalancePage />);
    await waitFor(() => expect(attendanceApi.getMyBalances).toHaveBeenCalledWith({ year: 2026 }));
    jest.useRealTimers();
  });

  it('业务码非 0 时不当作空列表，向 ProTable 传错误信息', async () => {
    (attendanceApi.getMyBalances as jest.Mock).mockResolvedValue({
      code: 500,
      message: '额度读取失败',
    });
    render(<VacationBalancePage />);
    await waitFor(() => {
      expect(screen.getByTestId('pro-table')).toHaveAttribute('data-error', '额度读取失败');
    });
  });
});
