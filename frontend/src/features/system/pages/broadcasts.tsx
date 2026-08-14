'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Tag, Space, Button } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { broadcastApi, Broadcast, BroadcastCreateDto } from '@/services/broadcast';
import { usePermission } from '@/hooks/use-permission';

export default function BroadcastsPage() {
  const { can } = usePermission();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Broadcast[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);

  const fetchList = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const res = await broadcastApi.getList({ page, pageSize, ...params });
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setPagination({
          current: res.data.page,
          pageSize: res.data.pageSize,
          total: res.data.total,
        });
      } else {
        Message.error(res.message || '获取公告列表失败');
      }
    } catch (e) {
      Message.error('获取公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(1, 20, searchParams);
  }, []);

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchList(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchList(1, pagination.pageSize, {});
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchList(page, pageSize, searchParams);
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
            fetchList(pagination.current, pagination.pageSize, searchParams);
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
            fetchList(pagination.current, pagination.pageSize, searchParams);
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

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; text: string }> = {
      draft: { color: 'gray', text: '草稿' },
      published: { color: 'green', text: '已发布' },
      archived: { color: 'orange', text: '已归档' },
    };
    const info = map[status] || { color: 'gray', text: status };
    return <Tag color={info.color}>{info.text}</Tag>;
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
          <Button size="small" type="text" onClick={() => handleViewDetail(record)}>查看</Button>
          {record.status === 'draft' && (
            <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => handlePublish(record)}>发布</Button>
          )}
          <Button size="small" type="text" status="danger" disabled={!can('system:manage')} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新建公告', type: 'primary', disabled: !can('system:manage'), onClick: () => Message.info('新建公告功能开发中') },
  ];

  return (
    <AppLayout title="公告管理" activeMenu="system">
      <PageContainer title="公告管理">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          searchFields={searchFields}
          onSearch={handleSearch}
          onReset={handleReset}
          toolbar={toolbar}
          pagination={pagination}
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
                dangerouslySetInnerHTML={{ __html: currentBroadcast.content }}
                style={{ lineHeight: 1.8 }}
              />
            </div>
          )}
        </Modal>
      </PageContainer>
    </AppLayout>
  );
}
