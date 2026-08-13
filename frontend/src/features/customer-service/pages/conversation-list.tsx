'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Button, Space, Message, Badge, InputTag } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import StatusTag from '@/components/StatusTag';
import { conversationApi, Conversation, Message } from '@/services/conversation';

const { Search } = Input;
const { TextArea } = Input;

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待承接', color: 'gold' },
  active: { label: '进行中', color: 'green' },
  closed: { label: '已关闭', color: 'gray' },
};

const filterTabs = [
  { key: 'all', label: '全部', status: '' },
  { key: 'pending', label: '待承接', status: 'pending' },
  { key: 'active', label: '进行中', status: 'active' },
  { key: 'closed', label: '已关闭', status: 'closed' },
];

export default function ConversationListPage() {
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchKeyword, setSearchKeyword] = useState('');

  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);

  const [sendText, setSendText] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async (page = 1, pageSize = 20, status = '', keyword = '') => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (status) params.status = status;
      if (keyword) params.keyword = keyword;
      const result = await conversationApi.list(params);
      if (result.code === 0 && result.data) {
        setConversations(result.data.list);
        setPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations(1, 20, '', '');
  }, []);

  const handleFilterChange = (key: string, status: string) => {
    setActiveFilter(key);
    fetchConversations(1, pagination.pageSize, status, searchKeyword);
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    fetchConversations(1, pagination.pageSize, filterTabs.find(t => t.key === activeFilter)?.status || '', value);
  };

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    setMessageLoading(true);
    try {
      const result = await conversationApi.getMessages(conv.id);
      if (result.code === 0 && result.data) {
        setMessages(result.data.list);
      }
    } finally {
      setMessageLoading(false);
    }
  };

  const handleAccept = async (e: React.MouseEvent, convId: number) => {
    e.stopPropagation();
    try {
      const result = await conversationApi.accept(convId);
      if (result.code === 0) {
        Message.success('承接成功');
        const status = filterTabs.find(t => t.key === activeFilter)?.status || '';
        fetchConversations(pagination.current, pagination.pageSize, status, searchKeyword);
      } else {
        Message.error(result.message || '承接失败');
      }
    } catch (err) {
      Message.error('承接失败');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedConv || !sendText.trim()) return;
    setSendLoading(true);
    try {
      const result = await conversationApi.sendMessage(selectedConv.id, {
        content: sendText.trim(),
        msgType: 'text',
      });
      if (result.code === 0 && result.data) {
        setMessages(prev => [...prev, result.data!]);
        setSendText('');
      } else {
        Message.error(result.message || '发送失败');
      }
    } catch (err) {
      Message.error('发送失败');
    } finally {
      setSendLoading(false);
    }
  };

  return (
    <AppLayout title="客服会话" activeMenu="cs-conversation">
      <div style={{ display: 'flex', height: 'calc(100vh - 64px - 48px)', margin: -16 }}>
        <div
          style={{
            width: 320,
            borderRight: '1px solid var(--color-border-2)',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--color-bg-1)',
          }}
        >
          <div style={{ padding: 12, borderBottom: '1px solid var(--color-border-2)' }}>
            <Search
              placeholder="搜索客户名称/手机号"
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
              data-testid="search-input"
            />
          </div>

          <div data-testid="filter-tabs" style={{ display: 'flex', padding: '8px 12px', gap: 8 }}>
            {filterTabs.map(tab => (
              <Button
                key={tab.key}
                size="small"
                type={activeFilter === tab.key ? 'primary' : 'text'}
                onClick={() => handleFilterChange(tab.key, tab.status)}
                data-testid={`filter-${tab.key}`}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div
            data-testid="conversation-list"
            style={{ flex: 1, overflowY: 'auto' }}
          >
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-3)' }}>
                加载中...
              </div>
            ) : conversations.length === 0 ? (
              <div
                data-testid="empty-list"
                style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)' }}
              >
                暂无会话
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  data-testid={`conv-item-${conv.id}`}
                  onClick={() => handleSelectConversation(conv)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border-2)',
                    cursor: 'pointer',
                    background: selectedConv?.id === conv.id ? 'var(--color-fill-2)' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{conv.customerName}</span>
                    <StatusTag status={conv.status} statusMap={statusMap} size="small" />
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-2)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {conv.lastMessage || '暂无消息'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                      {conv.lastMessageTime?.slice(11, 16) || ''}
                    </span>
                    <Space size="small">
                      {conv.unreadCount > 0 && (
                        <Badge data-testid={`unread-${conv.id}`} count={conv.unreadCount} />
                      )}
                      {conv.status === 'pending' && (
                        <Button
                          size="mini"
                          type="primary"
                          onClick={(e) => handleAccept(e, conv.id)}
                          data-testid={`btn-accept-${conv.id}`}
                        >
                          承接
                        </Button>
                      )}
                    </Space>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {!selectedConv ? (
            <div
              data-testid="empty-detail"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-3)',
                fontSize: 14,
              }}
            >
              请选择一个会话查看详情
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--color-border-2)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                data-testid="conversation-detail"
              >
                <div>
                  <span style={{ fontWeight: 500, fontSize: 16 }}>{selectedConv.customerName}</span>
                  <span style={{ marginLeft: 12, color: 'var(--color-text-3)' }}>
                    {selectedConv.customerPhone || ''}
                  </span>
                </div>
                <Space>
                  <StatusTag status={selectedConv.status} statusMap={statusMap} />
                  {selectedConv.status === 'active' && (
                    <Button
                      size="small"
                      status="danger"
                      onClick={async () => {
                        try {
                          const result = await conversationApi.close(selectedConv.id, { closeReason: '正常结束' });
                          if (result.code === 0) {
                            Message.success('会话已关闭');
                            const status = filterTabs.find(t => t.key === activeFilter)?.status || '';
                            fetchConversations(pagination.current, pagination.pageSize, status, searchKeyword);
                            setSelectedConv(null);
                          } else {
                            Message.error(result.message || '关闭失败');
                          }
                        } catch (err) {
                          Message.error('关闭失败');
                        }
                      }}
                    >
                      结束会话
                    </Button>
                  )}
                </Space>
              </div>

              <div
                data-testid="message-list"
                ref={messagesEndRef}
                style={{
                  flex: 1,
                  padding: 16,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {messageLoading ? (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-3)' }}>加载中...</div>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: msg.senderType === 'agent' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: msg.senderType === 'agent'
                            ? 'var(--color-primary-light-1)'
                            : 'var(--color-fill-2)',
                          wordBreak: 'break-word',
                        }}
                      >
                        <div style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 4 }}>
                          {msg.senderName}
                        </div>
                        <div>{msg.content}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedConv.status === 'active' && (
                <div
                  style={{
                    padding: 12,
                    borderTop: '1px solid var(--color-border-2)',
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <TextArea
                    value={sendText}
                    onChange={setSendText}
                    placeholder="输入消息..."
                    style={{ flex: 1, minHeight: 60, resize: 'none' }}
                  />
                  <Button
                    type="primary"
                    loading={sendLoading}
                    onClick={handleSendMessage}
                    disabled={!sendText.trim()}
                  >
                    发送
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
