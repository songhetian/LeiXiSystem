'use client';

import { useState } from 'react';
import { Message, Modal, Tag, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import { PermissionGate } from '@/components/PermissionGate';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { broadcastApi, Broadcast, BroadcastCreateDto } from '@/services/broadcast';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { sanitizeHtml } from '@/lib/sanitize';

interface BroadcastListEnvelope {
  code: number;
  message?: string;
  data?: { list: Broadcast[]; page: number; pageSize: number; total: number };
}

export default function BroadcastsPage() {
  const { can } = usePermission();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);

  // SWR 缓存：参数编入 cacheKey，翻页/搜索即重新订阅；同参数复用缓存
  const cacheKey = `system:broadcasts:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<BroadcastListEnvelope>(
    cacheKey,
    () => broadcastApi.getList({ page: pagination.current, pageSize: pagination.pageSize, ...searchParams }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ ...pageResult, current: page, pageSize });
  };

  const handleViewDetail = async (record: Broadcast) => {
    try {
      const res = await broadcastApi.getDetail(record.id);
      if (res.code === 0 && res.data) {
        setCurrentBroadcast(res.data);
        setDetailVisible(true);
      } else {
        Message.error(res.message || '获取公告详情失败');
      }
    } catch (e) {
      Message.error('获取公告详情失败');
    }
  };

  const handlePublish = (record: Broadcast) => {
    Modal.confirm({
      title: '确认发布',
      content: `确定要发布公告「${record.title}」吗？发布后不可修改。`,
      onOk: async () => {
        try {
          const res = await broadcastApi.publish(record.id);
          if (res.code === 0) {
            Message.success('发布成功');
            revalidate();
          } else {
            Message.error(res.message || '发布失败');
          }
        } catch (e) {
          Message.error('发布失败');
        }
      },
    });
  };

  const handleDelete = (record: Broadcast) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除公告「${record.title}」吗？`,
      onOk: async () => {
        try {
          const res = await broadcastApi.remove(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            revalidate();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch (e) {
          Message.error('删除失败');
        }
      },
    });
  };

  const handleDetailCancel = () => {
    setDetailVisible(false);
    setCurrentBroadcast(null);
  };

  // 广播状态统一走公共 StatusTag
  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      draft: { color: 'default', text: '草稿' },
      published: { color: 'success', text: '已发布' },
      archived: { color: 'warning', text: '已归档' },
    };
    const info = map[status] || { color: 'default', text: status };
    return <StatusTag status={status} statusMap={{ [status]: { label: info.text, color: info.color } }} />;
  };

  const getRecipientTypeText = (type: string) => {
    const map: Record<string, string> = {
      all: '全员',
      department: '指定部门',
      user: '指定人员',
    };
    return map[type] || type;
  };

  const searchFields: SearchFieldConfig[] = [
    { key: 'keyword', label: '关键词', type: 'input', placeholder: '请输入关键词' },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      placeholder: '全部状态',
      options: [
        { value: 'draft', label: '草稿' },
        { value: 'published', label: '已发布' },
        { value: 'archived', label: '已归档' },
      ],
    },
  ];

  const columns: ProTableColumn[] = [
    { title: '标题', dataIndex: 'title', width: 240 },
    {
      title: '接收范围',
      dataIndex: 'recipientType',
      width: 120,
      render: (value: string) => getRecipientTypeText(value),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (value: string) => {
        const map: Record<string, string> = { normal: '普通', important: '重要', urgent: '紧急' };
        return <Tag>{map[value] || value}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => getStatusTag(value),
    },
    { title: '发布时间', dataIndex: 'publishedAt', width: 180 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      render: (_: any, record: Broadcast) => (
        <Space>
          {/* 「查看」不属管理写操作，始终渲染 */}
          <Button size="small" type="text" onClick={() => handleViewDetail(record)}>查看</Button>
          {/* 按钮级权限：无 system:broadcast:manage 时发布/删除不渲染 */}
          <PermissionGate code="system:broadcast:manage">
            {record.status === 'draft' && (
              <Button size="small" type="text" onClick={() => handlePublish(record)}>发布</Button>
            )}
            <Button size="small" type="text" status="danger" onClick={() => handleDelete(record)}>删除</Button>
          </PermissionGate>
        </Space>
      ),
    },
  ];

  // 工具栏为配置数组，无权限时返回空数组让「新建公告」整体不渲染
  const toolbar: ProTableToolbarAction[] = can('system:broadcast:manage')
    ? [{ key: 'add', label: '新建公告', type: 'primary', onClick: () => Message.info('新建公告功能开发中') }]
    : [];

  return (
    <PageContainer >
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pageResult}
        onPageChange={handlePageChange}
      />
      <Modal
        title="公告详情"
        visible={detailVisible}
        onCancel={handleDetailCancel}
        footer={null}
        style={{ width: 680 }}
      >
        {currentBroadcast && (
          <div>
            <h3 style={{ marginBottom: 12 }}>{currentBroadcast.title}</h3>
            <Space style={{ marginBottom: 16 }}>
              {getStatusTag(currentBroadcast.status)}
              <Tag>{getRecipientTypeText(currentBroadcast.recipientType)}</Tag>
            </Space>
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentBroadcast.content) }}
              style={{ lineHeight: 1.8 }}
            />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
