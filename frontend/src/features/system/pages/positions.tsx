'use client';

import { useState } from 'react';
import {
  Message,
  Modal,
  Space,
  Button,
  Form,
  Input,
  Popconfirm,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable from '@/components/ProTable';
import { PermissionGate } from '@/components/PermissionGate';
import { systemApi, SysPosition } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';

// 岗位列表：被「组织架构」页的岗位 Tab 与独立「岗位管理」页复用，
// 避免重复组件（新标准：一份实现，多处引用）
export function PositionList() {
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<SysPosition | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { can } = usePermission();

  // 列表数据统一走 useCachedData（SWR 共享缓存，跨页签去重）；增删改成功后 revalidate()
  const { data: list, loading, error, revalidate } = useCachedData<SysPosition[]>(
    'system:positions',
    async () => {
      const res = await systemApi.listPositions();
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取岗位列表失败');
    },
  );

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEdit = (item: SysPosition) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({ name: item.name });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        const res = await systemApi.updatePosition(editItem.id, values);
        if (res.code === 0) {
          Message.success('更新成功');
          setModalVisible(false);
          void revalidate();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await systemApi.createPosition(values);
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          void revalidate();
        } else {
          Message.error(res.message || '创建失败');
        }
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: SysPosition) => {
    try {
      const res = await systemApi.deletePosition(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        void revalidate();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      Message.error('删除失败');
    }
  };

  const canManage = can('position:manage');

  const columns = [
    { title: '岗位名称', dataIndex: 'name' },
    {
      title: '操作',
      dataIndex: 'op',
      width: 140,
      render: (_: unknown, item: SysPosition) => (
        // 按钮级权限：无 position:manage 时编辑/删除整组不渲染
        <PermissionGate code="position:manage">
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
        </PermissionGate>
      ),
    },
  ];

  return (
    <>
      <ProTable
        columns={columns}
        data={list || []}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => {
          void revalidate();
        }}
        pagination={false}
        toolbar={canManage ? [{ key: 'create', label: '新增岗位', onClick: openCreate }] : []}
      />

      <Modal
        title={isEdit ? '编辑岗位' : '新增岗位'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="岗位名称" field="name" rules={[{ required: true, message: '请输入岗位名称' }]}>
            <Input placeholder="请输入岗位名称" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default function SystemPositionsPage() {
  return (
    <PageContainer >
      <PositionList />
    </PageContainer>
  );
}
