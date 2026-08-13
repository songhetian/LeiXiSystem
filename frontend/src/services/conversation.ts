import request from '@/lib/request';

export interface Conversation {
  id: number;
  sessionId: string;
  customerName: string;
  customerPhone?: string;
  status: 'pending' | 'active' | 'closed';
  agentId?: number;
  agentName?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  startTime: string;
  endTime?: string;
  channel: string;
}

export interface Message {
  id: number;
  conversationId: number;
  senderType: 'customer' | 'agent' | 'system';
  senderName: string;
  content: string;
  msgType: 'text' | 'image' | 'file';
  timestamp: string;
}

export interface ConversationListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
  agentId?: number;
}

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: {
    list: T[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface DetailResult<T> {
  code: number;
  message?: string;
  data?: T;
}

export interface MessageListResult {
  code: number;
  message?: string;
  data?: {
    list: Message[];
    total: number;
  };
}

export interface CloseParams {
  closeReason?: string;
}

export interface SendMessageParams {
  content: string;
  msgType: 'text' | 'image' | 'file';
}

export const conversationApi = {
  list(params: ConversationListParams = {}): Promise<ListResult<Conversation>> {
    return request.get('/cs/conversations', { params });
  },

  getDetail(id: number): Promise<DetailResult<Conversation>> {
    return request.get(`/cs/conversations/${id}`);
  },

  getMessages(id: number): Promise<MessageListResult> {
    return request.get(`/cs/conversations/${id}/messages`);
  },

  accept(id: number): Promise<DetailResult<any>> {
    return request.post(`/cs/conversations/${id}/accept`);
  },

  close(id: number, params: CloseParams): Promise<DetailResult<any>> {
    return request.post(`/cs/conversations/${id}/close`, params);
  },

  sendMessage(id: number, params: SendMessageParams): Promise<DetailResult<Message>> {
    return request.post(`/cs/conversations/${id}/messages`, params);
  },
};
