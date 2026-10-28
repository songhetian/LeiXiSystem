import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AttendanceDailyPage from '@/features/attendance/pages/daily';
import { attendanceApi } from '@/services/attendance';
import { exportToExcel } from '@/lib/excel';
import { clearDataCache } from '@/hooks/use-cached-data';

jest.mock('@/services/attendance', () => ({
  attendanceApi: {
    getDailyList: jest.fn(),
    recalcDaily: jest.fn(),
    importPunchLogs: jest.fn(),
  },
}));

jest.mock('@/lib/excel', () => ({
  exportToExcel: jest.fn(() => true),
}));

jest.mock('@/hooks/use-departments', () => ({
  useDepartments: () => ({ departments: [], loading: false }),
}));

jest.mock('@/hooks/use-permission', () => ({
  usePermission: () => ({ can: () => true }),
}));

jest.mock('@/components/PageContainer', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="page-container">{children}</div>,
}));

// ProTable 只保留 toolbar 与错误态接缝：本页断言点是导出映射与打卡时间戳
jest.mock('@/components/ProTable', () => ({
  __esModule: true,
  default: ({ data, error, toolbar = [] }: any) => (
    <div data-testid="pro-table" data-error={error ?? ''} data-rows={data.length}>
      {toolbar.map((t: any) => (
        <button key={t.key} type="button" disabled={t.disabled} onClick={t.onClick}>
          {t.label}
        </button>
      ))}
    </div>
  ),
}));

const makeupRow = {
  id: 1,
  employeeId: 1,
  employeeNo: 'E001',
  employeeName: '张三',
  departmentName: '研发部',
  date: '2026-10-27',
  shiftName: '标准班',
  checkIn: '09:00:00',
  checkOut: '18:00:00',
  workHours: 8,
  status: 'makeup',
};

describe('AttendanceDailyPage（考勤日报）', () => {
  beforeEach(() => {
    clearDataCache();
    jest.clearAllMocks();
    (attendanceApi.getDailyList as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: [makeupRow], total: 1, page: 1, pageSize: 20 },
    });
    (attendanceApi.importPunchLogs as jest.Mock).mockResolvedValue({ code: 0, data: { imported: 1 } });
    (attendanceApi.recalcDaily as jest.Mock).mockResolvedValue({ code: 0, data: { updated: 1 } });
  });

  it('导出时「补卡」按业务文案导出，不吐 makeup 原始状态', async () => {
    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getByTestId('pro-table')).toHaveAttribute('data-rows', '1'));

    fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));

    await waitFor(() => expect(exportToExcel).toHaveBeenCalled());
    const [, , columns] = (exportToExcel as jest.Mock).mock.calls[0];
    const statusCol = columns.find((c: any) => c.title === '状态');
    expect(statusCol.value(makeupRow)).toBe('补卡');
  });

  it('模拟打卡的打卡时间按北京时间拼装（不受宿主机时区影响）', async () => {
    jest.useFakeTimers();
    // 2026-10-28T02:30:05Z = 北京时间 2026-10-28 10:30:05
    jest.setSystemTime(new Date('2026-10-28T02:30:05Z'));

    render(<AttendanceDailyPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: '模拟打卡' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '模拟打卡' }));

    await waitFor(() => expect(attendanceApi.importPunchLogs).toHaveBeenCalled());
    const csv = (attendanceApi.importPunchLogs as jest.Mock).mock.calls[0][0] as string;
    expect(csv).toContain('2026-10-28 10:30:05');
    // 打卡成功后会自动触发当月重算（避免测试结束时仍有挂起的 setState）
    await waitFor(() => expect(attendanceApi.recalcDaily).toHaveBeenCalled());

    jest.useRealTimers();
  });
});
