'use client';

import { useState } from 'react';
import { Message, Modal, Button, Select, Input, InputNumber, Form, Table, Space, Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { financeApi, ExpenseStandard, ExpenseStandardCreateDto, ExpenseStandardUpdateDto } from '@/services/finance';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { exportToExcel } from '@/lib/excel';
import { todayStr } from '@/lib/format';

/** 常用费用类别选项 */
const EXPENSE_CATEGORIES = ['差旅', '办公', '通讯', '招待', '交通', '住宿', '其他'];

/** 状态中文映射 */
const STATUS_MAP: Record<string, { text: string; color: string }> = {
  enabled: { text: '启用', color: 'green' },
  disabled: { text: '停用', color: 'gray' },
};

export default function ExpenseStandardsPage() {
  const { can } = usePermission();
  const canManage = can('finance:expense-standard:manage');

  // 筛选条件
  const [filters, setFilters] = useState<{ category: string; status: string; keyword: string }>({
    category: '',
    status: '',
    keyword: '',
  });

  // 新建 / 编辑弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingStandard, setEditingStandard] = useState<ExpenseStandard | null>(null);
  const [form] = Form.useForm();

  // SWR 缓存：筛选条件编入 cacheKey，同参数复用缓存
  const {
    data: resData,
    loading,
    error,
    revalidate,
  } = useCachedData<ExpenseStandard[]>(
    `finance:expense-standards:${filters.category}:${filters.status}:${filters.keyword}`,
    async () => {
      const params: Record<string, any> = {};
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      if (filters.keyword) params.keyword = filters.keyword;
      const res = await financeApi.listExpenseStandards(params);
      // ListResult<T>.data 类型为 {list,total,page,pageSize}，不再做数组兜底
      let list: ExpenseStandard[] = res.code === 0 ? res.data?.list ?? [] : [];
      // 若后端未按条件过滤，则本地兜底
      if (filters.category) {
        const kw = String(filters.category).toLowerCase();
        list = list.filter((s) => String(s.category ?? '').toLowerCase().includes(kw));
      }
      if (filters.status) list = list.filter((s) => s.status === filters.status);
      if (filters.keyword) {
        const kw = String(filters.keyword).toLowerCase();
        list = list.filter((s) => s.name.toLowerCase().includes(kw));
      }
      return list;
    },
    { staleTime: 30_000 },
  );
  const data = resData ?? [];

  const handleFilterChange = (key: 'category' | 'status' | 'keyword', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({ category: '', status: '', keyword: '' });
  };

  const handleAdd = () => {
    if (!canManage) return;
    setEditingStandard(null);
    setModalVisible(true);
  };

  const openModal = (mode: 'add' | 'edit') => {
    if (mode === 'edit' && editingStandard) {
      form.setFieldsValue({
        name: editingStandard.name,
        category: editingStandard.category || '',
        amount: editingStandard.amount,
        unit: editingStandard.unit || '',
        description: editingStandard.description || '',
      });
    } else {
      form.resetFields();
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingStandard(null);
    form.resetFields();
  };

  const handleModalOk = async (values: any) => {
    setModalLoading(true);
    try {
      if (editingStandard) {
        const dto: ExpenseStandardUpdateDto = {
          name: values.name,
          category: values.category || '',
          amount: Number(values.amount) || 0,
          unit: values.unit || '',
          description: values.description || '',
        };
        const res = await financeApi.updateExpenseStandard(editingStandard.id, dto);
        if (res.code === 0) {
          Message.success('修改成功');
          setModalVisible(false);
          form.resetFields();
          revalidate();
        } else {
          Message.error(res.message || '操作失败');
        }
      } else {
        const dto: ExpenseStandardCreateDto = {
          name: values.name,
          category: values.category || '',
          amount: Number(values.amount) || 0,
          unit: values.unit || '',
          description: values.description || '',
        };
        const res = await financeApi.createExpenseStandard(dto);
        if (res.code === 0) {
          Message.success('创建成功');
          setModalVisible(false);
          form.resetFields();
          revalidate();
        } else {
          Message.error(res.message || '操作失败');
        }
      }
    } catch {
      Message.error('操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      handleModalOk(values);
    } catch {
      // 校验不通过，交由表单展示错误
    }
  };

  // 启停切换
  const handleToggle = (record: ExpenseStandard) => {
    if (!canManage) return;
    const toEnable = record.status === 'disabled';
    Modal.confirm({
      title: toEnable ? '确认启用' : '确认停用',
      content: `确定要${toEnable ? '启用' : '停用'}费用标准「${record.name}」吗？`,
      onOk: async () => {
        try {
          const res = await financeApi.toggleExpenseStandard(record.id);
          if (res.code === 0) {
            Message.success(toEnable ? '已启用' : '已停用');
            revalidate();
          } else {
            Message.error(res.message || '操作失败');
          }
        } catch {
          Message.error('操作失败');
        }
      },
    });
  };

  const handleDelete = (record: ExpenseStandard) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除费用标准「${record.name}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await financeApi.deleteExpenseStandard(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            revalidate();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch {
          Message.error('删除失败');
        }
      },
    });
  };

  // 导出当前（筛选后的）费用标准数据
  const handleExport = () => {
    if (!exportToExcel(
      `费用标准_${todayStr()}.xlsx`,
      '费用标准',
      [
        { title: '名称', dataIndex: 'name' },
        { title: '类别', dataIndex: 'category' },
        { title: '金额', dataIndex: 'amount' },
        { title: '单位', dataIndex: 'unit' },
        { title: '描述', dataIndex: 'description' },
        {
          title: '状态',
          value: (s: ExpenseStandard) => STATUS_MAP[s.status]?.text ?? s.status,
        },
      ],
      data,
    )) {
      Message.info('当前没有可导出的费用标准数据');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', width: 180 },
    { title: '类别', dataIndex: 'category', width: 120, render: (v: string) => v || '--' },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      render: (v: number) => `¥ ${Number(v ?? 0).toLocaleString('zh-CN')}`,
    },
    { title: '单位', dataIndex: 'unit', width: 130, render: (v: string) => v || '--' },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: (v: string) => v || '--' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const info = STATUS_MAP[v] || { text: v, color: 'gray' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '操作',
      width: 190,
      render: (_: any, record: ExpenseStandard) => (
        <Space>
          <Button size="mini" type="text" disabled={!canManage} onClick={() => { setEditingStandard(record); openModal('edit'); }}>编辑</Button>
          <Button size="mini" type="text" disabled={!canManage} onClick={() => handleToggle(record)}>
            {record.status === 'disabled' ? '启用' : '停用'}
          </Button>
          <Button size="mini" type="text" status="danger" disabled={!canManage} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer >
      {/* 筛选栏 */}
      <div className="bg-surface border border-border-1 rounded-md p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-text-2 mb-1.5">类别</label>
            <Select
              value={filters.category || undefined}
              onChange={(v) => handleFilterChange('category', String(v ?? ''))}
              style={{ width: '100%' }}
              placeholder="全部类别"
              allowClear
              allowCreate
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">状态</label>
            <Select
              value={filters.status || undefined}
              onChange={(v) => handleFilterChange('status', String(v ?? ''))}
              style={{ width: '100%' }}
              placeholder="全部状态"
              allowClear
            >
              <Select.Option value="enabled">启用</Select.Option>
              <Select.Option value="disabled">停用</Select.Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">搜索</label>
            <Input
              value={filters.keyword}
              onChange={(v) => handleFilterChange('keyword', v)}
              placeholder="费用标准名称"
              allowClear
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleReset}>重置筛选</Button>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-2">共 {data.length} 条费用标准</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" disabled={!canManage} onClick={handleAdd}>+ 新建费用标准</Button>
        </div>
      </div>

      {/* 费用标准表格 */}
      <div className="bg-surface border border-border-1 rounded-md">
        {error ? (
          <div className="text-center py-16">
            <p className="text-text-3 mb-3">{error}</p>
          </div>
        ) : (
          <Table
            rowKey="id"
            loading={loading}
            data={data}
            columns={columns}
            scroll={{ x: true }}
            pagination={{ pageSize: 10, showTotal: true }}
            noDataElement={<div className="py-16 text-text-3">暂无费用标准数据</div>}
          />
        )}
      </div>

      {/* 新建 / 编辑弹窗 */}
      <Modal
        title={editingStandard ? '编辑费用标准' : '新建费用标准'}
        visible={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSubmit}
        confirmLoading={modalLoading}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="名称"
            field="name"
            rules={[{ required: true, message: '请输入标准名称' }]}
          >
            <Input placeholder="请输入费用标准名称" />
          </Form.Item>
          <Form.Item
            label="类别"
            field="category"
            rules={[{ required: true, message: '请输入费用类别' }]}
          >
            <Select allowCreate placeholder="选择或输入费用类别">
              {EXPENSE_CATEGORIES.map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="标准金额"
            field="amount"
            rules={[{ required: true, message: '请输入标准金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入标准金额"
              min={0}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
          <Form.Item label="单位" field="unit" extra="如：元/天、元/次、元/公里">
            <Input placeholder="请输入计量单位（可选）" />
          </Form.Item>
          <Form.Item label="描述" field="description">
            <Input.TextArea placeholder="请输入描述（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}