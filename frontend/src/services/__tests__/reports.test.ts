import { reportsApi } from '@/services/reports';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockAttendance = {
  code: 0,
  data: {
    summary: {
      totalEmployees: 30,
      totalWorkDays: '660',
      totalLateCount: 12,
      totalEarlyCount: 3,
      totalAbsentDays: '0',
      totalOvertimeHours: '0',
    },
    departments: [
      {
        id: 1,
        name: '技术部',
        employeeCount: 12,
        totalWorkDays: '264',
        totalLateCount: 4,
        totalEarlyCount: 1,
        totalAbsentDays: '0',
        totalOvertimeHours: '0',
      },
    ],
  },
};

const mockLaborCost = {
  code: 0,
  data: {
    summary: {
      totalEmployees: 30,
      totalBaseSalary: '240000',
      totalOvertimePay: '0',
      totalDeduction: '0',
      totalAmount: '249000',
    },
    departments: [{ id: 1, name: '技术部', totalEmployees: 12, totalAmount: '99600' }],
  },
};

describe('reportsApi（T27）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAttendanceMonthly 发送 GET /reports/attendance-monthly 带 month', async () => {
    mockedRequest.get.mockResolvedValueOnce(mockAttendance);
    const result = await reportsApi.getAttendanceMonthly('2026-07');
    expect(mockedRequest.get).toHaveBeenCalledWith('/reports/attendance-monthly', {
      params: { month: '2026-07' },
    });
    expect(result.data?.summary.totalEmployees).toBe(30);
  });

  it('getLaborCost 发送 GET /reports/labor-cost 带 month', async () => {
    mockedRequest.get.mockResolvedValueOnce(mockLaborCost);
    const result = await reportsApi.getLaborCost('2026-07');
    expect(mockedRequest.get).toHaveBeenCalledWith('/reports/labor-cost', {
      params: { month: '2026-07' },
    });
    expect(result.data?.summary.totalAmount).toBe('249000');
  });

  it('createExportTask 发送 POST /reports/export', async () => {
    mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { id: 1 } });
    await reportsApi.createExportTask({ type: 'attendance-monthly', format: 'xlsx', month: '2026-07' });
    expect(mockedRequest.post).toHaveBeenCalledWith('/reports/export', {
      type: 'attendance-monthly',
      format: 'xlsx',
      month: '2026-07',
    });
  });

  it('listExportTasks 发送 GET /reports/export/tasks', async () => {
    mockedRequest.get.mockResolvedValueOnce({ code: 0, data: { list: [], total: 0 } });
    const result = await reportsApi.listExportTasks();
    expect(mockedRequest.get).toHaveBeenCalledWith('/reports/export/tasks');
    expect(result.data?.list).toHaveLength(0);
  });
});
