'use client';

import { useState, useEffect, useCallback } from 'react';
import { Message, Modal, Button, Select, Input, Spin, Form, DatePicker, Progress, InputNumber } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { okrApi, OkrObjective, OkrKeyResult } from '@/services/performance';
import { employeeApi, Employee } from '@/services/employee';
import { systemApi, type SysDepartment } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import { notifyError } from '@/lib/request';

const FormItem = Form.Item;

/** 目标类型映射：personal-个人 / department-部门 */
const OBJ_TYPE_MAP: Record<string, string> = {
  personal: '个人',
  department: '部门',
};

/** 目标状态映射：active-进行中 / completed-已完成 */
const OBJ_STATUS_MAP: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
};

/** 目标类型对应的卡片色 */
const OBJ_TYPE_COLORS: Record<string, string> = {
  personal: '#4ECDC4',
  department: '#BB8FCE',
};

interface Filters {
  type: string;
  status: string;
  keyword: string;
}

export default function OkrPage() {
  const { can } = usePermission();
  const canManage = can('performance:manage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OkrObjective[]>([]);
  const [filters, setFilters] = useState<Filters>({ type: '', status: '', keyword: '' });

  const [employeeMap, setEmployeeMap] = useState<Record<number, Employee>>({});
  const [deptMap, setDeptMap] = useState<Record<number, string>>({});

  // 目标表单
  const [objModalVisible, setObjModalVisible] = useState(false);
  const [objModalLoading, setObjModalLoading] = useState(false);
  const [editingObj, setEditingObj] = useState<OkrObjective | null>(null);

  // 关键结果表单
  const [krModalVisible, setKrModalVisible] = useState(false);
  const [krModalLoading, setKrModalLoading] = useState(false);
  const [editingKr, setEditingKr] = useState<OkrKeyResult | null>(null);
  const [krObjectiveId, setKrObjectiveId] = useState<number | null>(null);

  // 展开查看关键结果
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchList = useCallback(async (activeFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await okrApi.listObjectives();
      let list = (res.data?.list ?? []) as OkrObjective[];
      if (activeFilters.type !== '') list = list.filter((o) => o.type === activeFilters.type);
      if (activeFilters.status !== '') list = list.filter((o) => o.status === activeFilters.status);
      if (activeFilters.keyword) {
        const kw = String(activeFilters.keyword).toLowerCase();
        list = list.filter((o) => o.title.toLowerCase().includes(kw));
      }
      setData(list);
    } catch (e: any) {
      setError(e?.message || '获取 OKR 目标列表失败');
      notifyError(e, '获取 OKR 目标列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 负责人名称映射
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await employeeApi.getList({ page: 1, pageSize: 200 });
      const list = res.data?.list ?? [];
      const map: Record<number, Employee> = {};
      list.forEach((e) => { map[e.id] = e; });
      setEmployeeMap(map);
    } catch {
      // 忽略负责人加载失败
    }
  }, []);

  // 部门名称映射
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await systemApi.listDepartments();
      const list = (res.data ?? [] as any) as SysDepartment[];
      const map: Record<number, string> = {};
      list.forEach((d) => { map[d.id] = d.name; });
      setDeptMap(map);
    } catch {
      // 忽略部门加载失败
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, [fetchEmployees, fetchDepartments]);

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

  const handleAddObjective = () => {
    if (!canManage) return;
    setEditingObj(null);
    setObjModalVisible(true);
  };

  const handleEditObjective = (record: OkrObjective) => {
    if (!canManage) return;
    setEditingObj(record);
    setObjModalVisible(true);
  };

  const handleDeleteObjective = (record: OkrObjective) => {
    if (!canManage) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 OKR 目标「${record.title}」吗？其下关键结果将一并删除。`,
      onOk: async () => {
        try {
          const res = await okrApi.deleteObjective(record.id);
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

  const handleObjModalOk = async (values: any) => {
    setObjModalLoading(true);
    try {
      const dto: any = {
        title: values.title,
        type: values.type || 'personal',
        period: values.period,
        status: values.status || 'active',
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        ownerId: values.ownerId ? Number(values.ownerId) : null,
        departmentId: values.type === 'department' && values.departmentId ? Number(values.departmentId) : null,
      };
      let res;
      if (editingObj) {
        res = await okrApi.updateObjective(editingObj.id, dto);
      } else {
        res = await okrApi.createObjective(dto);
      }
      if (res.code === 0) {
        Message.success(editingObj ? '修改成功' : '创建成功');
        setObjModalVisible(false);
        setEditingObj(null);
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    } finally {
      setObjModalLoading(false);
    }
  };

  const handleObjModalCancel = () => {
    setObjModalVisible(false);
    setEditingObj(null);
  };

  // ---- 关键结果 ----

  const handleAddKr = (objectiveId: number) => {
    if (!canManage) return;
    setKrObjectiveId(objectiveId);
    setEditingKr(null);
    setKrModalVisible(true);
  };

  const handleEditKr = (objectiveId: number, record: OkrKeyResult) => {
    if (!canManage) return;
    setKrObjectiveId(objectiveId);
    setEditingKr(record);
    setKrModalVisible(true);
  };

  const handleKrModalOk = async (values: any) => {
    if (krObjectiveId == null) return;
    setKrModalLoading(true);
    try {
      const dto: any = {
        title: values.title,
        initialValue: Number(values.initialValue) || 0,
        targetValue: Number(values.targetValue) || 0,
        currentValue: Number(values.currentValue) || 0,
        unit: values.unit || undefined,
      };
      let res;
      if (editingKr) {
        res = await okrApi.updateKeyResult(editingKr.id, dto);
      } else {
        res = await okrApi.createKeyResult(krObjectiveId, dto);
      }
      if (res.code === 0) {
        Message.success(editingKr ? '更新成功' : '新增成功');
        setKrModalVisible(false);
        setEditingKr(null);
        setKrObjectiveId(null);
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    } finally {
      setKrModalLoading(false);
    }
  };

  const handleKrModalCancel = () => {
    setKrModalVisible(false);
    setEditingKr(null);
    setKrObjectiveId(null);
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const ownerLabel = (o: OkrObjective) => {
    if (o.ownerId && employeeMap[o.ownerId]) return employeeMap[o.ownerId].name;
    if (o.type === 'department' && o.departmentId && deptMap[o.departmentId]) return `部门·${deptMap[o.departmentId]}`;
    return o.ownerId ? `负责人#${o.ownerId}` : '未指定';
  };

  const handleExport = () => {
    if (!exportToExcel(
      `OKR目标_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'OKR目标',
      [
        { title: '目标标题', dataIndex: 'title' },
        { title: '类型', value: (o: OkrObjective) => OBJ_TYPE_MAP[o.type] ?? o.type },
        { title: '周期', dataIndex: 'period' },
        { title: '负责人', value: (o: OkrObjective) => ownerLabel(o) },
        { title: '进度(%)', value: (o: OkrObjective) => o.progress ?? 0 },
        { title: '状态', value: (o: OkrObjective) => OBJ_STATUS_MAP[o.status ?? ''] ?? o.status },
        { title: '开始日期', value: (o: OkrObjective) => o.startDate ?? '' },
        { title: '结束日期', value: (o: OkrObjective) => o.endDate ?? '' },
        { title: '关键结果数', value: (o: OkrObjective) => o.keyResults?.length ?? 0 },
      ],
      data,
    )) {
      Message.info('当前没有可导出的 OKR 目标数据');
    }
  };

  const filteredCount = data.length;

  return (
    <PageContainer title="OKR 目标">
      {/* 筛选栏 */}
      <div className="bg-surface border border-border-1 rounded-md p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-text-2 mb-1.5">目标类型</label>
            <Select
              value={filters.type}
              onChange={(v) => handleFilterChange('type', String(v))}
              style={{ width: '100%' }}
              placeholder="全部类型"
              allowClear
            >
              {Object.entries(OBJ_TYPE_MAP).map(([k, label]) => (
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
              {Object.entries(OBJ_STATUS_MAP).map(([k, label]) => (
                <Select.Option key={k} value={k}>{label}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm text-text-2 mb-1.5">搜索</label>
            <Input
              value={filters.keyword}
              onChange={(v) => handleFilterChange('keyword', v)}
              placeholder="目标标题"
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
        <span className="text-sm text-text-2">共 {filteredCount} 个 OKR 目标</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" onClick={handleAddObjective} disabled={!canManage}>
            + 新建目标
          </Button>
        </div>
      </div>

      {/* 目标卡片 */}
      <Spin loading={loading} style={{ display: 'block' }}>
        {error ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md">
            <p className="text-text-3 mb-3">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md text-text-3">
            {loading ? '加载中...' : '暂无 OKR 目标，点击右上角新建目标'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((obj) => {
              const color = OBJ_TYPE_COLORS[obj.type] || '#3B82F6';
              const progress = obj.progress ?? 0;
              const statusLabel = OBJ_STATUS_MAP[obj.status ?? ''] ?? obj.status;
              const statusColor = obj.status === 'completed' ? '#16a34a' : '#f59e0b';
              const isExpanded = expandedId === obj.id;
              const krs = obj.keyResults ?? [];
              return (
                <div
                  key={obj.id}
                  className="border-2 rounded-lg p-5 bg-surface transition-all hover:shadow-md"
                  style={{ borderColor: color, backgroundColor: `${color}10` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-medium text-text-1 break-all">{obj.title}</h3>
                      <div className="flex gap-2 mt-1.5 flex-wrap">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-xs font-normal"
                          style={{ background: `${color}22`, color }}
                        >
                          {OBJ_TYPE_MAP[obj.type] ?? obj.type}
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
                      title={obj.type}
                    />
                  </div>

                  <div className="space-y-1.5 text-sm text-text-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span>📆</span>
                      <span>{obj.period || '--'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>👤</span>
                      <span>{ownerLabel(obj)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🗓️</span>
                      <span>{obj.startDate || '--'} ~ {obj.endDate || '--'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📊</span>
                      <span className="flex-1">整体进度：{progress}%</span>
                    </div>
                    <Progress percent={progress} size="small" status={obj.status === 'completed' ? 'success' : undefined} />
                  </div>

                  {/* 关键结果区域 */}
                  <div className="mb-3">
                    <Button
                      size="small"
                      onClick={() => toggleExpand(obj.id)}
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                      type={isExpanded ? 'secondary' : 'default'}
                    >
                      {isExpanded ? '▼' : '▶'} 关键结果（{krs.length}）
                    </Button>
                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {krs.length === 0 && (
                          <div className="text-center text-xs text-text-3 py-3 border border-dashed border-border-2 rounded">
                            暂无关键结果，点击下方「新增关键结果」添加
                          </div>
                        )}
                        {krs.map((kr) => (
                          <div key={kr.id} className="rounded border border-border-2 bg-bg-page p-3 text-sm">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-medium text-text-1 truncate">{kr.title}</span>
                              <Button
                                size="mini"
                                type="primary"
                                disabled={!canManage}
                                onClick={() => handleEditKr(obj.id, kr)}
                              >
                                更新
                              </Button>
                            </div>
                            <div className="text-xs text-text-2 mb-1">
                              初始 {kr.initialValue ?? 0} → 目标 {kr.targetValue ?? 0}，当前 {kr.currentValue ?? 0}
                              {kr.unit ? `（${kr.unit}）` : ''}
                            </div>
                            <Progress percent={kr.progress ?? 0} size="mini" />
                          </div>
                        ))}
                        <Button
                          size="small"
                          type="primary"
                          className="w-full"
                          disabled={!canManage}
                          onClick={() => handleAddKr(obj.id)}
                        >
                          + 新增关键结果
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="primary"
                      size="small"
                      style={{ flex: 1 }}
                      disabled={!canManage}
                      onClick={() => handleEditObjective(obj)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      status="danger"
                      disabled={!canManage}
                      onClick={() => handleDeleteObjective(obj)}
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

      {/* 目标表单弹窗 */}
      <ObjectiveFormModal
        visible={objModalVisible}
        title={editingObj ? '编辑 OKR 目标' : '新建 OKR 目标'}
        employees={Object.values(employeeMap)}
        departments={Object.entries(deptMap).map(([id, name]) => ({ id: Number(id), name }))}
        initialValues={editingObj ? {
          title: editingObj.title,
          type: editingObj.type || 'personal',
          period: editingObj.period || '',
          status: editingObj.status || 'active',
          startDate: editingObj.startDate || '',
          endDate: editingObj.endDate || '',
          ownerId: editingObj.ownerId ? String(editingObj.ownerId) : '',
          departmentId: editingObj.departmentId ? String(editingObj.departmentId) : '',
        } : {
          title: '',
          type: 'personal',
          period: '',
          status: 'active',
          startDate: '',
          endDate: '',
          ownerId: '',
          departmentId: '',
        }}
        confirmLoading={objModalLoading}
        onOk={handleObjModalOk}
        onCancel={handleObjModalCancel}
      />

      {/* 关键结果表单弹窗 */}
      <KeyResultFormModal
        visible={krModalVisible}
        title={editingKr ? '更新关键结果' : '新增关键结果'}
        initialValues={editingKr ? {
          title: editingKr.title,
          initialValue: editingKr.initialValue ?? 0,
          targetValue: editingKr.targetValue ?? 0,
          currentValue: editingKr.currentValue ?? 0,
          unit: editingKr.unit ?? '',
        } : {
          title: '',
          initialValue: 0,
          targetValue: 100,
          currentValue: 0,
          unit: '',
        }}
        confirmLoading={krModalLoading}
        onOk={handleKrModalOk}
        onCancel={handleKrModalCancel}
      />
    </PageContainer>
  );
}

// ========== 目标表单弹窗 ==========

interface ObjectiveFormValues {
  title: string;
  type: string;
  period: string;
  status: string;
  startDate: string;
  endDate: string;
  ownerId: string;
  departmentId: string;
}

interface ObjectiveFormModalProps {
  visible: boolean;
  title: string;
  employees: Employee[];
  departments: { id: number; name: string }[];
  initialValues: ObjectiveFormValues;
  confirmLoading?: boolean;
  onOk: (values: ObjectiveFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function ObjectiveFormModal({ visible, title, employees, departments, initialValues, confirmLoading = false, onOk, onCancel }: ObjectiveFormModalProps) {
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
    const payload: ObjectiveFormValues = {
      title: String(values.title || '').trim(),
      type: values.type || 'personal',
      period: String(values.period || '').trim(),
      status: values.status || 'active',
      startDate: values.startDate || '',
      endDate: values.endDate || '',
      ownerId: values.ownerId ? String(values.ownerId) : '',
      departmentId: values.departmentId ? String(values.departmentId) : '',
    };
    if (!payload.title || !payload.period) return;
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
      style={{ width: 560, top: 48 }}
      maskClosable={false}
      autoFocus={false}
      focusLock={true}
    >
      <Form form={form} layout="vertical" initialValues={initialValues}>
        <FormItem label="目标标题" field="title" rules={[{ required: true, message: '请输入目标标题' }]}>
          <Input placeholder="例如：提升产品核心功能体验" maxLength={100} />
        </FormItem>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormItem label="类型" field="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="请选择类型">
              {Object.entries(OBJ_TYPE_MAP).map(([k, label]) => (
                <Select.Option key={k} value={k}>{label}</Select.Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="周期" field="period" rules={[{ required: true, message: '请输入周期' }]}>
            <Input placeholder="例如：2026 Q1" maxLength={30} />
          </FormItem>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <FormItem label="开始日期" field="startDate">
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} placeholder="开始日期" />
          </FormItem>
          <FormItem label="结束日期" field="endDate">
            <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} placeholder="结束日期" />
          </FormItem>
        </div>
        <FormItem label="负责人" field="ownerId">
          <Select
            placeholder="请选择负责人"
            allowClear
            showSearch
            filterOption={(input: string, option: any) =>
              String(option?.props?.children ?? option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {employees.map((e) => (
              <Select.Option key={e.id} value={String(e.id)}>{e.name}</Select.Option>
            ))}
          </Select>
        </FormItem>
        <FormItem label="所属部门" field="departmentId" extra="仅部门类型目标需要选择">
          <Select placeholder="请选择部门" allowClear>
            {departments.map((d) => (
              <Select.Option key={d.id} value={String(d.id)}>{d.name}</Select.Option>
            ))}
          </Select>
        </FormItem>
        <FormItem label="状态" field="status">
          <Select placeholder="请选择状态">
            {Object.entries(OBJ_STATUS_MAP).map(([k, label]) => (
              <Select.Option key={k} value={k}>{label}</Select.Option>
            ))}
          </Select>
        </FormItem>
      </Form>
    </Modal>
  );
}

// ========== 关键结果表单弹窗 ==========

interface KeyResultFormValues {
  title: string;
  initialValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
}

interface KeyResultFormModalProps {
  visible: boolean;
  title: string;
  initialValues: KeyResultFormValues;
  confirmLoading?: boolean;
  onOk: (values: KeyResultFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function KeyResultFormModal({ visible, title, initialValues, confirmLoading = false, onOk, onCancel }: KeyResultFormModalProps) {
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
    if (!String(values.title || '').trim()) return;
    await onOk(values as KeyResultFormValues);
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
        <FormItem label="关键结果标题" field="title" rules={[{ required: true, message: '请输入关键结果标题' }]}>
          <Input placeholder="例如：用户月活跃数提升到 10 万" maxLength={100} />
        </FormItem>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
          <FormItem label="初始值" field="initialValue">
            <InputNumber style={{ width: '100%' }} placeholder="0" />
          </FormItem>
          <FormItem label="目标值" field="targetValue">
            <InputNumber style={{ width: '100%' }} placeholder="100" />
          </FormItem>
          <FormItem label="当前值" field="currentValue">
            <InputNumber style={{ width: '100%' }} placeholder="0" />
          </FormItem>
        </div>
        <FormItem label="单位" field="unit">
          <Input placeholder="例如：次 / % / 万元（可选）" maxLength={20} />
        </FormItem>
      </Form>
    </Modal>
  );
}