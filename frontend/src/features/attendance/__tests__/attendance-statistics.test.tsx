import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AttendanceStatisticsPage from '@/features/attendance/pages/attendance-statistics';
import { attendanceApi } from '@/services/attendance';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getAttendanceStatistics: jest.fn(),
  },
}));

jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({ departments: [], loading: false }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ data, error }: any) => (
    <div data-testid="pro-table">
      {error && <div data-testid="table-error">{error}</div>}
      {data.map((row: any) => (
        <div key={row.employeeId} data-testid="table-row">
          {row.name}
        </div>
      ))}
    </div>
  ),
}));

jest.mock('@/lib/excel', () => ({ exportToExcel: jest.fn(() => true) }));

describe('AttendanceStatisticsPage（考勤统计）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDataCache();
  });

  it('接口正常返回时渲染统计数据行', async () => {
    (attendanceApi.getAttendanceStatistics as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        rows: [
          {
            employeeId: 1,
            employeeNo: 'E001',
            name: '张三',
            departmentId: 1,
            departmentName: '研发部',
            totalDays: 10,
            usedDays: 2,
            remainingDays: 8,
            overtimeHours: 3,
          },
        ],
        total: 1,
      },
    });
    render(<AttendanceStatisticsPage />);

    await waitFor(() => expect(screen.getAllByTestId('table-row')).toHaveLength(1));
    expect(screen.queryByTestId('table-error')).not.toBeInTheDocument();
  });

  it('接口返回业务错误(code!==0)时展示错误态，而非静默空表', async () => {
    (attendanceApi.getAttendanceStatistics as jest.Mock).mockResolvedValue({
      code: 500,
      message: '获取考勤统计失败',
    });
    render(<AttendanceStatisticsPage />);

    await waitFor(() =>
      expect(screen.getByTestId('table-error')).toHaveTextContent('获取考勤统计失败'),
    );
  });
});