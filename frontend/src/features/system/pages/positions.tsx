'use client';

import { useState, useEffect } from 'react';
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
import DataState from '@/components/DataState';
import { systemApi, SysPosition } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

// 岗位列表：被「组织架构」页的岗位 Tab 与独立「岗位管理」页复用，
// 避免重复组件（新标准：一份实现，多处引用）
export function PositionList() {
  const { data: list, loading, error, run: runFetch, setData: setList } = useFetchState<SysPosition[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<SysPosition | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { can } = usePermission();

  const fetchData = async () => {
    await runFetch(async () => {
      const res = await systemApi.listPositions();
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取岗位列表失败');
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

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
          fetchData();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await systemApi.createPosition(values);
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          fetchData();
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
        fetchData();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      Message.error('删除失败');
    }
  };

  return (
    <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
      <div className="mb-4 flex justify-between">
        <span className="font-medium text-text-1">岗位列表</span>
        {can('position:manage') && (
          <Button type="primary" size="small" onClick={openCreate}>
            新增岗位
          </Button>
        )}
      </div>
      <DataState loading={loading} error={error} onRetry={fetchData} isEmpty={!list || list.length === 0}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-2">
              <th className="text-left py-2.5 px-3">ID</th>
              <th className="text-left py-2.5 px-3">岗位名称</th>
              {can('position:manage') && (
                <th className="text-right py-2.5 px-3">操作</th>
              )}
            </tr>
          </thead>
          <tbody>
            {(list || []).map((item) => (
              <tr key={item.id} className="border-b border-border-2">
                <td className="py-2.5 px-3">{item.id}</td>
                <td className="py-2.5 px-3">{item.name}</td>
                {can('position:manage') && (
                  <td className="py-2.5 px-3 text-right">
                    <Space>
                      <Button size="mini" onClick={() => openEdit(item)}>
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定删除吗？"
                        onOk={() => handleDelete(item)}
                      >
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
    </div>
  );
}

export default function SystemPositionsPage() {
  return (
    <PageContainer title="岗位管理">
      <PositionList />
    </PageContainer>
  );
}