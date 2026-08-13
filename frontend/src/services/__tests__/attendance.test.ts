import { attendanceApi } from '@/services/attendance';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockDailyRecord = {
  id: 1,
  employeeId: 1,
  employeeNo: 'E001',
  employeeName: '张三',
  departmentName: '技术部',
  date: '2026-08-13',
  shiftName: '早班',
  checkIn: '2026-08-13T08:30:00+08:00',
  checkOut: '2026-08-13T18:00:00+08:00',
  workHours: 8,
  status: 'normal',
  abnormalType: null,
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockDailyRecord],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

describe('attendanceApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常用例', () => {
    it('getDailyList sends GET request with pagination params', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await attendanceApi.getDailyList({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/daily', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data.list).toHaveLength(1);
    });

    it('getDailyList sends date range params', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await attendanceApi.getDailyList({
        page: 1,
        pageSize: 20,
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      });
      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/daily', {
        params: { page: 1, pageSize: 20, startDate: '2026-08-01', endDate: '2026-08-13' },
      });
    });

    it('getDailyList sends employeeId filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await attendanceApi.getDailyList({ page: 1, pageSize: 20, employeeId: 1 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/daily', {
        params: { page: 1, pageSize: 20, employeeId: 1 },
      });
    });

    it('getDailyList sends status filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await attendanceApi.getDailyList({ page: 1, pageSize: 20, status: 'abnormal' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/daily', {
        params: { page: 1, pageSize: 20, status: 'abnormal' },
      });
    });

    it('recalcDaily sends POST request with date range', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { updated: 5 },
      });
      const result = await attendanceApi.recalcDaily({
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/attendance/daily/recalc', {
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      });
      expect(result.code).toBe(0);
    });

    it('recalcDaily sends employeeId when provided', async () => {
      mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { updated: 1 } });
      await attendanceApi.recalcDaily({
        employeeId: 1,
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/attendance/daily/recalc', {
        employeeId: 1,
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      });
    });
  });

  describe('边界用例', () => {
    it('handles empty list response', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await attendanceApi.getDailyList({ page: 1, pageSize: 20 });
      expect(result.data.list).toHaveLength(0);
      expect(result.data.total).toBe(0);
    });

    it('uses default params when not provided', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await attendanceApi.getDailyList({});
      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/daily', {
        params: {},
      });
    });
  });

  describe('异常用例', () => {
    it('handles permission error (code 5003)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5003,
        message: '无权限访问该数据',
      });
      const result = await attendanceApi.getDailyList({ page: 1, pageSize: 20 });
      expect(result.code).toBe(5003);
      expect(result.message).toBe('无权限访问该数据');
    });

    it('handles recalc with no records error', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 2005,
        message: '排班未配置',
      });
      const result = await attendanceApi.recalcDaily({
        startDate: '2026-08-01',
        endDate: '2026-08-13',
      });
      expect(result.code).toBe(2005);
    });
  });
});
