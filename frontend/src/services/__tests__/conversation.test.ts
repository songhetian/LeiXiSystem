import { conversationApi } from '@/services/conversation';
import request from '@/lib/request';

jest.mock('@/lib/request');
const mockedRequest = request as jest.Mocked<typeof request>;

const mockConversation = {
  id: 1,
  sessionId: 'sess_001',
  customerName: '客户A',
  customerPhone: '13800138000',
  status: 'active',
  agentName: '客服小王',
  lastMessage: '我的订单什么时候发货？',
  lastMessageTime: '2026-08-13T14:30:00+08:00',
  unreadCount: 2,
  startTime: '2026-08-13T14:00:00+08:00',
  channel: 'web',
};

const mockMessage = {
  id: 1,
  conversationId: 1,
  senderType: 'customer',
  senderName: '客户A',
  content: '你好，我有问题',
  msgType: 'text',
  timestamp: '2026-08-13T14:00:00+08:00',
};

const mockListResponse = {
  code: 0,
  message: 'ok',
  data: {
    list: [mockConversation],
    total: 1,
    page: 1,
    pageSize: 20,
  },
};

describe('conversationApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('会话列表', () => {
    it('list sends GET request with pagination', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      const result = await conversationApi.list({ page: 1, pageSize: 20 });
      expect(mockedRequest.get).toHaveBeenCalledWith('/cs/conversations', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.code).toBe(0);
      expect(result.data.list).toHaveLength(1);
    });

    it('list sends status filter', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await conversationApi.list({ page: 1, pageSize: 20, status: 'active' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/cs/conversations', {
        params: { page: 1, pageSize: 20, status: 'active' },
      });
    });

    it('list sends keyword search', async () => {
      mockedRequest.get.mockResolvedValueOnce(mockListResponse);
      await conversationApi.list({ page: 1, pageSize: 20, keyword: '客户A' });
      expect(mockedRequest.get).toHaveBeenCalledWith('/cs/conversations', {
        params: { page: 1, pageSize: 20, keyword: '客户A' },
      });
    });

    it('handles empty list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      const result = await conversationApi.list({ page: 1, pageSize: 20 });
      expect(result.data.list).toHaveLength(0);
      expect(result.data.total).toBe(0);
    });
  });

  describe('会话详情', () => {
    it('getDetail sends GET request with id', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: mockConversation,
      });
      const result = await conversationApi.getDetail(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/cs/conversations/1');
      expect(result.code).toBe(0);
    });

    it('getMessages sends GET request for message list', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 0,
        data: { list: [mockMessage], total: 1 },
      });
      const result = await conversationApi.getMessages(1);
      expect(mockedRequest.get).toHaveBeenCalledWith('/cs/conversations/1/messages');
      expect(result.code).toBe(0);
    });
  });

  describe('会话操作', () => {
    it('accept sends POST request to accept endpoint', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        data: { id: 1, status: 'active', agentName: '客服小王' },
      });
      const result = await conversationApi.accept(1);
      expect(mockedRequest.post).toHaveBeenCalledWith('/cs/conversations/1/accept');
      expect(result.code).toBe(0);
    });

    it('close sends POST request to close endpoint', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        data: { id: 1, status: 'closed' },
      });
      const result = await conversationApi.close(1, { closeReason: '问题已解决' });
      expect(mockedRequest.post).toHaveBeenCalledWith('/cs/conversations/1/close', {
        closeReason: '问题已解决',
      });
      expect(result.code).toBe(0);
    });

    it('sendMessage sends POST request with message content', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 0,
        data: { id: 2, content: '您好，请问有什么可以帮您？', msgType: 'text' },
      });
      const result = await conversationApi.sendMessage(1, {
        content: '您好，请问有什么可以帮您？',
        msgType: 'text',
      });
      expect(mockedRequest.post).toHaveBeenCalledWith('/cs/conversations/1/messages', {
        content: '您好，请问有什么可以帮您？',
        msgType: 'text',
      });
      expect(result.code).toBe(0);
    });
  });

  describe('异常用例', () => {
    it('handles conversation not found (code 4001)', async () => {
      mockedRequest.get.mockResolvedValueOnce({
        code: 4001,
        message: '会话不存在',
      });
      const result = await conversationApi.getDetail(999);
      expect(result.code).toBe(4001);
    });

    it('handles already accepted error (code 4002)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 4002,
        message: '会话已被其他客服承接',
      });
      const result = await conversationApi.accept(1);
      expect(result.code).toBe(4002);
    });

    it('handles already closed error (code 4003)', async () => {
      mockedRequest.post.mockResolvedValueOnce({
        code: 4003,
        message: '会话已关闭',
      });
      const result = await conversationApi.sendMessage(1, { content: 'test', msgType: 'text' });
      expect(result.code).toBe(4003);
    });
  });
});
