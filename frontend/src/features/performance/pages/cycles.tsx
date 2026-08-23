'use client';

import { useState, useEffect, useCallback } from 'react';
import { Message, Modal, Button, Select, Input, Spin, Form, DatePicker } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { performanceApi, PerformanceCycle, PerformanceCycleCreateDto, PerformanceCycleUpdateDto } from '@/services/performance';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import { notifyError } from '@/lib/request';

const FormItem = Form.Item;

/** 周期类型映射：temporary-临时 / quarterly-季度 / yearly-年度 */
const CYCLE_TYPE_MAP: Record<string, string> = {
  temporary: '临时',
  quarterly: '季度',
  yearly: '年度',
};

/** 周期状态映射：draft-草稿 / active-进行中 / closed-已结束 */
const CYCLE_STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  closed: '已结束',
};

/** 状态对应的标签配色 */
const STATUS_COLOR: Record<string, string> = {
  draft: '#8d98aa',
  active: '#16a34a',
  closed: '#f59e0b',
};

/** 每种周期类型给出的卡片色 */
const TYPE_COLORS: Record<string, string> = {
  temporary: '#FF6B6B',
  quarterly: '#4ECDC4',
  yearly: '#45B7D1',
};

interface Filters {
  type: string;
  status: string;
  keyword: string;
}

export default function CyclesPage() {
  const { can } = usePermission();
  const canManage = can('performance:manage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PerformanceCycle[]>([]);
  const [filters, setFilters] = useState<Filters>({ type: '', status: '', keyword: '' });

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editing, setEditing] = useState<PerformanceCycle | null>(null);

  const fetchList = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await performanceApi.listCycles();
      let list = (res.data?.list ?? []) as PerformanceCycle[];
      // 本地兜底过滤
      if (activeFilters.type !== '') list = list.filter((c) => c.type === activeFilters.type);
      if (activeFilters.status !== '') list = list.filter((c) => c.status === activeFilters.status);
      if (activeFilters.keyword) {
        const kw = String(activeFilters.keyword).toLowerCase();
        list = list.filter((c) => c.name.toLowerCase().includes(kw));
      }
      setData(list);
    } catch (e: any) {
      setError(e?.message || '获取绩效周期列表失败');
      notifyError(e, '获取绩效周期列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      fetchList(next);
      return next;
    });
  }, [fetchList]);

  const handleReset = useCallback(() => {
    const empty: Filters = { type: '', status: '', keyword: '' };
    setFilters(empty);
    fetchList(empty);
  }, [fetchList]);

  const handleAdd = () => {
    if (!canManage) return;
    setEditing(null);
    setModalVisible(true);
  };

  const handleEdit = (record: PerformanceCycle) => {
    if (!canManage) return;
    setEditing(record);
    setModalVisible(true);
  };

  const handleDelete = (record: PerformanceCycle) => {
    if (!canManage) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除绩效周期「${record.name}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await performanceApi.deleteCycle(record.id);
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
      const dto: PerformanceCycleCreateDto | PerformanceCycleUpdateDto = {
        name: values.name,
        type: values.type || 'quarterly',
        startDate: values.startDate || '',
        endDate: values.endDate || '',
        status: values.status || 'draft',
      };
      let res;
      if (editing) {
        res = await performanceApi.updateCycle(editing.id, dto as PerformanceCycleUpdateDto);
      } else {
        res = await performanceApi.createCycle(dto as PerformanceCycleCreateDto);
      }
      if (res.code === 0) {
        Message.success(editing ? '修改成功' : '创建成功');
        setModalVisible(false);
        setEditing(null);
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditing(null);
  };

  const handleExport = () => {
    if (!exportToExcel(
      `绩效周期_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '绩效周期',
      [
        { title: '周期名称', dataIndex: 'name' },
        { title: '类型', value: (c: PerformanceCycle) => CYCLE_TYPE_MAP[c.type] ?? c.type },
        { title: '开始日期', dataIndex: 'startDate' },
        { title: '结束日期', dataIndex: 'endDate' },
        { title: '状态', value: (c: PerformanceCycle) => CYCLE_STATUS_MAP[c.status] ?? c.status },
        { title: '目标数', value: (c: PerformanceCycle) => c._count?.goals ?? 0 },
        { title: '评审数', value: (c: PerformanceCycle) => c._count?.reviews ?? 0 },
        { title: '自评截止日', value: (c: PerformanceCycle) => c.selfReviewDeadline ?? '' },
        { title: '经理评审截止日', value: (c: PerformanceCycle) => c.managerReviewDeadline ?? '' },
      ],
      data,
    )) {
      Message.info('当前没有可导出的绩效周期数据');
    }
  };

  const filteredCount = data.length;

  return (
    <PageContainer title="绩效管理">
      {/* 筛选栏 */}
      <div className="bg-surface border border-border-1 rounded-md p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-text-2 mb-1.5">周期类型</label>
            <Select
              value={filters.type}
              onChange={(v) => handleFilterChange('type', String(v))}
              style={{ width: '100%' }}
              placeholder="全部类型"
              allowClear
            >
              {Object.entries(CYCLE_TYPE_MAP).map(([k, label]) => (
                <Select.Option key={k} value={k}>{label}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">状态</label>
            <Select
              value={filters.status}
              onChange={(v) => handleFilterChange('status', String(v))}
              style={{ width: '100%' }}
              placeholder="全部状态"
              allowClear
            >
              {Object.entries(CYCLE_STATUS_MAP).map(([k, label]) => (
                <Select.Option key={k} value={k}>{label}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">搜索</label>
            <Input
              value={filters.keyword}
              onChange={(v) => handleFilterChange('keyword', v)}
              placeholder="周期名称"
              allowClear
              style={{ width: '100%' }}
            />
          </div>
          <div className="flex items-end">
            <Button style={{ width: '100%' }} onClick={handleReset}>重置筛选</Button>
          </div>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-2">共 {filteredCount} 个绩效周期</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" onClick={handleAdd} disabled={!canManage}>
            + 新建周期
          </Button>
        </div>
      </div>

      {/* 周期卡片 */}
      <Spin loading={loading} style={{ display: 'block' }}>
        {error ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md">
            <p className="text-text-3 mb-3">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md text-text-3">
            {loading ? '加载中...' : '暂无绩效周期，点击右上角新建周期'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((cycle, index) => {
              const color = TYPE_COLORS[cycle.type] || ['#3B82F6', '#8B5CF6', '#EC4899'][index % 3];
              const statusLabel = CYCLE_STATUS_MAP[cycle.status] ?? cycle.status;
              const statusColor = STATUS_COLOR[cycle.status] || '#8d98aa';
              return (
                <div
                  key={cycle.id}
                  className="border-2 rounded-lg p-5 bg-surface transition-all hover:shadow-md"
                  style={{ borderColor: color, backgroundColor: `${color}10` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-medium text-text-1 break-all">{cycle.name}</h3>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-normal"
                          style={{ background: `${color}22`, color }}
                        >
                          {CYCLE_TYPE_MAP[cycle.type] ?? cycle.type}
                        </span>
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-normal"
                          style={{ background: `${statusColor}1c`, color: statusColor }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <span
                      className="shrink-0 w-4 h-4 rounded"
                      style={{ background: color, border: '1px solid rgba(0,0,0,0.08)' }}
                      title={cycle.type}
                    />
                  </div>

                  <div className="space-y-1.5 text-sm text-text-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>{cycle.startDate} ~ {cycle.endDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🎯</span>
                      <span>目标数：{cycle._count?.goals ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🗂️</span>
                      <span>评审数：{cycle._count?.reviews ?? 0}</span>
                    </div>
                    {cycle.selfReviewDeadline && (
                      <div className="flex items-center gap-2">
                        <span>⏳</span>
                        <span>自评截止：{cycle.selfReviewDeadline}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="primary"
                      size="small"
                      style={{ flex: 1 }}
                      disabled={!canManage}
                      onClick={() => handleEdit(cycle)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      status="danger"
                      disabled={!canManage}
                      onClick={() => handleDelete(cycle)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spin>

      <CycleFormModal
        visible={modalVisible}
        title={editing ? '编辑绩效周期' : '新建绩效周期'}
        initialValues={editing ? {
          name: editing.name,
          type: editing.type,
          startDate: editing.startDate,
          endDate: editing.endDate,
          status: editing.status,
        } : {
          name: '',
          type: 'quarterly',
          startDate: '',
          endDate: '',
          status: 'draft',
        }}
        confirmLoading={modalLoading}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
      />
    </PageContainer>
  );
}

// ========== 周期表单弹窗 ==========

interface CycleFormValues {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface CycleFormModalProps {
  visible: boolean;
  title: string;
  initialValues: CycleFormValues;
  confirmLoading?: boolean;
  onOk: (values: CycleFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function CycleFormModal({ visible, title, initialValues, confirmLoading = false, onOk, onCancel }: CycleFormModalProps) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({ ...initialValues });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialValues, form]);

  const handleOk = async () => {
    try {
      await form.validate();
    } catch {
      return;
    }
    const values = form.getFieldsValue();
    const payload: CycleFormValues = {
      name: String(values.name || '').trim(),
      type: values.type || 'quarterly',
      startDate: values.startDate || '',
      endDate: values.endDate || '',
      status: values.status || 'draft',
    };
    if (!payload.name) return;
    await onOk(payload);
  };

  return (
    <Modal
      visible={visible}
      title={title}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={confirmLoading}
      okText="保存"
      cancelText="取消"
      style={{ width: 520, top: 48 }}
      maskClosable={false}
      autoFocus={false}
      focusLock={true}
    >
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <FormItem label="周期名称" field="name" rules={[{ required: true, message: '请输入周期名称' }]}>
          <Input placeholder="例如：2026 年 Q1 绩效周期" maxLength={50} />
        </FormItem>
        <FormItem label="周期类型" field="type" rules={[{ required: true, message: '请选择周期类型' }]}>
          <Select placeholder="请选择周期类型">
            {Object.entries(CYCLE_TYPE_MAP).map(([k, label]) => (
              <Select.Option key={k} value={k}>{label}</Select.Option>
            ))}
          </Select>
        </FormItem>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormItem label="开始日期" field="startDate" rules={[{ required: true, message: '请选择开始日期' }]}>
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} placeholder="开始日期" />
          </FormItem>
          <FormItem label="结束日期" field="endDate" rules={[{ required: true, message: '请选择结束日期' }]}>
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} placeholder="结束日期" />
          </FormItem>
        </div>
        <FormItem label="状态" field="status">
          <Select placeholder="请选择状态">
            {Object.entries(CYCLE_STATUS_MAP).map(([k, label]) => (
              <Select.Option key={k} value={k}>{label}</Select.Option>
            ))}
          </Select>
        </FormItem>
      </Form>
    </Modal>
  );
}