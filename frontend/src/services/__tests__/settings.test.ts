import { settingsApi } from '@/services/settings';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockSetting = {
  id: 1,
  group: 'general',
  key: 'companyName',
  value: '雷犀科技',
  label: '公司名称',
  description: '企业对外显示名称',
  isPublic: false,
  updatedAt: '2026-08-13T10:00:00+08:00',
  updatedBy: 1,
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: [mockSetting],
};

describe('settingsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list - 正常用例', () => {
    it('list() 发送 GET /settings', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await settingsApi.list();
      expect(mockedRequest.get).toHaveBeenCalledWith('/settings', undefined);
      expect(result.code).toBe(0);
      expect(result.data).toHaveLength(1);
    });

    it('list(group) 发送带 params 的 GET /settings', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: [mockSetting],
      });
      const result = await settingsApi.list('general');
      expect(mockedRequest.get).toHaveBeenCalledWith('/settings', {
        params: { group: 'general' },
      });
      expect(result.code).toBe(0);
    });
  });

  describe('get - 正常用例', () => {
    it('get(key) 发送 GET /settings/:key', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: mockSetting,
      });
      const result = await settingsApi.get('companyName');
      expect(mockedRequest.get).toHaveBeenCalledWith('/settings/companyName');
      expect(result.code).toBe(0);
      expect(result.data?.key).toBe('companyName');
    });
  });

  describe('update - 正常用例', () => {
    it('update(key, data) 发送 PUT /settings/:key', async () => {
      mockedRequest.put.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: { ...mockSetting, value: 'green' },
      });
      const result = await settingsApi.update('themeColor', { value: 'green' });
      expect(mockedRequest.put).toHaveBeenCalledWith('/settings/themeColor', {
        value: 'green',
      });
      expect(result.code).toBe(0);
    });
  });

  describe('bulkUpdate - 正常用例', () => {
    it('bulkUpdate(items) 发送 POST /settings 带 items', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        message: 'ok',
        data: [mockSetting],
      });
      const items = [{ key: 'companyName', value: '雷犀科技' }];
      const result = await settingsApi.bulkUpdate(items);
      expect(mockedRequest.post).toHaveBeenCalledWith('/settings', { items });
      expect(result.code).toBe(0);
    });
  });

  describe('remove - 正常用例', () => {
    it('remove(key) 发送 DELETE /settings/:key', async () => {
      mockedRequest.delete.mockResolvedValueOnce({ code: 0, message: 'ok' });
      const result = await settingsApi.remove('companyName');
      expect(mockedRequest.delete).toHaveBeenCalledWith('/settings/companyName');
      expect(result.code).toBe(0);
    });
  });

  describe('异常用例', () => {
    it('get 不存在的 key 返回 7201', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 7201,
        message: '设置项不存在',
      });
      const result = await settingsApi.get('no-such-key');
      expect(result.code).toBe(7201);
      expect(result.message).toBe('设置项不存在');
    });

    it('无权限更新返回 5003', async () => {
      mockedRequest.put.mockResolvedValueOnce({
        code: 5003,
        message: '无权限访问该数据',
      });
      const result = await settingsApi.update('themeColor', { value: 'hack' });
      expect(result.code).toBe(5003);
    });
  });
});
