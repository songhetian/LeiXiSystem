'use client';

import { useState } from 'react';
import { Message, Modal, Tag, Space, Button, Form, Input, Radio, Select } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import { PermissionGate } from '@/components/PermissionGate';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { broadcastApi, Broadcast, BroadcastCreateDto } from '@/services/broadcast';
import { systemApi, SysUser } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { useDepartments } from '@/hooks/use-departments';
import { useCachedData } from '@/hooks/use-cached-data';
import { fetchAllPages } from '@/lib/fetch-all';
import { sanitizeHtml } from '@/lib/sanitize';

interface BroadcastListEnvelope {
  code: number;
  message?: string;
  data?: { list: Broadcast[]; page: number; pageSize: number; total: number };
}

// 后端 priority 是 Int（0/1/2），不是 'normal'/'important'/'urgent'，别按字符串映射
const PRIORITY_TEXT: Record<number, string> = { 0: '普通', 1: '重要', 2: '紧急' };
const PRIORITY_COLOR: Record<number, string> = { 0: 'gray', 1: 'orange', 2: 'red' };

export default function BroadcastsPage() {
  const { can } = usePermission();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [detailVisible, setDetailVisible] = useState(false);
  const [currentBroadcast, setCurrentBroadcast] = useState<Broadcast | null>(null);

  // 新建公告
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<SysUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [createForm] = Form.useForm();
  const { departments } = useDepartments();

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

  const openCreate = async () => {
    createForm.resetFields();
    createForm.setFieldsValue({ recipientType: 'all', priority: 0 });
    setCreateVisible(true);
    if (usersLoaded) return;
    try {
      // 指定人员要全量候选：后端 pageSize 上限 100，只取首页会缺人
      const list = await fetchAllPages<SysUser>(async (page, pageSize) => {
        const res = await systemApi.listUsers({ page, pageSize });
        return { list: res.data?.list ?? [], total: res.data?.total ?? 0 };
      });
      setUsers(list);
      setUsersLoaded(true);
    } catch {
      // 无用户查看权限时「全员/指定部门」仍可发，不阻塞表单
    }
  };

  const handleCreate = async (publish: boolean) => {
    try {
      const values = await createForm.validate();
      setCreating(true);
      const payload: BroadcastCreateDto = {
        title: values.title,
        content: values.content || '',
        type: 'notice',
        priority: values.priority ?? 0,
        recipientType: values.recipientType,
      };
      if (values.recipientType === 'department') payload.recipientDepartmentIds = values.recipientDepartmentIds || [];
      if (values.recipientType === 'user') payload.recipientUserIds = values.recipientUserIds || [];

      const created = await broadcastApi.create(payload);
      if (created.code !== 0 || !created.data) {
        Message.error(created.message || '创建失败');
        return;
      }
      if (publish) {
        const pub = await broadcastApi.publish(created.data.id);
        if (pub.code !== 0) {
          Message.warning(`草稿已保存，但发布失败：${pub.message || '未知错误'}`);
          setCreateVisible(false);
          revalidate();
          return;
        }
        Message.success('公告已发布');
      } else {
        Message.success('已保存为草稿');
      }
      setCreateVisible(false);
      revalidate();
    } catch (e: any) {
      // Arco Form.validate 失败会抛 { errors }，不是业务错误，别误报「创建失败」
      if (e?.errors) return;
      Message.error('创建失败');
    } finally {
      setCreating(false);
    }
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
      render: (value: number) => (
        <Tag color={PRIORITY_COLOR[value] ?? 'gray'}>{PRIORITY_TEXT[value] ?? '普通'}</Tag>
      ),
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
    ? [{ key: 'add', label: '新建公告', type: 'primary', onClick: openCreate }]
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

      {/* 新建公告：后端 CRUD/publish 早已实现，这里补齐发布端表单 */}
      <Modal
        title="新建公告"
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        style={{ width: 640 }}
        footer={[
          <Button key="cancel" onClick={() => setCreateVisible(false)}>取消</Button>,
          <Button key="draft" onClick={() => handleCreate(false)} loading={creating}>保存草稿</Button>,
          <Button key="publish" type="primary" onClick={() => handleCreate(true)} loading={creating}>
            保存并发布
          </Button>,
        ]}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="标题" field="title" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input placeholder="请输入公告标题" maxLength={200} showWordLimit />
          </Form.Item>
          <Form.Item label="正文" field="content">
            <Input.TextArea placeholder="请输入公告内容（支持换行）" rows={6} maxLength={5000} />
          </Form.Item>
          <Form.Item label="接收范围" field="recipientType" rules={[{ required: true, message: '请选择接收范围' }]}>
            <Radio.Group>
              <Radio value="all">全员</Radio>
              <Radio value="department">指定部门</Radio>
              <Radio value="user">指定人员</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => {
              const targetType = createForm.getFieldValue('recipientType');
              if (targetType === 'department') {
                return (
                  <Form.Item
                    label="接收部门"
                    field="recipientDepartmentIds"
                    rules={[{ required: true, type: 'array', message: '请选择接收部门' }]}
                  >
                    <Select
                      mode="multiple"
                      placeholder="请选择接收部门"
                      options={departments.map((d) => ({ label: d.name, value: d.id }))}
                    />
                  </Form.Item>
                );
              }
              if (targetType === 'user') {
                return (
                  <Form.Item
                    label="接收人员"
                    field="recipientUserIds"
                    rules={[{ required: true, type: 'array', message: '请选择接收人员' }]}
                  >
                    <Select
                      mode="multiple"
                      showSearch
                      placeholder="请选择接收人员"
                      options={users.map((u) => ({ label: u.name || u.username, value: u.id }))}
                    />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>
          <Form.Item label="优先级" field="priority">
            <Radio.Group>
              <Radio value={0}>普通</Radio>
              <Radio value={1}>重要</Radio>
              <Radio value={2}>紧急</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
