'use client';

import { useState } from 'react';
import { Message, Modal, Button, Select, Input, InputNumber, Form, Space } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable from '@/components/ProTable';
import type { ProTableColumn } from '@/components/ProTable';
import type { SearchFieldConfig } from '@/components/SearchForm';
import { PermissionGate } from '@/components/PermissionGate';
import { financeApi, Budget, BudgetCreateDto, BudgetUpdateDto } from '@/services/finance';
import { usePermission } from '@/hooks/use-permission';
import { useDepartments } from '@/hooks/use-departments';
import { useCachedData } from '@/hooks/use-cached-data';
import { exportToExcel } from '@/lib/excel';
import { todayStr, formatMoney } from '@/lib/format';

/** 常用预算类别选项 */
const BUDGET_CATEGORIES = ['行政', '差旅', '办公', '营销', '培训', '设备', '其他'];

/** 近5年（含当前年在内，往前推4年） */
function buildYears(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => current - i);
}

export default function BudgetsPage() {
  const { can } = usePermission();
  const canManage = can('finance:budget:manage');

  const { departments } = useDepartments();

  // 筛选条件
  const [filters, setFilters] = useState<{ year: string; departmentId: string; category: string }>({
    year: String(new Date().getFullYear()),
    departmentId: '',
    category: '',
  });

  // 新建 / 编辑弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [form] = Form.useForm();

  // 预算列表：筛选条件编入缓存键，变化即重新获取
  const { year, departmentId, category } = filters;
  const cacheKey = `finance:budgets:${year}:${departmentId}:${category}`;
  const { data: resData, loading, error, revalidate } = useCachedData<Budget[]>(
    cacheKey,
    async () => {
      const params: Record<string, any> = {};
      if (year) params.year = Number(year);
      const depValue = departmentId === 'global' ? '' : departmentId;
      if (depValue) params.departmentId = Number(depValue);
      else params.departmentId = null;
      if (category) params.category = category;
      const res = await financeApi.listBudgets(params);
      // 业务码非 0 视为失败，否则会显示成「暂无预算」
      if (res.code !== 0) throw new Error(res.message || '预算列表读取失败');
      let list: Budget[] = res.data?.list ?? [];
      // 若后端未按条件过滤，则本地兜底
      if (params.year !== undefined) list = list.filter((b) => b.year === params.year);
      if (depValue) list = list.filter((b) => (b.departmentId ?? null) === Number(depValue));
      if (category) {
        const kw = String(category).toLowerCase();
        list = list.filter((b) => String(b.category ?? '').toLowerCase().includes(kw));
      }
      return list;
    },
    { staleTime: 30_000 },
  );
  const data = resData ?? [];

  // 加载部门列表（用于筛选与表单），由 useDepartments 共享缓存提供
  const handleReset = () => {
    setFilters({ year: '', departmentId: '', category: '' });
  };

  // ProTable 搜索区提交：字段变更即（防抖）触发过滤
  const handleSearch = (values: Record<string, any>) => {
    setFilters({
      year: values.year ? String(values.year) : '',
      departmentId: values.departmentId ? String(values.departmentId) : '',
      category: values.category ? String(values.category) : '',
    });
  };

  const budgetSearchFields: SearchFieldConfig[] = [
    {
      key: 'year',
      label: '年份',
      type: 'select',
      placeholder: '全部年份',
      options: buildYears().map((y) => ({ value: String(y), label: `${y} 年` })),
    },
    {
      key: 'departmentId',
      label: '部门',
      type: 'select',
      placeholder: '全部部门',
      options: [
        { value: 'global', label: '公司总预算' },
        ...departments.map((d) => ({ value: String(d.id), label: d.name })),
      ],
    },
    {
      key: 'category',
      label: '类别',
      type: 'select',
      placeholder: '全部类别',
      options: BUDGET_CATEGORIES.map((c) => ({ value: c, label: c })),
    },
  ];

  const handleDelete = (record: Budget) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${record.year} 年${record.departmentName ? `「${record.departmentName}」` : '「公司总预算」'}的预算记录吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await financeApi.deleteBudget(record.id);
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

  const handleModalOk = async (values: any) => {
    setModalLoading(true);
    try {
      const depId =
        values.departmentId === 'global'
          ? null
          : values.departmentId
            ? Number(values.departmentId)
            : null;
      if (editingBudget) {
        const dto: BudgetUpdateDto = {
          year: Number(values.year),
          departmentId: depId,
          category: values.category || '',
          totalAmount: Number(values.totalAmount) || 0,
          remark: values.remark || '',
        };
        const res = await financeApi.updateBudget(editingBudget.id, dto);
        if (res.code === 0) {
          Message.success('修改成功');
          setModalVisible(false);
          form.resetFields();
          revalidate();
        } else {
          Message.error(res.message || '操作失败');
        }
      } else {
        const dto: BudgetCreateDto = {
          year: Number(values.year),
          departmentId: depId,
          category: values.category || '',
          totalAmount: Number(values.totalAmount) || 0,
          remark: values.remark || '',
        };
        const res = await financeApi.createBudget(dto);
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

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingBudget(null);
    form.resetFields();
  };

  // 打开弹窗：编辑态直接用行数据回填（state 更新是异步的，不能先 setState 再读 state），
  // 新增态清空上一次编辑残留，避免「新建」里躺着上一条预算的旧值。
  const openModal = (mode: 'add' | 'edit', record?: Budget) => {
    if (!canManage) return;
    if (mode === 'edit' && record) {
      setEditingBudget(record);
      form.setFieldsValue({
        year: String(record.year),
        departmentId: record.departmentId ? String(record.departmentId) : 'global',
        category: record.category || '',
        totalAmount: record.totalAmount,
        remark: record.remark || '',
      });
    } else {
      setEditingBudget(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      handleModalOk(values);
    } catch {
      // 校验不通过，交由表单展示错误
    }
  };

  // 导出当前（筛选后的）预算数据
  const handleExport = () => {
    if (!exportToExcel(
      `财务预算_${todayStr()}.xlsx`,
      '财务预算',
      [
        { title: '年份', dataIndex: 'year' },
        { title: '部门', value: (b: Budget) => b.departmentName ?? '公司总预算' },
        { title: '类别', dataIndex: 'category' },
        { title: '总额', dataIndex: 'totalAmount' },
        { title: '已用', dataIndex: 'usedAmount' },
        { title: '剩余', value: (b: Budget) => (b.usedAmount != null ? b.totalAmount - b.usedAmount : '') },
        { title: '备注', dataIndex: 'remark' },
      ],
      data,
    )) {
      Message.info('当前没有可导出的预算数据');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '年份', dataIndex: 'year', width: 90 },
    {
      title: '部门',
      dataIndex: 'departmentName',
      width: 160,
      render: (value: string, record: Budget) => (record.departmentName ? value : '公司总预算'),
    },
    { title: '类别', dataIndex: 'category', width: 120, render: (v: string) => v || '--' },
    {
      title: '总额',
      dataIndex: 'totalAmount',
      width: 150,
      align: 'right',
      render: (v: number) => `¥ ${formatMoney(v ?? 0, '0.00')}`,
    },
    {
      title: '已用',
      dataIndex: 'usedAmount',
      width: 150,
      align: 'right',
      render: (v: number | undefined) => (v == null ? '--' : `¥ ${formatMoney(v, '0.00')}`),
    },
    {
      title: '剩余',
      // 不能复用 usedAmount 作为 dataIndex：与「已用」列重复，React 会因重复 key
      // 复用错列节点（列显隐/重排时尤其明显）
      dataIndex: 'remaining',
      width: 150,
      align: 'right',
      render: (_: unknown, record: Budget) =>
        record.usedAmount == null
          ? '--'
          : `¥ ${formatMoney(record.totalAmount - record.usedAmount, '0.00')}`,
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v: string) => v || '--' },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: (_: any, record: Budget) => (
        <Space>
          <PermissionGate code="finance:budget:manage">
            <Button size="mini" type="text" onClick={() => openModal('edit', record)}>编辑</Button>
            <Button size="mini" type="text" status="danger" onClick={() => handleDelete(record)}>删除</Button>
          </PermissionGate>
        </Space>
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
        searchFields={budgetSearchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        searchDebounceMs={300}
        searchInlineActions
        toolbar={[
          {
            key: 'budgets-add',
            label: '+ 新建预算',
            onClick: () => openModal('add'),
            disabled: !canManage,
          },
        ]}
        showExport
        onExport={handleExport}
        emptyElement={<span className="text-text-3">暂无预算数据</span>}
      />

      {/* 新建 / 编辑弹窗 */}
      <Modal
        title={editingBudget ? '编辑预算' : '新建预算'}
        visible={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleSubmit}
        confirmLoading={modalLoading}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="年份"
            field="year"
            rules={[{ required: true, message: '请选择年份' }]}
          >
            <Select placeholder="请选择年份">
              {buildYears().map((y) => (
                <Select.Option key={y} value={String(y)}>{y} 年</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="部门"
            field="departmentId"
            extra="选择公司总预算时无需指定部门"
            initialValue="global"
          >
            <Select placeholder="选择部门（公司总预算可不选）">
              <Select.Option value="global">公司总预算</Select.Option>
              {departments.map((d) => (
                <Select.Option key={d.id} value={String(d.id)}>{d.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="类别"
            field="category"
            rules={[{ required: true, message: '请输入预算类别' }]}
          >
            <Select allowCreate placeholder="选择或输入预算类别">
              {BUDGET_CATEGORIES.map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="预算总额"
            field="totalAmount"
            rules={[{ required: true, message: '请输入预算总额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="请输入预算总额"
              min={0}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
          <Form.Item label="备注" field="remark">
            <Input.TextArea placeholder="请输入备注（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}