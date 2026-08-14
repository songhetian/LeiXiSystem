import { reimbursementApi } from '@/services/reimbursement';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockType = {
  id: 1,
  name: '差旅费',
  code: 'TRAVEL',
  description: '出差相关费用报销',
  maxAmount: 5000,
  status: 'active',
};

const mockItem = {
  id: 1,
  typeId: 1,
  typeName: '差旅费',
  amount: 1000,
  description: '北京出差交通费',
  date: '2026-08-10',
  receiptUrl: '/uploads/receipt.jpg',
};

const mockReimbursement = {
  id: 1,
  applicantId: 1,
  applicantNo: 'E001',
  applicantName: '张三',
  departmentName: '技术部',
  title: '8月北京出差报销',
  totalAmount: 1500,
  status: 'draft',
  description: '北京出差产生的交通和住宿费用',
  currentApproverName: null,
  submittedAt: null,
  approvedAt: null,
  createdAt: '2026-08-13T10:00:00+08:00',
  items: [mockItem, { ...mockItem, id: 2, amount: 500, description: '住宿费' }],
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockReimbursement],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

const mockTypeListResponse = {
  code: 0,
  message: 'ok',
  data: [mockType, { id: 2, name: '餐饮费', code: 'MEAL', status: 'active' }],
};

describe('reimbursementApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('报销类型 - 正常用例', () => {
    it('getTypes sends GET request', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockTypeListResponse);
      const result = await reimbursementApi.getTypes();
      expect(mockedRequest.get).toHaveBeenCalledWith('/reimbursements/types');
      expect(result.code).toBe(0);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('我的报销 - 正常用例', () => {
    it('getMyReimbursements sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await reimbursementApi.getMyReimbursements({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/reimbursements/mine', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data!.list).toHaveLength(1);
    });

    it('getMyReimbursements sends status filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await reimbursementApi.getMyReimbursements({ page: 1, pageSize: 20, status: 'draft' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/reimbursements/mine', {
        params: { page: 1, pageSize: 20, status: 'draft' },
      });
    });
  });

  describe('待审批 - 正常用例', () => {
    it('getPendingApprovals sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await reimbursementApi.getPendingApprovals({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/reimbursements/pending', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
    });
  });

  describe('报销详情 - 正常用例', () => {
    it('getDetail sends GET request', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: mockReimbursement,
      });
      const result = await reimbursementApi.getDetail(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/reimbursements/1');
      expect(result.code).toBe(0);
      expect(result.data!.id).toBe(1);
      expect(result.data!.items).toHaveLength(2);
    });
  });

  describe('创建报销 - 正常用例', () => {
    it('createReimbursement sends POST request with items', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 2 },
      });
      const result = await reimbursementApi.createReimbursement({
        title: '8月北京出差报销',
        totalAmount: 1500,
        description: '出差费用',
        items: [
          { typeId: 1, amount: 1000, description: '交通费', date: '2026-08-10' },
          { typeId: 1, amount: 500, description: '住宿费', date: '2026-08-11' },
        ],
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/reimbursements', {
        title: '8月北京出差报销',
        totalAmount: 1500,
        description: '出差费用',
        items: [
          { typeId: 1, amount: 1000, description: '交通费', date: '2026-08-10' },
          { typeId: 1, amount: 500, description: '住宿费', date: '2026-08-11' },
        ],
      });
      expect(result.code).toBe(0);
    });
  });

  describe('提交审批 - 正常用例', () => {
    it('submitApproval sends POST request', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'pending' },
      });
      const result = await reimbursementApi.submitApproval(1);
      expect(mockedRequest.post).toHaveBeenCalledWith('/reimbursements/1/submit', {});
      expect(result.code).toBe(0);
    });
  });

  describe('审批操作 - 正常用例', () => {
    it('approve sends POST request with comment', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'approved' },
      });
      const result = await reimbursementApi.approve(1, { comment: '同意' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/reimbursements/1/approve', {
        comment: '同意',
      });
      expect(result.code).toBe(0);
    });

    it('reject sends POST request with comment', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { id: 1, status: 'rejected' },
      });
      const result = await reimbursementApi.reject(1, { comment: '票据不全' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/reimbursements/1/reject', {
        comment: '票据不全',
      });
      expect(result.code).toBe(0);
    });
  });

  describe('边界用例', () => {
    it('handles empty reimbursement list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await reimbursementApi.getMyReimbursements({ page: 1, pageSize: 20 });
      expect(result.data!.list).toHaveLength(0);
      expect(result.data!.total).toBe(0);
    });

    it('uses default params when not provided', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await reimbursementApi.getMyReimbursements({});
      expect(mockedRequest.get).toHaveBeenCalledWith('/reimbursements/mine', {
        params: {},
      });
    });

    it('handles empty type list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: [],
      });
      const result = await reimbursementApi.getTypes();
      expect(result.data).toHaveLength(0);
    });

    it('handles reimbursement with no items', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { ...mockReimbursement, items: [] },
      });
      const result = await reimbursementApi.getDetail(1);
      expect(result.data!.items).toHaveLength(0);
    });
  });

  describe('异常用例', () => {
    it('handles amount mismatch error (code 7001)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 7001,
        message: '明细金额合计与总金额不一致',
      });
      const result = await reimbursementApi.createReimbursement({
        title: '测试',
        totalAmount: 1500,
        items: [{ typeId: 1, amount: 1000, description: '测试', date: '2026-08-10' }],
      });
      expect(result.code).toBe(7001);
      expect(result.message).toBe('明细金额合计与总金额不一致');
    });

    it('handles reimbursement not found error (code 7002)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 7002,
        message: '报销单不存在',
      });
      const result = await reimbursementApi.getDetail(999);
      expect(result.code).toBe(7002);
    });

    it('handles status not allowed error (code 7003)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 7003,
        message: '当前状态不允许提交审批',
      });
      const result = await reimbursementApi.submitApproval(1);
      expect(result.code).toBe(7003);
    });

    it('handles permission error (code 5003)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 5003,
        message: '无权限访问该数据',
      });
      const result = await reimbursementApi.getMyReimbursements({ page: 1, pageSize: 20 });
      expect(result.code).toBe(5003);
    });

    it('handles not approver error (code 7004)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 7004,
        message: '您不是当前审批人',
      });
      const result = await reimbursementApi.approve(1, { comment: '同意' });
      expect(result.code).toBe(7004);
    });
  });
});
