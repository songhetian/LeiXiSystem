import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ConversationListPage from '@/features/customer-service/pages/conversation-list';
import { conversationApi } from '@/services/conversation';

jest.mock('@/services/conversation', () => ({
  conversationApi: {
    list: jest.fn(),
    getDetail: jest.fn(),
    getMessages: jest.fn(),
    accept: jest.fn(),
    close: jest.fn(),
    sendMessage: jest.fn(),
  },
}));

jest.mock('@/components/AppLayout', () => ({
  __esModule: true,
  default: ({ children, title, activeMenu }: any) => (
    <div data-testid="app-layout" data-title={title} data-active-menu={activeMenu}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/StatusTag', () => ({
  __esModule: true,
  default: ({ status }: any) => (
    <span data-testid={`status-tag-${status}`}>{status}</span>
  ),
}));

const mockConversations = [
  { id: 1, sessionId: 'sess_001', customerName: '客户A', customerPhone: '13800138000', status: 'pending', lastMessage: '我的订单什么时候发货？', lastMessageTime: '2026-08-13T14:30:00+08:00', unreadCount: 2, startTime: '2026-08-13T14:00:00+08:00', channel: 'web' },
  { id: 2, sessionId: 'sess_002', customerName: '客户B', status: 'active', agentName: '客服小王', lastMessage: '好的，谢谢您', lastMessageTime: '2026-08-13T15:00:00+08:00', unreadCount: 0, startTime: '2026-08-13T14:30:00+08:00', channel: 'web' },
  { id: 3, sessionId: 'sess_003', customerName: '客户C', status: 'closed', agentName: '客服小王', lastMessage: '问题已解决，再见', lastMessageTime: '2026-08-13T12:00:00+08:00', unreadCount: 0, startTime: '2026-08-13T10:00:00+08:00', endTime: '2026-08-13T11:00:00+08:00', channel: 'app' },
];

const mockMessages = [
  { id: 1, conversationId: 1, senderType: 'customer', senderName: '客户A', content: '你好，我有问题', msgType: 'text', timestamp: '2026-08-13T14:00:00+08:00' },
  { id: 2, conversationId: 1, senderType: 'agent', senderName: '客服小王', content: '您好，请问有什么可以帮您？', msgType: 'text', timestamp: '2026-08-13T14:01:00+08:00' },
];

describe('ConversationListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (conversationApi.list as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockConversations, total: 3, page: 1, pageSize: 20 },
    });
    (conversationApi.getDetail as jest.Mock).mockResolvedValue({
      code: 0,
      data: mockConversations[0],
    });
    (conversationApi.getMessages as jest.Mock).mockResolvedValue({
      code: 0,
      data: { list: mockMessages, total: 2 },
    });
  });

  describe('正常用例', () => {
    it('renders inside AppLayout with cs-conversation menu', () => {
      render(<ConversationListPage />);
      expect(screen.getByTestId('app-layout')).toHaveAttribute('data-active-menu', 'cs-conversation');
    });

    it('renders conversation list on left side', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
      });
    });

    it('loads conversation list on mount', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(conversationApi.list).toHaveBeenCalled();
      });
    });

    it('renders conversation items with customer info', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      expect(screen.getByText('客户A')).toBeInTheDocument();
      expect(screen.getByText('客户B')).toBeInTheDocument();
    });

    it('renders last message preview in conversation item', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      expect(screen.getByText('我的订单什么时候发货？')).toBeInTheDocument();
    });

    it('shows unread count badge for pending conversations', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      expect(screen.getByTestId('unread-1')).toHaveTextContent('2');
    });

    it('renders status tags for conversations', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      expect(screen.getAllByTestId('status-tag-pending').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-active').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('status-tag-closed').length).toBeGreaterThan(0);
    });
  });

  describe('会话详情', () => {
    it('shows conversation detail when clicking a conversation', async () => {
      const user = userEvent.setup();
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('conv-item-1'));
      expect(screen.getByTestId('conversation-detail')).toBeInTheDocument();
    });

    it('loads messages when conversation selected', async () => {
      const user = userEvent.setup();
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('conv-item-1'));
      await waitFor(() => {
        expect(conversationApi.getMessages).toHaveBeenCalledWith(1);
      });
    });

    it('renders messages in chat area', async () => {
      const user = userEvent.setup();
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('conv-item-1'));
      await waitFor(() => {
        expect(screen.getByTestId('message-list')).toBeInTheDocument();
      });
      expect(screen.getByText('你好，我有问题')).toBeInTheDocument();
      expect(screen.getByText('您好，请问有什么可以帮您？')).toBeInTheDocument();
    });

    it('shows empty detail placeholder when no conversation selected', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conversation-list')).toBeInTheDocument();
      });
      expect(screen.getByTestId('empty-detail')).toBeInTheDocument();
    });
  });

  describe('承接会话', () => {
    it('shows 承接 button for pending conversations', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-1')).toBeInTheDocument();
      });
      expect(screen.getAllByTestId('btn-accept-1').length).toBeGreaterThan(0);
    });

    it('does not show 承接 button for active/closed conversations', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('conv-item-2')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('btn-accept-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('btn-accept-3')).not.toBeInTheDocument();
    });

    it('calls accept API when 承接 clicked', async () => {
      const user = userEvent.setup();
      (conversationApi.accept as jest.Mock).mockResolvedValue({
        code: 0,
        data: { id: 1, status: 'active', agentName: '客服小王' },
      });
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('btn-accept-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-accept-1'));
      expect(conversationApi.accept).toHaveBeenCalledWith(1);
    });

    it('refreshes list after successful accept', async () => {
      const user = userEvent.setup();
      (conversationApi.accept as jest.Mock).mockResolvedValue({ code: 0 });
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(conversationApi.list).toHaveBeenCalledTimes(1);
      });
      await user.click(screen.getByTestId('btn-accept-1'));
      await waitFor(() => {
        expect(conversationApi.list).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('搜索和过滤', () => {
    it('has status filter tabs (全部/待承接/进行中/已关闭)', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('filter-tabs')).toBeInTheDocument();
      });
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-pending')).toBeInTheDocument();
      expect(screen.getByTestId('filter-active')).toBeInTheDocument();
      expect(screen.getByTestId('filter-closed')).toBeInTheDocument();
    });

    it('filters by status when clicking filter tab', async () => {
      const user = userEvent.setup();
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('filter-pending')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('filter-pending'));
      expect(conversationApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });

    it('has search input for keyword search', async () => {
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('search-input')).toBeInTheDocument();
      });
    });
  });

  describe('边界用例', () => {
    it('handles empty conversation list', async () => {
      (conversationApi.list as jest.Mock).mockResolvedValue({
        code: 0,
        data: { list: [], total: 0, page: 1, pageSize: 20 },
      });
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(conversationApi.list).toHaveBeenCalled();
      });
      expect(screen.getByTestId('empty-list')).toBeInTheDocument();
    });
  });

  describe('异常用例', () => {
    it('handles already accepted error (code 4002)', async () => {
      const user = userEvent.setup();
      (conversationApi.accept as jest.Mock).mockResolvedValue({
        code: 4002,
        message: '会话已被其他客服承接',
      });
      render(<ConversationListPage />);
      await waitFor(() => {
        expect(screen.getByTestId('btn-accept-1')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('btn-accept-1'));
      await waitFor(() => {
        expect(conversationApi.accept).toHaveBeenCalled();
      });
    });
  });
});
