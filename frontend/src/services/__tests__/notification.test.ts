import { notificationApi } from '@/services/notification';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockNotification = {
  id: 1,
  title: '审批通过',
  content: '您的请假申请已通过',
  type: 'approval',
  read: false,
  createdAt: '2026-08-14T09:00:00+08:00',
};

describe('notificationApi（T27）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('list 发送 GET /notifications 带分页与 read 过滤', async () => {
    mockedRequest.get.mockResolvedValueOnce({
      code: 0,
      data: { list: [mockNotification], total: 1, page: 1, pageSize: 20 },
    });
    const result = await notificationApi.list({ page: 1, pageSize: 20, read: false });
    expect(mockedRequest.get).toHaveBeenCalledWith('/notifications', {
      params: { page: 1, pageSize: 20, read: false },
    });
    expect(result.data?.list).toHaveLength(1);
  });

  it('unreadCount 发送 GET /notifications/unread-count', async () => {
    mockedRequest.get.mockResolvedValueOnce({ code: 0, data: { count: 3 } });
    const result = await notificationApi.unreadCount();
    expect(mockedRequest.get).toHaveBeenCalledWith('/notifications/unread-count');
    expect(result.data?.count).toBe(3);
  });

  it('markRead 发送 POST /notifications/:id/read', async () => {
    mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { success: true } });
    await notificationApi.markRead(5);
    expect(mockedRequest.post).toHaveBeenCalledWith('/notifications/5/read');
  });

  it('markAllRead 发送 POST /notifications/read-all', async () => {
    mockedRequest.post.mockResolvedValueOnce({ code: 0, data: { success: true } });
    await notificationApi.markAllRead();
    expect(mockedRequest.post).toHaveBeenCalledWith('/notifications/read-all');
  });
});
