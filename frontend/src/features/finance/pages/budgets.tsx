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
import { todayStr, formatMoney, getTzParts } from '@/lib/format';

/** 常用预算类别选项 */
const BUDGET_CATEGORIES = ['行政', '差旅', '办公', '营销', '培训', '设备', '其他'];

/** 当前年份：按北京时间取，宿主机在 UTC 等时区时元旦早上不会落到上一年 */
function currentYear(): string {
  return getTzParts(new Date()).Y;
}

/** 近5年（含当前年在内，往前推4年） */
function buildYears(): number[] {
  const current = Number(currentYear());
  return Array.from({ length: 5 }, (_, i) => current - i);
}

export default function BudgetsPage() {
  const { can } = usePermission();
  const canManage = can('finance:budget:manage');

  const { departments } = useDepartments();

  // 默认筛选（北京时间当前年）只在挂载时算一次，「重置」回同一默认值
  const [defaults] = useState(() => ({ year: currentYear() }));
  // 筛选条件
  const [filters, setFilters] = useState<{ year: string; departmentId: string; category: string }>({
    year: defaults.year,
    departmentId: '',
    category: '',
  });

  // 新建 / 编辑弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [form] = Form.useForm();

  // 后端预算表只存 departmentId，没有部门名：用共享部门缓存补上，否则整列都显示成「公司总预算」
  const departmentNameOf = (b: Budget): string => {
    if (b.departmentId == null) return '公司总预算';
    return departments.find((d) => d.id === b.departmentId)?.name ?? `部门 #${b.departmentId}`;
  };

  // 预算列表：筛选条件编入缓存键，变化即重新获取
  const { year, departmentId, category } = filters;
  const cacheKey = `finance:budgets:${year}:${departmentId}:${category}`;
  const { data: resData, loading, error, revalidate } = useCachedData<Budget[]>(
    cacheKey,
    async () => {
      const params: Record<string, any> = {};
      if (year) params.year = Number(year);
      // 「公司总预算」= departmentId 为空，后端没有对应的查询参数（null 会被省略），下面本地过滤
      const isGlobal = departmentId === 'global';
      const depValue = isGlobal ? '' : departmentId;
      if (depValue) params.departmentId = Number(depValue);
      if (category) params.category = category;
      const res = await financeApi.listBudgets(params);
      // 业务码非 0 视为失败，否则会显示成「暂无预算」
      if (res.code !== 0) throw new Error(res.message || '预算列表读取失败');
      let list: Budget[] = res.data?.list ?? [];
      if (isGlobal) list = list.filter((b) => b.departmentId == null);
      return list;
    },
    { staleTime: 30_000 },
  );
  const data = resData ?? [];

  // 加载部门列表（用于筛选与表单），由 useDepartments 共享缓存提供
  const handleReset = () => {
    setFilters({ year: defaults.year, departmentId: '', category: '' });
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
      content: `确定要删除 ${record.year} 年「${departmentNameOf(record)}」的预算记录吗？删除后不可恢复。`,
      okButtonProps: { status: 'danger' },
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
      // 后端字段名是 amount / note，提交 totalAmount / remark 会被 zod 校验挡回 400
      const dto = {
        year: Number(values.year),
        departmentId: depId,
        category: values.category || '',
        amount: Number(values.amount) || 0,
        note: values.note || '',
      };
      if (editingBudget) {
        const res = await financeApi.updateBudget(editingBudget.id, dto as BudgetUpdateDto);
        if (res.code === 0) {
          Message.success('修改成功');
          setModalVisible(false);
          form.resetFields();
          revalidate();
        } else {
          Message.error(res.message || '操作失败');
        }
      } else {
        const res = await financeApi.createBudget(dto as BudgetCreateDto);
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
        amount: Number(record.amount ?? 0),
        note: record.note || '',
      });
    } else {
      setEditingBudget(null);
      form.resetFields();
      // 新建默认落在当前年 + 公司总预算，少点两次选择
      form.setFieldsValue({ year: defaults.year, departmentId: 'global' });
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
        { title: '部门', value: (b: Budget) => departmentNameOf(b) },
        { title: '类别', dataIndex: 'category' },
        { title: '总额', value: (b: Budget) => Number(b.amount ?? 0) },
        {
          title: '已用',
          value: (b: Budget) => (b.usedAmount == null ? '' : Number(b.usedAmount)),
        },
        {
          title: '剩余',
          value: (b: Budget) =>
            b.usedAmount == null ? '' : Number(b.amount ?? 0) - Number(b.usedAmount),
        },
        { title: '备注', value: (b: Budget) => b.note ?? '' },
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
      dataIndex: 'departmentId',
      width: 160,
      render: (_: unknown, record: Budget) => departmentNameOf(record),
    },
    { title: '类别', dataIndex: 'category', width: 120, render: (v: string) => v || '--' },
    {
      title: '总额',
      dataIndex: 'amount',
      width: 150,
      align: 'right',
      render: (v: number | string) => `¥ ${formatMoney(Number(v ?? 0), '0.00')}`,
    },
    {
      title: '已用',
      dataIndex: 'usedAmount',
      width: 150,
      align: 'right',
      render: (v: number | string | undefined) => (v == null ? '--' : `¥ ${formatMoney(Number(v), '0.00')}`),
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
          : `¥ ${formatMoney(Number(record.amount ?? 0) - Number(record.usedAmount), '0.00')}`,
    },
    { title: '备注', dataIndex: 'note', ellipsis: true, render: (v: string) => v || '--' },
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
        // 默认按当前年查询，筛选框必须显示同一年份，否则用户看不出数据被默认条件过滤过
        searchInitialValues={{ year: defaults.year }}
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
            field="amount"
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
          <Form.Item label="备注" field="note">
            <Input.TextArea placeholder="请输入备注（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}