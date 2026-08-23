import { payslipApi } from '@/services/payslip';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockPayslipItem = {
  code: 'BASE_SALARY',
  name: '基本工资',
  amount: 5000,
};

const mockPayslip = {
  id: 1,
  runId: 1,
  employeeId: 1,
  month: '2026-08',
  totalAmount: 5200,
  status: 'unviewed' as const,
  viewedAt: null,
  itemsJson: '[{"code":"BASE_SALARY","name":"基本工资","amount":5000}]',
  createdAt: '2026-08-13T10:00:00+08:00',
  updatedAt: '2026-08-13T10:00:00+08:00',
};

const mockPayslipDetail = {
  ...mockPayslip,
  items: [
    mockPayslipItem,
    { code: 'OVERTIME', name: '加班费', amount: 500 },
    { code: 'BONUS', name: '全勤奖', amount: 200 },
    { code: 'SOCIAL_SECURITY', name: '社保', amount: -500 },
  ],
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockPayslip],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

describe('payslipApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('员工自助 - 正常用例', () => {
    it('getMyPayslips sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await payslipApi.getMyPayslips({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips/me', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
    });

    it('getMyPayslips sends month filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payslipApi.getMyPayslips({ page: 1, pageSize: 20, month: '2026-08' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips/me', {
        params: { page: 1, pageSize: 20, month: '2026-08' },
      });
    });

    it('getMyPayslipDetail sends GET request for single payslip', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: mockPayslipDetail,
      });
      const result = await payslipApi.getMyPayslipDetail(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips/me/1');
      expect(result.code).toBe(0);
      expect(result.data!.id).toBe(1);
    });

    it('markAsViewed sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'viewed' },
      });
      const result = await payslipApi.markAsViewed(1);
      expect(mockedRequest.post).toHaveBeenCalledWith('/payslips/me/1/view', {});
      expect(result.code).toBe(0);
    });
  });

  describe('HR管理 - 正常用例', () => {
    it('getPayslips sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await payslipApi.getPayslips({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
    });

    it('getPayslips sends runId filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payslipApi.getPayslips({ page: 1, pageSize: 20, runId: 1 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips', {
        params: { page: 1, pageSize: 20, runId: 1 },
      });
    });

    it('getPayslips sends month filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payslipApi.getPayslips({
        page: 1,
        pageSize: 20,
        month: '2026-08',
      });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips', {
        params: { page: 1, pageSize: 20, month: '2026-08' },
      });
    });
  });

  describe('边界用例', () => {
    it('handles empty payslip list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await payslipApi.getMyPayslips({ page: 1, pageSize: 20 });
      expect(result.data!.list).toHaveLength(0);
      expect(result.data!.total).toBe(0);
    });

    it('uses default params when not provided', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payslipApi.getMyPayslips({});
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips/me', {
        params: {},
      });
    });

    it('handles payslip with multiple items', async () => {
      const payslipWithItems = {
        ...mockPayslipDetail,
        items: [
          { code: 'BASE_SALARY', name: '基本工资', amount: 5000 },
          { code: 'OVERTIME', name: '加班费', amount: 500 },
          { code: 'BONUS', name: '全勤奖', amount: 200 },
        ],
      };
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: payslipWithItems,
      });
      const result = await payslipApi.getMyPayslipDetail(1);
      expect(result.data!.items).toHaveLength(3);
      expect(result.data!.items[0].amount).toBe(5000);
    });
  });

  describe('异常用例', () => {
    it('handles payslip not found error (code 4004)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 4004,
        message: '工资条不存在',
      });
      const result = await payslipApi.getMyPayslipDetail(999);
      expect(result.code).toBe(4004);
      expect(result.message).toBe('工资条不存在');
    });

    it('handles permission error (code 5003)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5003,
        message: '无权限访问该数据',
      });
      const result = await payslipApi.getPayslips({ page: 1, pageSize: 20 });
      expect(result.code).toBe(5003);
    });

    it('handles already viewed mark request (idempotent)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'viewed' },
      });
      const result = await payslipApi.markAsViewed(1);
      expect(result.code).toBe(0);
    });
  });
});
