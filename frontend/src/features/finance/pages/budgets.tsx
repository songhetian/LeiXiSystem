'use client';

import { useState, useEffect, useCallback } from 'react';
import { Message, Modal, Button, Select, Input, InputNumber, Form, Table, Spin, Space } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import { financeApi, Budget, BudgetCreateDto, BudgetUpdateDto } from '@/services/finance';
import { systemApi, type SysDepartment } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Budget[]>([]);
  const [departments, setDepartments] = useState<SysDepartment[]>([]);

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

  const fetchList = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {};
      if (activeFilters.year) params.year = Number(activeFilters.year);
      const depValue =
        activeFilters.departmentId === 'global' ? '' : activeFilters.departmentId;
      if (depValue) params.departmentId = Number(depValue);
      else params.departmentId = null;
      if (activeFilters.category) params.category = activeFilters.category;
      const res = await financeApi.listBudgets(params);
      let list: Budget[] = [];
      if (res.code === 0) {
        list = (res.data?.list ?? []) as Budget[];
      } else if (Array.isArray((res as any).data)) {
        list = (res as any).data;
      }
      // 若后端未按条件过滤，则本地兜底
      if (params.year !== undefined) list = list.filter((b) => b.year === params.year);
      if (depValue) list = list.filter((b) => (b.departmentId ?? null) === Number(depValue));
      if (activeFilters.category) {
        const kw = String(activeFilters.category).toLowerCase();
        list = list.filter((b) => String(b.category ?? '').toLowerCase().includes(kw));
      }
      setData(list);
    } catch (e: any) {
      setError(e?.message || '获取预算列表失败');
      notifyError(e, '获取预算列表失败');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.year, filters.departmentId, filters.category]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 加载部门列表（用于筛选与表单）
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await systemApi.listDepartments();
      if (res.code === 0 && res.data) setDepartments(res.data);
    } catch {
      // 忽略部门加载失败
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleFilterChange = (key: 'year' | 'departmentId' | 'category', value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    fetchList(next);
  };

  const handleReset = () => {
    const empty = { year: '', departmentId: '', category: '' };
    setFilters(empty);
    fetchList(empty);
  };

  const handleAdd = () => {
    if (!canManage) return;
    setEditingBudget(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Budget) => {
    if (!canManage) return;
    setEditingBudget(record);
    setModalVisible(true);
  };

  const handleDelete = (record: Budget) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 ${record.year} 年${record.departmentName ? `「${record.departmentName}」` : '「公司总预算」'}的预算记录吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await financeApi.deleteBudget(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            fetchList();
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
          fetchList();
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
          fetchList();
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

  // 打开弹窗时根据编辑状态回填表单
  const openModal = (mode: 'add' | 'edit') => {
    if (mode === 'edit' && editingBudget) {
      form.setFieldsValue({
        year: String(editingBudget.year),
        departmentId: editingBudget.departmentId ? String(editingBudget.departmentId) : 'global',
        category: editingBudget.category || '',
        totalAmount: editingBudget.totalAmount,
        remark: editingBudget.remark || '',
      });
    } else {
      form.resetFields();
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

  // 导出当前（筛选后的）预算数据
  const handleExport = () => {
    if (!exportToExcel(
      `财务预算_${new Date().toISOString().slice(0, 10)}.xlsx`,
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

  const columns = [
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
      render: (v: number) => `¥ ${Number(v ?? 0).toLocaleString('zh-CN')}`,
    },
    {
      title: '已用',
      dataIndex: 'usedAmount',
      width: 150,
      render: (v: number | undefined) => (v == null ? '--' : `¥ ${Number(v).toLocaleString('zh-CN')}`),
    },
    {
      title: '剩余',
      dataIndex: 'usedAmount',
      width: 150,
      render: (v: number | undefined, record: Budget) =>
        v == null ? '--' : `¥ ${(record.totalAmount - v).toLocaleString('zh-CN')}`,
    },
    { title: '备注', dataIndex: 'remark', ellipsis: true, render: (v: string) => v || '--' },
    {
      title: '操作',
      width: 140,
      render: (_: any, record: Budget) => (
        <Space>
          <Button size="mini" type="text" disabled={!canManage} onClick={() => { setEditingBudget(record); openModal('edit'); }}>编辑</Button>
          <Button size="mini" type="text" status="danger" disabled={!canManage} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="财务预算">
      {/* 筛选栏 */}
      <div className="bg-surface border border-border-1 rounded-md p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-text-2 mb-1.5">年份</label>
            <Select
              value={filters.year || undefined}
              onChange={(v) => handleFilterChange('year', String(v ?? ''))}
              style={{ width: '100%' }}
              placeholder="全部年份"
              allowClear
            >
              {buildYears().map((y) => (
                <Select.Option key={y} value={String(y)}>{y} 年</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">部门</label>
            <Select
              value={filters.departmentId || undefined}
              onChange={(v) => handleFilterChange('departmentId', String(v ?? ''))}
              style={{ width: '100%' }}
              placeholder="全部部门"
              allowClear
            >
              <Select.Option value="global">公司总预算</Select.Option>
              {departments.map((d) => (
                <Select.Option key={d.id} value={String(d.id)}>{d.name}</Select.Option>
              ))}
            </Select>
          </div>
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
              {BUDGET_CATEGORIES.map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <Button style={{ width: '100%' }} onClick={handleReset}>重置筛选</Button>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-2">共 {data.length} 条预算</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" disabled={!canManage} onClick={() => openModal('add')}>+ 新建预算</Button>
        </div>
      </div>

      {/* 预算表格 */}
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
            pagination={{ pageSize: 10, showTotal: true }}
            noDataElement={<div className="py-16 text-text-3">暂无预算数据</div>}
          />
        )}
      </div>

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