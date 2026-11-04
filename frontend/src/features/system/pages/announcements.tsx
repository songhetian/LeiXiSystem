'use client';

import { useState } from 'react';
import { Message, Tag, Space, Badge, Button, Modal } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { broadcastApi, Broadcast } from '@/services/broadcast';
import { useCachedData } from '@/hooks/use-cached-data';
import { sanitizeHtml } from '@/lib/sanitize';

// 批次七 · 公告公开查看页（对齐参考 BroadcastList 查看视图，与 BroadcastManagement 发布端分离）
const priorityText: Record<string, string> = { normal: '普通', important: '重要', urgent: '紧急' };
const recipientText: Record<string, string> = { all: '全员', department: '指定部门', user: '指定人员' };

// 优先级属于状态语义，统一走公共 StatusTag（urgent→danger、important→warning、其余 default）
const PRIORITY_COLOR: Record<string, string> = { urgent: 'danger', important: 'warning' };
function PriorityStatusTag({ priority }: { priority: string | number }) {
  const key = String(priority);
  return <StatusTag status={key} statusMap={{ [key]: { label: priorityText[key] || key, color: PRIORITY_COLOR[key] || 'default' } }} />;
}

interface AnnouncementListEnvelope {
  code: number;
  message?: string;
  data?: { list: Broadcast[]; page: number; pageSize: number; total: number };
}

export default function AnnouncementsPage() {
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const [detailVisible, setDetailVisible] = useState(false);
  const [current, setCurrent] = useState<Broadcast | null>(null);

  // SWR 缓存：列表参数化 cacheKey，翻页即重新订阅
  const cacheKey = `system:announcements:${pagination.current}:${pagination.pageSize}`;
  const { data: listRes, loading, error, revalidate } = useCachedData<AnnouncementListEnvelope>(
    cacheKey,
    () => broadcastApi.getPublicList({ page: pagination.current, pageSize: pagination.pageSize }),
    { staleTime: 30_000 },
  );
  const data = listRes?.code === 0 && listRes.data ? listRes.data.list : [];
  const pageResult = listRes?.code === 0 && listRes.data
    ? { current: listRes.data.page, pageSize: listRes.data.pageSize, total: listRes.data.total }
    : pagination;

  const handleViewDetail = async (record: Broadcast) => {
    try {
      const res = await broadcastApi.getPublicDetail(record.id);
      if (res.code === 0 && res.data) {
        setCurrent(res.data);
        setDetailVisible(true);
        // 标记已读
        await broadcastApi.markBroadcastRead(record.id).catch(() => {});
        if (!record.read) revalidate();
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
      render: (value: string | number) => <PriorityStatusTag priority={value} />,
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
    <PageContainer >
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        pagination={pageResult}
        onPageChange={(p, ps) => setPagination({ ...pageResult, current: p, pageSize: ps })}
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
              <PriorityStatusTag priority={current.priority} />
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