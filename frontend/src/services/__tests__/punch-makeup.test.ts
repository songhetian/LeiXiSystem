import { punchMakeupApi } from '@/services/attendance';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockMakeupRecord = {
  id: 1,
  employeeId: 100,
  punchDate: '2026-08-15',
  punchType: 'morning',
  originalTime: '09:00:00',
  makeupTime: '08:55:00',
  reason: '地铁延误',
  status: 'pending',
  approvalInstanceId: null,
  createdAt: '2026-08-15T09:30:00+08:00',
};

describe('punchMakeupApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('调用 GET /attendance/punch/makeup 获取补卡列表', async () => {
      (mockedRequest.get as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [mockMakeupRecord], total: 1, page: 1, pageSize: 20 },
      });

      const res = await punchMakeupApi.list({ page: 1, pageSize: 20 });

      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/punch/makeup', {
        params: { page: 1, pageSize: 20 },
      });
      expect(res.code).toBe(0);
      expect(res.data!.list).toHaveLength(1);
    });

    it('支持按状态和日期筛选', async () => {
      (mockedRequest.get as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });

      await punchMakeupApi.list({
        page: 1,
        pageSize: 20,
        status: 'pending',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      });

      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/punch/makeup', {
        params: {
          page: 1,
          pageSize: 20,
          status: 'pending',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
        },
      });
    });
  });

  describe('detail', () => {
    it('调用 GET /attendance/punch/makeup/:id 获取详情', async () => {
      (mockedRequest.get as jest.Mock).mockResolvedValue({ code: 0, data: mockMakeupRecord });

      const res = await punchMakeupApi.detail(1);

      expect(mockedRequest.get).toHaveBeenCalledWith('/attendance/punch/makeup/1');
      expect(res.data!.id).toBe(1);
    });
  });

  describe('create', () => {
    it('调用 POST /attendance/punch/makeup 创建补卡申请', async () => {
      (mockedRequest.post as jest.Mock).mockResolvedValue({ code: 0, data: mockMakeupRecord });

      const res = await punchMakeupApi.create({
        punchDate: '2026-08-15',
        punchType: 'morning',
        originalTime: '09:00',
        makeupTime: '08:55',
        reason: '地铁延误',
      });

      expect(mockedRequest.post).toHaveBeenCalledWith('/attendance/punch/makeup', {
        punchDate: '2026-08-15',
        punchType: 'morning',
        originalTime: '09:00',
        makeupTime: '08:55',
        reason: '地铁延误',
      });
      expect(res.code).toBe(0);
    });
  });

  describe('update', () => {
    it('调用 PUT /attendance/punch/makeup/:id 更新补卡申请', async () => {
      (mockedRequest.put as jest.Mock).mockResolvedValue({
        code: 0,
        data: { ...mockMakeupRecord, reason: '堵车' },
      });

      const res = await punchMakeupApi.update(1, { reason: '堵车' });

      expect(mockedRequest.put).toHaveBeenCalledWith('/attendance/punch/makeup/1', {
        reason: '堵车',
      });
      expect(res.data!.reason).toBe('堵车');
    });
  });

  describe('remove', () => {
    it('调用 DELETE /attendance/punch/makeup/:id 删除补卡申请', async () => {
      (mockedRequest.delete as jest.Mock).mockResolvedValue({ code: 0, data: { success: true } });

      const res = await punchMakeupApi.remove(1);

      expect(mockedRequest.delete).toHaveBeenCalledWith('/attendance/punch/makeup/1');
      expect(res.data!.success).toBe(true);
    });
  });

  describe('submit', () => {
    it('调用 POST /attendance/punch/makeup/:id/submit 提交审批', async () => {
      (mockedRequest.post as jest.Mock).mockResolvedValue({
        code: 0,
        data: { ...mockMakeupRecord, status: 'approving' },
      });

      const res = await punchMakeupApi.submit(1);

      expect(mockedRequest.post).toHaveBeenCalledWith('/attendance/punch/makeup/1/submit');
      expect(res.data!.status).toBe('approving');
    });
  });
});
