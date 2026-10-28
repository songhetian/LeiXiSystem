'use client';

import { useState } from 'react';
import { Message, Modal, Button, Select, Input, InputNumber, Form, Space } from '@arco-design/web-react';
import StatusTag from '@/components/StatusTag';
import PageContainer from '@/components/PageContainer';
import ProTable from '@/components/ProTable';
import type { ProTableColumn } from '@/components/ProTable';
import type { SearchFieldConfig } from '@/components/SearchForm';
import { PermissionGate } from '@/components/PermissionGate';
import { financeApi, ExpenseStandard, ExpenseStandardCreateDto, ExpenseStandardUpdateDto } from '@/services/finance';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { exportToExcel } from '@/lib/excel';
import { todayStr, formatMoney } from '@/lib/format';

/** 常用费用类别选项 */
const EXPENSE_CATEGORIES = ['差旅', '办公', '通讯', '招待', '交通', '住宿', '其他'];

/** 状态中文映射（统一走公共 StatusTag） */
const STATUS_MAP: Record<string, { text: string; color: string }> = {
  enabled: { text: '启用', color: 'success' },
  disabled: { text: '停用', color: 'default' },
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
      // keyword 后端接口不支持（只有 category/status），全量拉回后本地过滤名称
      const res = await financeApi.listExpenseStandards(params);
      // 业务码非 0 视为失败，否则会显示成「暂无费用标准数据」
      if (res.code !== 0) throw new Error(res.message || '费用标准读取失败');
      const list: ExpenseStandard[] = res.data?.list ?? [];
      if (!filters.keyword) return list;
      const kw = String(filters.keyword).toLowerCase();
      return list.filter((s) => String(s.name ?? '').toLowerCase().includes(kw));
    },
    { staleTime: 30_000 },
  );
  const data = resData ?? [];

  const handleReset = () => {
    setFilters({ category: '', status: '', keyword: '' });
  };

  // ProTable 搜索区提交：字段变更即（防抖）触发过滤
  const handleSearch = (values: Record<string, any>) => {
    setFilters({
      category: values.category ? String(values.category) : '',
      status: values.status ? String(values.status) : '',
      keyword: values.keyword ? String(values.keyword) : '',
    });
  };

  const expenseSearchFields: SearchFieldConfig[] = [
    {
      key: 'category',
      label: '类别',
      type: 'select',
      placeholder: '全部类别',
      options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
    },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      placeholder: '全部状态',
      options: [
        { value: 'enabled', label: '启用' },
        { value: 'disabled', label: '停用' },
      ],
    },
    { key: 'keyword', label: '搜索', type: 'input', placeholder: '费用标准名称' },
  ];

  // 打开弹窗：编辑态直接用行数据回填（state 更新是异步的，不能先 setState 再读 state），
  // 新增态清空上一次编辑残留，避免「新建」里躺着上一条标准的旧值。
  const openModal = (mode: 'add' | 'edit', record?: ExpenseStandard) => {
    if (!canManage) return;
    if (mode === 'edit' && record) {
      setEditingStandard(record);
      form.setFieldsValue({
        name: record.name,
        category: record.category || '',
        // Decimal 出参是字符串，InputNumber 需要数字
        amount: Number(record.amount ?? 0),
        unit: record.unit || '',
        description: record.description || '',
      });
    } else {
      setEditingStandard(null);
      form.resetFields();
    }
    setModalVisible(true);
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
      okButtonProps: { status: 'danger' },
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
        // 金额导出为数值（Decimal 字符串直接导出会变成文本列，Excel 里无法求和）
        { title: '金额', value: (s: ExpenseStandard) => Number(s.amount ?? 0) },
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

  const columns: ProTableColumn[] = [
    { title: '名称', dataIndex: 'name', width: 180 },
    { title: '类别', dataIndex: 'category', width: 120, render: (v: string) => v || '--' },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      align: 'right',
      render: (v: number | string) => `¥ ${formatMoney(v ?? 0, '0.00')}`,
    },
    { title: '单位', dataIndex: 'unit', width: 130, render: (v: string) => v || '--' },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: (v: string) => v || '--' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => {
        const info = STATUS_MAP[v] || { text: v, color: 'default' };
        // 报销标准状态统一走公共 StatusTag
        return <StatusTag status={v} statusMap={{ [v]: { label: info.text, color: info.color } }} />;
      },
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 190,
      render: (_: any, record: ExpenseStandard) => (
        <PermissionGate code="finance:expense-standard:manage">
          <Space>
            <Button size="mini" type="text" onClick={() => openModal('edit', record)}>编辑</Button>
            <Button size="mini" type="text" onClick={() => handleToggle(record)}>
              {record.status === 'disabled' ? '启用' : '停用'}
            </Button>
            <Button size="mini" type="text" status="danger" onClick={() => handleDelete(record)}>删除</Button>
          </Space>
        </PermissionGate>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={expenseSearchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        searchDebounceMs={300}
        searchInlineActions
        toolbar={[
          {
            key: 'standards-add',
            label: '+ 新建费用标准',
            onClick: () => openModal('add'),
            disabled: !canManage,
          },
        ]}
        showExport
        onExport={handleExport}
        emptyElement={<span className="text-text-3">暂无费用标准数据</span>}
      />

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