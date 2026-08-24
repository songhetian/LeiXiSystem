'use client';

import { useState, useEffect } from 'react';
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
import { reimbursementApi, ReimbursementType } from '@/services/reimbursement';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';
import { notifyError } from '@/lib/request';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '启用', color: 'green' },
  inactive: { label: '停用', color: 'red' },
};

export default function ReimbursementSettingsPage() {
  const { can } = usePermission();
  const { data: list, loading, error, run: runFetch } = useFetchState<ReimbursementType[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<ReimbursementType | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    await runFetch(async () => {
      const res = await reimbursementApi.getAllTypes();
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取报销类型失败');
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active' });
    setModalVisible(true);
  };

  const openEdit = (item: ReimbursementType) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description,
      status: item.status,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validate();
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        const res = await reimbursementApi.updateType(editItem.id, {
          name: values.name,
          description: values.description,
          status: values.status,
        });
        if (res.code === 0) {
          Message.success('更新成功');
          setModalVisible(false);
          fetchData();
        } else {
          Message.error(res.message || '更新失败');
        }
      } else {
        const res = await reimbursementApi.createType({
          code: values.code,
          name: values.name,
          description: values.description,
        });
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          fetchData();
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

  const handleDelete = async (item: ReimbursementType) => {
    try {
      const res = await reimbursementApi.deleteType(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        fetchData();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      notifyError(e, '删除失败');
    }
  };

  return (
    <PageContainer title="报销配置" subTitle="管理报销类型与启用状态">
      <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
        <div className="mb-4 flex justify-between">
          <span className="font-medium text-text-1">报销类型</span>
          {can('reimbursement:manage') && (
            <Button type="primary" size="small" onClick={openCreate}>
              新增类型
            </Button>
          )}
        </div>
        <DataState loading={loading} error={error} onRetry={fetchData} isEmpty={!list || list.length === 0}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-2">
                <th className="text-left py-2.5 px-3">ID</th>
                <th className="text-left py-2.5 px-3">编码</th>
                <th className="text-left py-2.5 px-3">名称</th>
                <th className="text-left py-2.5 px-3">说明</th>
                <th className="text-left py-2.5 px-3">状态</th>
                {can('reimbursement:manage') && (
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
                  <td className="py-2.5 px-3">{item.description || '-'}</td>
                  <td className="py-2.5 px-3">
                    <Tag color={STATUS_MAP[item.status]?.color || 'gray'}>
                      {STATUS_MAP[item.status]?.label || item.status}
                    </Tag>
                  </td>
                  {can('reimbursement:manage') && (
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
        title={isEdit ? '编辑报销类型' : '新增报销类型'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          {!isEdit && (
            <Form.Item label="编码" field="code" rules={[{ required: true, message: '请输入编码' }]}>
              <Input placeholder="英文唯一标识，如 travel" />
            </Form.Item>
          )}
          <Form.Item label="名称" field="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="请输入报销类型名称" />
          </Form.Item>
          <Form.Item label="说明" field="description">
            <Input.TextArea placeholder="请输入说明" autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
          {isEdit && (
            <Form.Item label="状态" field="status">
              <Select>
                <Select.Option value="active">启用</Select.Option>
                <Select.Option value="inactive">停用</Select.Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </PageContainer>
  );
}