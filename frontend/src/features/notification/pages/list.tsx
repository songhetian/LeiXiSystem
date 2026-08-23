'use client';

import { useState, useEffect } from 'react';
import { Message, Card, Tag, Button, Space, Badge, List, Empty } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notificationApi, Notification } from '@/services/notification';

const typeMap: Record<string, { label: string; color: string }> = {
  approval: { label: '审批', color: 'arcoblue' },
  system: { label: '系统', color: 'gray' },
  attendance: { label: '考勤', color: 'green' },
  broadcast: { label: '公告', color: 'orangered' },
};

export default function NotificationsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  const fetchList = async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.list({ page: 1, pageSize: 50 }),
        notificationApi.unreadCount(),
      ]);
      if (listRes.code === 0 && listRes.data) setData(listRes.data.list);
      if (countRes.code === 0 && countRes.data) setUnread(countRes.data.count);
    } catch (e) {
      Message.error('获取通知失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleReadAll = async () => {
    try {
      const res = await notificationApi.markAllRead();
      if (res.code === 0) {
        Message.success('已全部标记为已读');
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    }
  };

  const handleReadOne = async (item: Notification) => {
    if (item.read) return;
    try {
      const res = await notificationApi.markRead(item.id);
      if (res.code === 0) fetchList();
    } catch (e) {
      // 忽略单条已读失败
    }
  };

  return (
    <PageContainer
      title="我的通知"
      action={
        <Space>
          {unread > 0 && <Badge count={unread} />}
          <Button size="small" onClick={handleReadAll} disabled={unread === 0}>
            全部已读
          </Button>
        </Space>
      }
    >
      <Card loading={loading}>
        {data.length === 0 ? (
          <Empty description="暂无通知" />
        ) : (
          <List
            dataSource={data}
            render={(item) => (
              <div
                key={item.id}
                onClick={() => handleReadOne(item)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 4px',
                  borderBottom: '1px solid var(--color-border-2)',
                  cursor: item.read ? 'default' : 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={item.read ? { color: '#86909c' } : { fontWeight: 600 }}>
                    {item.title}
                  </span>
                  {item.content ? (
                    <div style={{ fontSize: 13, color: '#4e5969', marginTop: 2 }}>{item.content}</div>
                  ) : null}
                  <div style={{ fontSize: 12, color: '#86909c', marginTop: 4 }}>{item.createdAt}</div>
                </div>
                <Space>
                  <Tag color={typeMap[item.type]?.color || 'gray'}>
                    {typeMap[item.type]?.label || item.type}
                  </Tag>
                  {!item.read && <Tag color="red">未读</Tag>}
                </Space>
              </div>
            )}
          />
        )}
      </Card>
    </PageContainer>
  );
}
