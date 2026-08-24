'use client';

import { useState, useEffect } from 'react';
import { Message, Tag, Space, Badge, Button, Modal } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { broadcastApi, Broadcast } from '@/services/broadcast';
import { sanitizeHtml } from '@/lib/sanitize';

// 批次七 · 公告公开查看页（对齐参考 BroadcastList 查看视图，与 BroadcastManagement 发布端分离）
const priorityText: Record<string, string> = { normal: '普通', important: '重要', urgent: '紧急' };
const recipientText: Record<string, string> = { all: '全员', department: '指定部门', user: '指定人员' };

export default function AnnouncementsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Broadcast[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [unread, setUnread] = useState(0);

  const [detailVisible, setDetailVisible] = useState(false);
  const [current, setCurrent] = useState<Broadcast | null>(null);

  const fetchList = async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, countRes] = await Promise.all([
        broadcastApi.getPublicList({ page, pageSize }),
        broadcastApi.getPublicUnreadCount(),
      ]);
      if (listRes.code === 0 && listRes.data) {
        setData(listRes.data.list);
        setPagination({
          current: listRes.data.page,
          pageSize: listRes.data.pageSize,
          total: listRes.data.total,
        });
      } else {
        setError(listRes.message || '获取公告失败');
      }
      if (countRes.code === 0 && countRes.data) setUnread(countRes.data.count);
    } catch (e: any) {
      setError(e?.message || '获取公告失败');
      notifyError(e, '获取公告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1, 20);
  }, []);

  const handleViewDetail = async (record: Broadcast) => {
    try {
      const res = await broadcastApi.getPublicDetail(record.id);
      if (res.code === 0 && res.data) {
        setCurrent(res.data);
        setDetailVisible(true);
        // 标记已读
        await broadcastApi.markBroadcastRead(record.id).catch(() => {});
        if (!record.read) fetchList(pagination.current, pagination.pageSize);
      } else {
        Message.error(res.message || '获取公告详情失败');
      }
    } catch (e) {
      Message.error('获取公告详情失败');
    }
  };

  const columns: ProTableColumn[] = [
    {
      title: '标题',
      dataIndex: 'title',
      width: 320,
      render: (value: string, record: Broadcast) => (
        <Space>
          {!record.read && <Badge status="processing" />}
          <span>{value}</span>
        </Space>
      ),
    },
    {
      title: '接收范围',
      dataIndex: 'recipientType',
      width: 120,
      render: (value: string) => recipientText[value] || value,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (value: string | number) => {
        const key = String(value);
        return <Tag color={key === 'urgent' ? 'red' : key === 'important' ? 'orange' : undefined}>{priorityText[key] || value}</Tag>;
      },
    },
    { title: '发布时间', dataIndex: 'publishedAt', width: 180 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_: any, record: Broadcast) => (
        <Button size="small" type="text" onClick={() => handleViewDetail(record)}>查看</Button>
      ),
    },
  ];

  return (
    <PageContainer title="公告">
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => fetchList(pagination.current, pagination.pageSize)}
        pagination={pagination}
        onPageChange={(p, ps) => fetchList(p, ps)}
      />

      <Modal
        title="公告详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
      >
        {current && (
          <div>
            <h3 style={{ marginBottom: 12 }}>{current.title}</h3>
            <Space style={{ marginBottom: 16 }}>
              <Tag>{recipientText[current.recipientType] || current.recipientType}</Tag>
              <Tag color={String(current.priority) === 'urgent' ? 'red' : undefined}>
                {priorityText[String(current.priority)] || current.priority}
              </Tag>
            </Space>
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(current.content) }}
              style={{ lineHeight: 1.8 }}
            />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}