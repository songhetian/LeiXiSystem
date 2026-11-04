'use client';

import { useState, useCallback } from 'react';
import {
  Message,
  Modal,
  Space,
  Button,
  Form,
  Input,
  Select,
  Popconfirm,
  Tabs,
  InputNumber,
  Table,
  type TableColumnProps,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import DataState from '@/components/DataState';
import { PermissionGate } from '@/components/PermissionGate';
import { reimbursementApi, ReimbursementType, ExpenseType } from '@/services/reimbursement';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { notifyError } from '@/lib/request';

// 报销类型状态统一走公共 StatusTag
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: '启用', color: 'success' },
  inactive: { label: '停用', color: 'danger' },
};

export default function ReimbursementSettingsPage() {
  const { can } = usePermission();
  // 操作列只在有管理权限时出现（Arco Table 的列无法用 PermissionGate 包裹）
  const canManage = can('reimbursement:manage');
  // ===== 一级报销类型（参考数据跨页共享缓存，避免切页重复请求）=====
  const fetchTypes = useCallback(
    () =>
      reimbursementApi.getAllTypes().then((res) => {
        if (res.code === 0 && res.data) return res.data;
        throw new Error(res.message || '获取报销类型失败');
      }),
    [],
  );
  const { data: list, loading, error, revalidate: revalidateTypes } = useCachedData<ReimbursementType[]>(
    'config:reimbursement:types',
    fetchTypes,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editItem, setEditItem] = useState<ReimbursementType | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // ===== 二级费用类型（参考数据跨页共享缓存）=====
  const fetchExpenseTypes = useCallback(
    () =>
      reimbursementApi.getAllExpenseTypes().then((res) => {
        if (res.code === 0 && res.data) return res.data;
        throw new Error(res.message || '获取费用类型失败');
      }),
    [],
  );
  const { data: expenseList, loading: expenseLoading, error: expenseError, revalidate: revalidateExpense } =
    useCachedData<ExpenseType[]>('config:reimbursement:expense-types', fetchExpenseTypes);
  const [expenseVisible, setExpenseVisible] = useState(false);
  const [expenseIsEdit, setExpenseIsEdit] = useState(false);
  const [expenseEditItem, setExpenseEditItem] = useState<ExpenseType | null>(null);
  const [expenseForm] = Form.useForm();
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // ===== 一级类型 CRUD =====
  const openTypeCreate = () => {
    setIsEdit(false);
    setEditItem(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active' });
    setModalVisible(true);
  };

  const openTypeEdit = (item: ReimbursementType) => {
    setIsEdit(true);
    setEditItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description,
      status: item.status,
    });
    setModalVisible(true);
  };

  const handleTypeSubmit = async () => {
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
          revalidateTypes();
        } else Message.error(res.message || '更新失败');
      } else {
        const res = await reimbursementApi.createType({
          name: values.name,
          description: values.description,
        });
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          revalidateTypes();
        } else Message.error(res.message || '创建失败');
      }
    } catch (e) {
      notifyError(e, '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeDelete = async (item: ReimbursementType) => {
    try {
      const res = await reimbursementApi.deleteType(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        revalidateTypes();
      } else Message.error(res.message || '删除失败');
    } catch (e) {
      notifyError(e, '删除失败');
    }
  };

  // ===== 二级费用类型 CRUD =====
  const openExpenseCreate = () => {
    setExpenseIsEdit(false);
    setExpenseEditItem(null);
    expenseForm.resetFields();
    expenseForm.setFieldsValue({ status: 'active', sortOrder: 0 });
    setExpenseVisible(true);
  };

  const openExpenseEdit = (item: ExpenseType) => {
    setExpenseIsEdit(true);
    setExpenseEditItem(item);
    expenseForm.setFieldsValue({
      name: item.name,
      unit: item.unit,
      sortOrder: item.sortOrder,
      status: item.status,
    });
    setExpenseVisible(true);
  };

  const handleExpenseSubmit = async () => {
    const values = await expenseForm.validate();
    setExpenseSubmitting(true);
    try {
      if (expenseIsEdit && expenseEditItem) {
        const res = await reimbursementApi.updateExpenseType(expenseEditItem.id, {
          name: values.name,
          unit: values.unit,
          sortOrder: values.sortOrder,
          status: values.status,
        });
        if (res.code === 0) {
          Message.success('更新成功');
          setExpenseVisible(false);
          revalidateExpense();
        } else Message.error(res.message || '更新失败');
      } else {
        const res = await reimbursementApi.createExpenseType({
          name: values.name,
          unit: values.unit,
          sortOrder: values.sortOrder,
        });
        if (res.code === 0) {
          Message.success('创建成功');
          setExpenseVisible(false);
          revalidateExpense();
        } else Message.error(res.message || '创建失败');
      }
    } catch (e) {
      notifyError(e, '操作失败');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleExpenseDelete = async (item: ExpenseType) => {
    try {
      const res = await reimbursementApi.deleteExpenseType(item.id);
      if (res.code === 0) {
        Message.success('删除成功');
        revalidateExpense();
      } else Message.error(res.message || '删除失败');
    } catch (e) {
      notifyError(e, '删除失败');
    }
  };

  const typeColumns: TableColumnProps<ReimbursementType>[] = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: '编码', dataIndex: 'code', width: 140 },
    { title: '名称', dataIndex: 'name' },
    { title: '说明', dataIndex: 'description', render: (value) => value || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value) => <StatusTag status={value} statusMap={STATUS_MAP} />,
    },
    ...(canManage
      ? [
          {
            title: '操作',
            width: 140,
            align: 'right' as const,
            render: (_: unknown, item: ReimbursementType) => (
              <Space>
                <Button size="mini" onClick={() => openTypeEdit(item)}>
                  编辑
                </Button>
                <Popconfirm title="确定删除吗？" onOk={() => handleTypeDelete(item)}>
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

  const expenseColumns: TableColumnProps<ExpenseType>[] = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: '名称', dataIndex: 'name' },
    { title: '单位', dataIndex: 'unit', width: 96, render: (value) => value || '-' },
    { title: '排序', dataIndex: 'sortOrder', width: 88 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (value) => <StatusTag status={value} statusMap={STATUS_MAP} />,
    },
    ...(canManage
      ? [
          {
            title: '操作',
            width: 140,
            align: 'right' as const,
            render: (_: unknown, item: ExpenseType) => (
              <Space>
                <Button size="mini" onClick={() => openExpenseEdit(item)}>
                  编辑
                </Button>
                <Popconfirm title="确定删除吗？" onOk={() => handleExpenseDelete(item)}>
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
      <Tabs defaultActiveTab="type">
        <Tabs.TabPane key="type" title="报销类型">
          <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
            <div className="mb-4 flex justify-between">
              <span className="font-medium text-text-1">报销类型</span>
              <PermissionGate code="reimbursement:manage">
                <Button type="primary" size="small" onClick={openTypeCreate}>
                  新增类型
                </Button>
              </PermissionGate>
            </div>
            <DataState loading={loading} error={error} onRetry={revalidateTypes} isEmpty={!list || list.length === 0}>
              <Table
                rowKey="id"
                size="small"
                border={false}
                pagination={false}
                columns={typeColumns}
                data={list || []}
              />
            </DataState>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane key="expenseType" title="费用类型（二级）">
          <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
            <div className="mb-4 flex justify-between">
              <span className="font-medium text-text-1">
                二级费用类型
                <span className="ml-2 text-xs text-text-3">用于填写报销明细时的费用条目，如「市内交通费 / 招待餐费」</span>
              </span>
              <PermissionGate code="reimbursement:manage">
                <Button type="primary" size="small" onClick={openExpenseCreate}>
                  新增费用类型
                </Button>
              </PermissionGate>
            </div>
            <DataState loading={expenseLoading} error={expenseError} onRetry={revalidateExpense} isEmpty={!expenseList || expenseList.length === 0}>
              <Table
                rowKey="id"
                size="small"
                border={false}
                pagination={false}
                columns={expenseColumns}
                data={expenseList || []}
              />
            </DataState>
          </div>
        </Tabs.TabPane>
      </Tabs>

      {/* 一级类型弹窗 */}
      <Modal
        title={isEdit ? '编辑报销类型' : '新增报销类型'}
        visible={modalVisible}
        onOk={handleTypeSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
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

      {/* 二级费用类型弹窗 */}
      <Modal
        title={expenseIsEdit ? '编辑费用类型' : '新增费用类型'}
        visible={expenseVisible}
        onOk={handleExpenseSubmit}
        onCancel={() => setExpenseVisible(false)}
        confirmLoading={expenseSubmitting}
        okText="确定"
        cancelText="取消"
      >
        <Form form={expenseForm} layout="vertical">
          <Form.Item label="名称" field="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：市内交通费" />
          </Form.Item>
          <Form.Item label="单位" field="unit">
            <Input placeholder="如：次 / 份 / 天" />
          </Form.Item>
          <Form.Item label="排序" field="sortOrder">
            <InputNumber min={0} max={9999} style={{ width: '100%' }} placeholder="数值越小越靠前" />
          </Form.Item>
          {expenseIsEdit && (
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