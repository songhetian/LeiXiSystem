import { payrollApi } from '@/services/payroll';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockSalaryItem = {
  id: 1,
  code: 'BASE_SALARY',
  name: '基本工资',
  type: 'fixed',
  amount: 5000,
  status: 'active',
};

const mockPayrollRun = {
  id: 1,
  month: '2026-08',
  status: 'draft',
  totalEmployees: 10,
  totalAmount: 50000,
  createdAt: '2026-08-13T10:00:00+08:00',
  confirmedAt: null,
  publishedAt: null,
};

const mockPayrollDetail = {
  employee: {
    id: 1,
    employeeNo: 'E001',
    name: '张三',
    departmentId: 1,
  },
  items: [
    { code: 'BASE_SALARY', name: '基本工资', amount: 5000 },
    { code: 'OVERTIME', name: '加班费', amount: 500 },
    { code: 'BONUS', name: '全勤奖', amount: 200 },
  ],
  adjustments: [],
  total: 5700,
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockPayrollRun],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

const mockItemListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockSalaryItem],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

describe('payrollApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('薪资项目 - 正常用例', () => {
    it('getSalaryItems sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockItemListResponse);
      const result = await payrollApi.getSalaryItems({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payroll/items', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
    });

    it('createSalaryItem sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 2 },
      });
      const result = await payrollApi.createSalaryItem({
        code: 'BONUS',
        name: '绩效奖金',
        type: 'fixed',
        amount: 1000,
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/payroll/items', {
        code: 'BONUS',
        name: '绩效奖金',
        type: 'fixed',
        amount: 1000,
      });
      expect(result.code).toBe(0);
    });

    it('updateSalaryItem sends PATCH request', async () => {
      mockedRequest.patch.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, amount: 6000 },
      });
      const result = await payrollApi.updateSalaryItem(1, { amount: 6000 });
      expect(mockedRequest.patch).toHaveBeenCalledWith('/payroll/items/1', {
        amount: 6000,
      });
      expect(result.code).toBe(0);
    });
  });

  describe('算薪批次 - 正常用例', () => {
    it('getPayrollRuns sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await payrollApi.getPayrollRuns({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payroll/runs', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
    });

    it('getPayrollRuns sends status filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payrollApi.getPayrollRuns({ page: 1, pageSize: 20, status: 'draft' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payroll/runs', {
        params: { page: 1, pageSize: 20, status: 'draft' },
      });
    });

    it('getPayrollRuns sends month filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payrollApi.getPayrollRuns({ page: 1, pageSize: 20, month: '2026-08' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/payroll/runs', {
        params: { page: 1, pageSize: 20, month: '2026-08' },
      });
    });

    it('createPayrollRun sends POST request with month', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 2, month: '2026-09', status: 'draft' },
      });
      const result = await payrollApi.createPayrollRun({ month: '2026-09' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/payroll/runs', {
        month: '2026-09',
      });
      expect(result.code).toBe(0);
    });

    it('getPayrollRunDetail sends GET request', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: mockPayrollRun,
      });
      const result = await payrollApi.getPayrollRunDetail(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/payroll/runs/1');
      expect(result.code).toBe(0);
      expect(result.data!.id).toBe(1);
    });

    it('getPayrollRunDetails sends GET request for run details', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: {
          run: mockPayrollRun,
          employees: [mockPayrollDetail],
        },
      });
      const result = await payrollApi.getPayrollRunDetails(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/payroll/runs/1/details');
      expect(result.code).toBe(0);
    });

    it('confirmPayrollRun sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'confirmed' },
      });
      const result = await payrollApi.confirmPayrollRun(1);
      expect(mockedRequest.post).toHaveBeenCalledWith('/payroll/runs/1/confirm', {});
      expect(result.code).toBe(0);
    });

    it('publishPayrollRun sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'published' },
      });
      const result = await payrollApi.publishPayrollRun(1);
      expect(mockedRequest.post).toHaveBeenCalledWith('/payroll/runs/1/publish', {});
      expect(result.code).toBe(0);
    });

    it('recallPayrollRun sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'recalled' },
      });
      const result = await payrollApi.recallPayrollRun(1);
      expect(mockedRequest.post).toHaveBeenCalledWith('/payroll/runs/1/recall', {});
      expect(result.code).toBe(0);
    });

    it('adjustPayrollRun sends POST request with adjustment', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1 },
      });
      const result = await payrollApi.adjustPayrollRun(1, {
        employeeId: 1,
        itemCode: 'BONUS',
        amount: 500,
        reason: '绩效调整',
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/payroll/runs/1/adjust', {
        employeeId: 1,
        itemCode: 'BONUS',
        amount: 500,
        reason: '绩效调整',
      });
      expect(result.code).toBe(0);
    });
  });

  describe('边界用例', () => {
    it('handles empty payroll runs list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await payrollApi.getPayrollRuns({ page: 1, pageSize: 20 });
      expect(result.data!.list).toHaveLength(0);
      expect(result.data!.total).toBe(0);
    });

    it('uses default params when not provided', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await payrollApi.getPayrollRuns({});
      expect(mockedRequest.get).toHaveBeenCalledWith('/payroll/runs', {
        params: {},
      });
    });

    it('handles empty salary items list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await payrollApi.getSalaryItems({ page: 1, pageSize: 20 });
      expect(result.data!.list).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles duplicate month error (code 3001)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 3001,
        message: '该月份批次已存在',
      });
      const result = await payrollApi.createPayrollRun({ month: '2026-08' });
      expect(result.code).toBe(3001);
      expect(result.message).toBe('该月份批次已存在');
    });

    it('handles duplicate item code error (code 3006)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 3006,
        message: '项目编码已存在',
      });
      const result = await payrollApi.createSalaryItem({
        code: 'BASE_SALARY',
        name: '基本工资',
        type: 'fixed',
        amount: 5000,
      });
      expect(result.code).toBe(3006);
    });

    it('handles status not allowed error (code 3003)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 3003,
        message: '批次已发布不可修改',
      });
      const result = await payrollApi.confirmPayrollRun(1);
      expect(result.code).toBe(3003);
    });

    it('handles payroll run not found error (code 3004)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 3004,
        message: '批次不存在',
      });
      const result = await payrollApi.getPayrollRunDetail(999);
      expect(result.code).toBe(3004);
    });

    it('handles adjustment not allowed in confirmed status (code 3007)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 3007,
        message: '非 draft 状态禁止调整',
      });
      const result = await payrollApi.adjustPayrollRun(1, {
        employeeId: 1,
        itemCode: 'BONUS',
        amount: 500,
        reason: '调整',
      });
      expect(result.code).toBe(3007);
    });

    it('handles recall with viewed payslips error (code 3005)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 3005,
        message: '存在已查看工资条，不可撤回',
      });
      const result = await payrollApi.recallPayrollRun(1);
      expect(result.code).toBe(3005);
    });

    it('handles permission error (code 5003)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5003,
        message: '无权限访问该数据',
      });
      const result = await payrollApi.getPayrollRuns({ page: 1, pageSize: 20 });
      expect(result.code).toBe(5003);
    });
  });
});
