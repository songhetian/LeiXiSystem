import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VacationBalancePage from '@/features/attendance/pages/vacation-balance';
import { attendanceApi } from '@/services/attendance';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getMyBalances: jest.fn(),
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
  return { Tag, Message };
});

const mockBalances = [
  {
    id: 1,
    employeeId: 1,
    vacationTypeId: 1,
    year: 2026,
    totalDays: 10,
    usedDays: 3,
    vacationType: { id: 1, code: 'annual', name: '年假' },
  },
  {
    id: 2,
    employeeId: 1,
    vacationTypeId: 2,
    year: 2026,
    totalDays: 15,
    usedDays: 0,
    vacationType: { id: 2, code: 'sick', name: '病假' },
  },
];

describe('VacationBalancePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (attendanceApi.getMyBalances as jest.Mock).mockResolvedValue({
      code: 0,
      data: mockBalances,
    });
  });

  it('renders PageContainer with title 休假额度', () => {
    render(<VacationBalancePage />);
    expect(screen.getByTestId('page-title')).toHaveTextContent('休假额度');
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
});
