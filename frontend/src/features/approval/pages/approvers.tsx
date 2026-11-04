'use client';

import { useState } from 'react';
import {
  Message,
  Modal,
  Space,
  Button,
  Form,
  Input,
  Select,
  Popconfirm,
  Tag,
  Table,
  type TableColumnProps,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import StatusTag from '@/components/StatusTag';
import { PermissionGate } from '@/components/PermissionGate';
import { approvalApi, ApprovalGroup } from '@/services/approval';
import { systemApi, SysUser } from '@/services/system';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { notifyError } from '@/lib/request';
import { fetchAllPages } from '@/lib/fetch-all';

const GROUPS_KEY = 'config:approval:groups';
const USERS_KEY = 'config:system:users-approvers';

// 审批组启用状态（StatusTag 色值规范：green→success、red→danger；status 为 1/0 数字）
const groupStatusMap: Record<string, { label: string; color: string }> = {
  '1': { label: '启用', color: 'success' },
  '0': { label: '停用', color: 'danger' },
};

// 审批人管理：复用后端 /approval/groups 审批组接口，参考 ApproverManagement 组织审批组与成员
export default function ApproverManagementPage() {
  const { can } = usePermission();
  // 操作列只在有管理权限时出现（Arco Table 的列无法用 PermissionGate 包裹）
  const canManage = can('approval:manage');
  // 审批组与用户都用于下拉/表格全量展示（表格 pagination={false}），
  // 后端 pageSize 上限 100，只取第一页会导致第 101 个之后的人/组选不到、看不到
  const { data: list, loading, error, revalidate: revalidateGroups } = useCachedData<ApprovalGroup[]>(
    GROUPS_KEY,
    () =>
      fetchAllPages<ApprovalGroup>(async (page, pageSize) => {
        const res = await approvalApi.listGroups({ page, pageSize });
        if (res.code !== 0 || !res.data) throw new Error(res.message || '获取审批人列表失败');
        return { list: res.data.list, total: res.data.total };
      }),
  );

  const { data: users } = useCachedData<SysUser[]>(
    USERS_KEY,
    () =>
      fetchAllPages<SysUser>(async (page, pageSize) => {
        const res = await systemApi.listUsers({ page, pageSize });
        if (res.code !== 0 || !res.data) throw new Error(res.message || '获取用户列表失败');
        return { list: res.data.list, total: res.data.total };
      }),
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<ApprovalGroup | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEdit = (item: ApprovalGroup) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({
      name: item.name,
      code: item.code,
      description: item.description,
      memberIds: (item.members || []).map((m) => m.userId),
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        const res = await approvalApi.updateGroup(editItem.id, {
          name: values.name,
          description: values.description,
          memberIds: values.memberIds || [],
        });
        if (res.code === 0) {
          Message.success('更新成功');
          setModalVisible(false);
          await revalidateGroups();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await approvalApi.createGroup({
          name: values.name,
          description: values.description,
          memberIds: values.memberIds || [],
        });
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          await revalidateGroups();
        } else {
          Message.error(res.message || '创建失败');
        }
      }
    } catch (e) {
      notifyError(e, '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: ApprovalGroup) => {
    try {
      const res = await approvalApi.deleteGroup(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        await revalidateGroups();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      notifyError(e, '删除失败');
    }
  };

  const userNameById = (id: number) => (users || []).find((u) => u.id === id)?.name || `#${id}`;

  const columns: TableColumnProps<ApprovalGroup>[] = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: '编码', dataIndex: 'code', width: 140 },
    { title: '组名', dataIndex: 'name' },
    {
      title: '成员',
      render: (_: unknown, item: ApprovalGroup) =>
        (item.members || []).length === 0 ? (
          <span className="text-text-3">-</span>
        ) : (
          <Space wrap>
            {(item.members || []).map((m) => (
              <Tag key={m.id} color="arcoblue">
                {userNameById(m.userId)}
              </Tag>
            ))}
          </Space>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value) => <StatusTag status={String(value)} statusMap={groupStatusMap} />,
    },
    ...(canManage
      ? [
          {
            title: '操作',
            width: 140,
            align: 'right' as const,
            render: (_: unknown, item: ApprovalGroup) => (
              <Space>
                <Button size="mini" onClick={() => openEdit(item)}>
                  编辑
                </Button>
                <Popconfirm title="确定删除吗？" onOk={() => handleDelete(item)}>
                  <Button size="mini" status="danger">
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <PageContainer>
      <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
        <div className="mb-4 flex justify-between">
          <span className="font-medium text-text-1">审批组</span>
          <PermissionGate code="approval:manage">
            <Button type="primary" size="small" onClick={openCreate}>
              新增审批组
            </Button>
          </PermissionGate>
        </div>
        <DataState loading={loading} error={error} onRetry={revalidateGroups} isEmpty={!list || list.length === 0}>
          <Table
            rowKey="id"
            size="small"
            border={false}
            pagination={false}
            columns={columns}
            data={list || []}
          />
        </DataState>
      </div>

      <Modal
        title={isEdit ? '编辑审批组' : '新增审批组'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="组名" field="name" rules={[{ required: true, message: '请输入组名' }]}>
            <Input placeholder="请输入审批组名称" />
          </Form.Item>
          <Form.Item label="说明" field="description">
            <Input.TextArea placeholder="请输入说明" autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="成员" field="memberIds">
            <Select
              mode="multiple"
              placeholder="选择审批组成员"
              allowClear
              showSearch
              options={(users || []).map((u) => ({ label: `${u.name}（${u.username}）`, value: u.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}