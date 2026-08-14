import { payslipApi } from '@/services/payslip';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockPayslipItem = {
  code: 'BASE_SALARY',
  name: '基本工资',
  amount: 5000,
  type: 'income',
};

const mockPayslip = {
  id: 1,
  employeeId: 1,
  employeeNo: 'E001',
  employeeName: '张三',
  departmentName: '技术部',
  month: '2026-08',
  runId: 1,
  status: 'unviewed',
  baseSalary: 5000,
  overtimePay: 500,
  absenceDeduction: 0,
  bonus: 200,
  totalIncome: 5700,
  totalDeduction: 500,
  netSalary: 5200,
  items: [
    mockPayslipItem,
    { code: 'OVERTIME', name: '加班费', amount: 500, type: 'income' },
    { code: 'BONUS', name: '全勤奖', amount: 200, type: 'income' },
    { code: 'SOCIAL_SECURITY', name: '社保', amount: 500, type: 'deduction' },
  ],
  adjustments: [],
  createdAt: '2026-08-13T10:00:00+08:00',
  viewedAt: null,
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
        data: mockPayslip,
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

    it('getPayslips sends employee filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payslipApi.getPayslips({ page: 1, pageSize: 20, employeeNo: 'E001' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips', {
        params: { page: 1, pageSize: 20, employeeNo: 'E001' },
      });
    });

    it('getPayslips sends month and department filters', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payslipApi.getPayslips({
        page: 1,
        pageSize: 20,
        month: '2026-08',
        departmentId: 1,
      });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payslips', {
        params: { page: 1, pageSize: 20, month: '2026-08', departmentId: 1 },
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

    it('handles payslip with adjustments', async () => {
      const payslipWithAdjustments = {
        ...mockPayslip,
        adjustments: [
          { code: 'ADJUST_BONUS', name: '绩效调整', amount: 300, type: 'income' },
        ],
      };
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: payslipWithAdjustments,
      });
      const result = await payslipApi.getMyPayslipDetail(1);
      expect(result.data!.adjustments).toHaveLength(1);
      expect(result.data!.adjustments[0].amount).toBe(300);
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
