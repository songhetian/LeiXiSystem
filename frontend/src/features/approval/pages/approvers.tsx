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
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { approvalApi, ApprovalGroup } from '@/services/approval';
import { systemApi, SysUser } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { notifyError } from '@/lib/request';

const GROUPS_KEY = 'config:approval:groups';
const USERS_KEY = 'config:system:users-approvers';

// 审批人管理：复用后端 /approval/groups 审批组接口，参考 ApproverManagement 组织审批组与成员
export default function ApproverManagementPage() {
  const { can } = usePermission();
  const { data: list, loading, error, revalidate: revalidateGroups } = useCachedData<ApprovalGroup[]>(
    GROUPS_KEY,
    () =>
      approvalApi.listGroups({ page: 1, pageSize: 100 }).then((res) => {
        if (res.code === 0 && res.data) {
          return res.data.list;
        }
        throw new Error(res.message || '获取审批人列表失败');
      }),
  );

  const { data: users } = useCachedData<SysUser[]>(
    USERS_KEY,
    () =>
      systemApi.listUsers({ page: 1, pageSize: 100 }).then((res) => {
        if (res.code === 0 && res.data) {
          return res.data.list;
        }
        throw new Error(res.message || '获取用户列表失败');
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

  return (
    <PageContainer>
      <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
        <div className="mb-4 flex justify-between">
          <span className="font-medium text-text-1">审批组</span>
          {can('approval:manage') && (
            <Button type="primary" size="small" onClick={openCreate}>
              新增审批组
            </Button>
          )}
        </div>
        <DataState loading={loading} error={error} onRetry={revalidateGroups} isEmpty={!list || list.length === 0}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-2">
                <th className="text-left py-2.5 px-3">ID</th>
                <th className="text-left py-2.5 px-3">编码</th>
                <th className="text-left py-2.5 px-3">组名</th>
                <th className="text-left py-2.5 px-3">成员</th>
                <th className="text-left py-2.5 px-3">状态</th>
                {can('approval:manage') && (
                  <th className="text-right py-2.5 px-3">操作</th>
                )}
              </tr>
            </thead>
            <tbody>
              {(list || []).map((item) => (
                <tr key={item.id} className="border-b border-border-2">
                  <td className="py-2.5 px-3">{item.id}</td>
                  <td className="py-2.5 px-3">{item.code}</td>
                  <td className="py-2.5 px-3">{item.name}</td>
                  <td className="py-2.5 px-3">
                    {(item.members || []).length === 0 ? (
                      <span className="text-text-3">-</span>
                    ) : (
                      <Space wrap>
                        {(item.members || []).map((m) => (
                          <Tag key={m.id} color="arcoblue">
                            {userNameById(m.userId)}
                          </Tag>
                        ))}
                      </Space>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <Tag color={item.status === 1 ? 'green' : 'red'}>
                      {item.status === 1 ? '启用' : '停用'}
                    </Tag>
                  </td>
                  {can('approval:manage') && (
                    <td className="py-2.5 px-3 text-right">
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
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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