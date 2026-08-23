'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Message,
  Modal,
  Button,
  Select,
  Input,
  DatePicker,
  Table,
  Tag,
  Space,
  Spin,
  Tabs,
} from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import {
  exceptionApi,
  ExceptionRecord,
  ExceptionRule,
} from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import { notifyError } from '@/lib/request';
import { exportToExcel } from '@/lib/excel';

interface ExceptionFilters {
  status: string;
  type: string;
  employeeId: string;
  workDate: string;
}

/** 异常记录状态中文映射 */
function exceptionStatusLabel(status?: string): string {
  if (status === 'pending') return '待处理';
  if (status === 'resolved') return '已处理';
  return status || '--';
}

/** 日期字段格式化：workDate 可能是 Date 序列化后的字符串 */
function formatDate(d?: string | null): string {
  if (!d) return '--';
  return String(d).slice(0, 10);
}

export default function ExceptionRulesPage() {
  const { can } = usePermission();
  const canManage = can('attendance:exception:manage');

  // ===== 异常记录 tab =====
  const [exceptionLoading, setExceptionLoading] = useState(false);
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionRecord[]>([]);
  const [exceptionTotal, setExceptionTotal] = useState(0);
  const [exceptionFilters, setExceptionFilters] = useState<ExceptionFilters>({
    status: '',
    type: '',
    employeeId: '',
    workDate: '',
  });

  // ===== 异常规则 tab =====
  const [ruleLoading, setRuleLoading] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [rules, setRules] = useState<ExceptionRule[]>([]);

  // ===== 新增/处理弹窗 =====
  const [exceptionFormVisible, setExceptionFormVisible] = useState(false);
  const [exceptionFormLoading, setExceptionFormLoading] = useState(false);

  const [handleVisible, setHandleVisible] = useState(false);
  const [handleLoading, setHandleLoading] = useState(false);
  const [currentException, setCurrentException] = useState<ExceptionRecord | null>(null);

  const [ruleVisible, setRuleVisible] = useState(false);
  const [ruleLoading2, setRuleLoading2] = useState(false);
  const [editingRule, setEditingRule] = useState<ExceptionRule | null>(null);

  // ================= 异常记录 =================
  const fetchExceptions = useCallback(async (activeFilters = exceptionFilters) => {
    setExceptionLoading(true);
    setExceptionError(null);
    try {
      const params: any = {};
      if (activeFilters.status) params.status = activeFilters.status;
      if (activeFilters.type) params.type = activeFilters.type;
      if (activeFilters.employeeId) params.employeeId = Number(activeFilters.employeeId);
      if (activeFilters.workDate) params.workDate = activeFilters.workDate;
      const res: any = await exceptionApi.listExceptions(params);
      const list = (res.data?.list ?? res?.list ?? []) as ExceptionRecord[];
      setExceptions(list);
      setExceptionTotal(res.data?.total ?? list.length);
    } catch (e: any) {
      setExceptionError(e?.message || '获取异常记录失败');
      notifyError(e, '获取异常记录失败');
    } finally {
      setExceptionLoading(false);
    }
  }, [exceptionFilters]);

  useEffect(() => {
    fetchExceptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExceptionFilter = useCallback((key: keyof ExceptionFilters, value: string) => {
    setExceptionFilters((prev) => {
      const next = { ...prev, [key]: value };
      fetchExceptions(next);
      return next;
    });
  }, [fetchExceptions]);

  const handleExceptionReset = useCallback(() => {
    const empty: ExceptionFilters = { status: '', type: '', employeeId: '', workDate: '' };
    setExceptionFilters(empty);
    fetchExceptions(empty);
  }, [fetchExceptions]);

  // ================= 异常规则 =================
  const fetchRules = useCallback(async () => {
    setRuleLoading(true);
    setRuleError(null);
    try {
      const res: any = await exceptionApi.getExceptionRules();
      const list = (res.data?.list ?? res?.list ?? []) as ExceptionRule[];
      setRules(list);
    } catch (e: any) {
      setRuleError(e?.message || '获取异常规则失败');
      notifyError(e, '获取异常规则失败');
    } finally {
      setRuleLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ================= 异常记录：新增 =================
  const handleExceptionAdd = () => {
    if (!canManage) return;
    setExceptionFormVisible(true);
  };

  const handleExceptionFormOk = async (values: Record<string, any>) => {
    setExceptionFormLoading(true);
    try {
      const res = await exceptionApi.createException({
        employeeId: Number(values.employeeId),
        workDate: values.workDate,
        type: String(values.type).trim(),
        description: values.description || undefined,
        deductMinutes: values.deductMinutes ? Number(values.deductMinutes) : undefined,
      });
      if (res.code === 0) {
        Message.success('新增异常记录成功');
        setExceptionFormVisible(false);
        fetchExceptions();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    } finally {
      setExceptionFormLoading(false);
    }
  };

  // ================= 异常记录：处理 =================
  const handleExceptionOpen = (record: ExceptionRecord) => {
    if (!canManage) return;
    setCurrentException(record);
    setHandleVisible(true);
  };

  const handleHandleOk = async (values: Record<string, any>) => {
    if (!currentException) return;
    setHandleLoading(true);
    try {
      const res = await exceptionApi.handleException(currentException.id, {
        status: values.status,
        remark: values.remark || undefined,
      });
      if (res.code === 0) {
        Message.success('处理成功');
        setHandleVisible(false);
        setCurrentException(null);
        fetchExceptions();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    } finally {
      setHandleLoading(false);
    }
  };

  // ================= 异常记录：删除 =================
  const handleExceptionDelete = (record: ExceptionRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除该异常记录（${record.type}）吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await exceptionApi.deleteException(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            fetchExceptions();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch {
          Message.error('删除失败');
        }
      },
    });
  };

  // ================= 异常规则：新增/编辑 =================
  const handleRuleAdd = () => {
    if (!canManage) return;
    setEditingRule(null);
    setRuleVisible(true);
  };

  const handleRuleEdit = (record: ExceptionRule) => {
    if (!canManage) return;
    setEditingRule(record);
    setRuleVisible(true);
  };

  const handleRuleFormOk = async (values: Record<string, any>) => {
    setRuleLoading2(true);
    try {
      const dto = {
        name: String(values.name).trim(),
        type: String(values.type).trim(),
        threshold: values.threshold !== '' && values.threshold != null ? Number(values.threshold) : 0,
        thresholdMax: values.thresholdMax !== '' && values.thresholdMax != null ? Number(values.thresholdMax) : null,
        deductMinutes: values.deductMinutes ? Number(values.deductMinutes) : 0,
        autoResolve: String(values.autoResolve) === 'true',
        status: values.status || 'enabled',
        description: values.description || undefined,
      };
      let res;
      if (editingRule) {
        res = await exceptionApi.updateExceptionRule(editingRule.id, dto);
      } else {
        res = await exceptionApi.createExceptionRule(dto as any);
      }
      if (res.code === 0) {
        Message.success(editingRule ? '修改成功' : '创建成功');
        setRuleVisible(false);
        fetchRules();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    } finally {
      setRuleLoading2(false);
    }
  };

  // ================= 异常规则：启停 / 删除 =================
  const handleRuleToggle = async (record: ExceptionRule) => {
    if (!canManage) return;
    try {
      const res = await exceptionApi.toggleExceptionRule(record.id);
      if (res.code === 0) {
        Message.success(record.status === 'enabled' ? '已停用规则' : '已启用规则');
        fetchRules();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    }
  };

  const handleRuleDelete = (record: ExceptionRule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除异常规则「${record.name}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await exceptionApi.deleteExceptionRule(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            fetchRules();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch {
          Message.error('删除失败');
        }
      },
    });
  };

  // ================= 导出 =================
  const handleExportExceptions = () => {
    if (!exportToExcel(
      `考勤异常记录_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '异常记录',
      [
        { title: '记录ID', dataIndex: 'id' },
        { title: '员工ID', dataIndex: 'employeeId' },
        { title: '工作日期', value: (r: ExceptionRecord) => formatDate(r.workDate) },
        { title: '异常类型', dataIndex: 'type' },
        { title: '异常描述', dataIndex: 'description' },
        { title: '状态', value: (r: ExceptionRecord) => exceptionStatusLabel(r.status) },
        { title: '扣款分钟', dataIndex: 'deductMinutes' },
        { title: '处理人', dataIndex: 'handledBy' },
        { title: '处理备注', dataIndex: 'remark' },
      ],
      exceptions,
    )) {
      Message.info('当前没有可导出的异常记录');
    }
  };

  const handleExportRules = () => {
    if (!exportToExcel(
      `异常规则_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '异常规则',
      [
        { title: '规则名称', dataIndex: 'name' },
        { title: '异常类型', dataIndex: 'type' },
        { title: '阈值', value: (r: ExceptionRule) => `${r.threshold}${r.thresholdMax != null ? ` ~ ${r.thresholdMax}` : ''}` },
        { title: '自动处理', value: (r: ExceptionRule) => (r.autoResolve ? '是' : '否') },
        { title: '扣款分钟', dataIndex: 'deductMinutes' },
        { title: '状态', value: (r: ExceptionRule) => (r.status === 'enabled' ? '启用' : '停用') },
        { title: '描述', dataIndex: 'description' },
      ],
      rules,
    )) {
      Message.info('当前没有可导出的异常规则');
    }
  };

  // ================= 异常记录表格列 =================
  const exceptionColumns: TableColumnProps[] = [
    { title: '员工ID', dataIndex: 'employeeId', width: 90 },
    { title: '工作日期', dataIndex: 'workDate', width: 120, render: (v) => formatDate(v) },
    { title: '异常类型', dataIndex: 'type', width: 130 },
    { title: '异常描述', dataIndex: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v) => (
        <Tag color={v === 'resolved' ? 'green' : 'orange'}>{exceptionStatusLabel(v)}</Tag>
      ),
    },
    { title: '扣款分钟', dataIndex: 'deductMinutes', width: 100, render: (v) => v ?? '--' },
    { title: '处理人', dataIndex: 'handledBy', width: 100, render: (v) => v ?? '--' },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 160,
      render: (_: any, record: ExceptionRecord) => (
        <Space>
          <Button size="small" type="text" disabled={!canManage} onClick={() => handleExceptionOpen(record)}>处理</Button>
          <Button size="small" type="text" status="danger" disabled={!canManage} onClick={() => handleExceptionDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  // ================= 异常规则表格列 =================
  const ruleColumns: TableColumnProps[] = [
    { title: '规则名称', dataIndex: 'name', width: 180 },
    { title: '异常类型', dataIndex: 'type', width: 140 },
    {
      title: '阈值',
      dataIndex: 'threshold',
      width: 140,
      render: (_: any, r: ExceptionRule) => `${r.threshold}${r.thresholdMax != null ? ` ~ ${r.thresholdMax}` : ''}`,
    },
    { title: '自动处理', dataIndex: 'autoResolve', width: 100, render: (v) => (v ? '是' : '否') },
    { title: '扣款分钟', dataIndex: 'deductMinutes', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v) => <Tag color={v === 'enabled' ? 'green' : 'gray'}>{v === 'enabled' ? '启用' : '停用'}</Tag>,
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 200,
      render: (_: any, record: ExceptionRule) => (
        <Space>
          <Button size="small" type="text" disabled={!canManage} onClick={() => handleRuleToggle(record)}>
            {record.status === 'enabled' ? '停用' : '启用'}
          </Button>
          <Button size="small" type="text" disabled={!canManage} onClick={() => handleRuleEdit(record)}>编辑</Button>
          <Button size="small" type="text" status="danger" disabled={!canManage} onClick={() => handleRuleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  // ================= 筛选栏 =================
  const renderExceptionFilter = () => (
    <div className="bg-surface border border-border-1 rounded-md p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm text-text-2 mb-1.5">状态</label>
          <Select
            value={exceptionFilters.status}
            onChange={(v) => handleExceptionFilter('status', String(v))}
            style={{ width: '100%' }}
            placeholder="全部状态"
            allowClear
          >
            <Select.Option value="pending">待处理</Select.Option>
            <Select.Option value="resolved">已处理</Select.Option>
          </Select>
        </div>
        <div>
          <label className="block text-sm text-text-2 mb-1.5">异常类型</label>
          <Input
            value={exceptionFilters.type}
            onChange={(v) => handleExceptionFilter('type', v)}
            placeholder="如 迟到"
            allowClear
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-sm text-text-2 mb-1.5">员工ID</label>
          <Input
            value={exceptionFilters.employeeId}
            onChange={(v) => handleExceptionFilter('employeeId', v)}
            placeholder="输入员工ID"
            allowClear
            style={{ width: '100%' }}
          />
        </div>
        <div>
          <label className="block text-sm text-text-2 mb-1.5">工作日期</label>
          <DatePicker
            value={exceptionFilters.workDate || undefined}
            format="YYYY-MM-DD"
            style={{ width: '100%' }}
            placeholder="选择日期"
            onChange={(v) => handleExceptionFilter('workDate', v || '')}
          />
        </div>
        <div className="flex items-end">
          <Button style={{ width: '100%' }} onClick={handleExceptionReset}>重置筛选</Button>
        </div>
      </div>
    </div>
  );

  // ================= 异常记录表单 =================
  const exceptionFormFields: FormFieldConfig[] = [
    { key: 'employeeId', label: '员工ID', type: 'input', required: true, placeholder: '请输入员工ID' },
    { key: 'workDate', label: '工作日期', type: 'date', required: true },
    { key: 'type', label: '异常类型', type: 'input', required: true, placeholder: '如 迟到、缺卡等' },
    { key: 'deductMinutes', label: '扣款分钟', type: 'input', placeholder: '如 30' },
    { key: 'description', label: '异常描述', type: 'textarea', placeholder: '可选，描述异常情况' },
  ];

  // ================= 处理异常表单 =================
  const handleFormFields: FormFieldConfig[] = [
    {
      key: 'status',
      label: '处理状态',
      type: 'select',
      required: true,
      options: [
        { value: 'resolved', label: '已处理' },
        { value: 'pending', label: '标记为待处理' },
      ],
    },
    { key: 'remark', label: '处理备注', type: 'textarea', placeholder: '可选，填写处理说明' },
  ];

  // ================= 异常规则表单 =================
  const ruleFormFields: FormFieldConfig[] = [
    { key: 'name', label: '规则名称', type: 'input', required: true, placeholder: '如 迟到扣款' },
    { key: 'type', label: '异常类型', type: 'input', required: true, placeholder: '如 迟到' },
    { key: 'threshold', label: '阈值下限', type: 'input', placeholder: '如 0' },
    { key: 'thresholdMax', label: '阈值上限', type: 'input', placeholder: '如 30（可留空）' },
    { key: 'deductMinutes', label: '扣款分钟', type: 'input', placeholder: '如 30' },
    {
      key: 'autoResolve',
      label: '自动处理',
      type: 'select',
      options: [
        { value: 'true', label: '是' },
        { value: 'false', label: '否' },
      ],
    },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      options: [
        { value: 'enabled', label: '启用' },
        { value: 'disabled', label: '停用' },
      ],
    },
    { key: 'description', label: '规则描述', type: 'textarea', placeholder: '可选' },
  ];

  return (
    <PageContainer title="考勤异常">
      <Tabs defaultActiveTab="exceptions" type="rounded" destroyOnHide>
        {/* -------- 异常记录 -------- */}
        <Tabs.TabPane key="exceptions" title={`异常记录 (${exceptionTotal})`}>
          {renderExceptionFilter()}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-2">共 {exceptionTotal} 条异常记录</span>
            <div className="flex gap-2">
              <Button onClick={handleExportExceptions}>导出 Excel</Button>
              <Button type="primary" onClick={handleExceptionAdd} disabled={!canManage}>
                + 新增异常记录
              </Button>
            </div>
          </div>
          <Spin loading={exceptionLoading} style={{ display: 'block' }}>
            {exceptionError ? (
              <div className="text-center py-16 bg-surface border border-border-1 rounded-md">
                <p className="text-text-3 mb-3">{exceptionError}</p>
                <Button onClick={() => fetchExceptions()}>重试</Button>
              </div>
            ) : (
              <Table
                columns={exceptionColumns}
                data={exceptions}
                rowKey="id"
                loading={exceptionLoading}
                noDataElement={<span className="text-text-3">暂无异常记录</span>}
                scroll={{ x: 1000 }}
              />
            )}
          </Spin>
        </Tabs.TabPane>

        {/* -------- 异常规则 -------- */}
        <Tabs.TabPane key="rules" title="异常规则">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-text-2">共 {rules.length} 条异常规则</span>
            <div className="flex gap-2">
              <Button onClick={handleExportRules}>导出 Excel</Button>
              <Button type="primary" onClick={handleRuleAdd} disabled={!canManage}>
                + 新增规则
              </Button>
            </div>
          </div>
          <Spin loading={ruleLoading} style={{ display: 'block' }}>
            {ruleError ? (
              <div className="text-center py-16 bg-surface border border-border-1 rounded-md">
                <p className="text-text-3 mb-3">{ruleError}</p>
                <Button onClick={() => fetchRules()}>重试</Button>
              </div>
            ) : (
              <Table
                columns={ruleColumns}
                data={rules}
                rowKey="id"
                loading={ruleLoading}
                noDataElement={<span className="text-text-3">暂无异常规则</span>}
                scroll={{ x: 1100 }}
              />
            )}
          </Spin>
        </Tabs.TabPane>
      </Tabs>

      {/* 新增异常记录 */}
      <ModalForm
        visible={exceptionFormVisible}
        title="新增异常记录"
        fields={exceptionFormFields}
        onOk={handleExceptionFormOk}
        onCancel={() => setExceptionFormVisible(false)}
        confirmLoading={exceptionFormLoading}
        width={520}
      />

      {/* 处理异常记录 */}
      <ModalForm
        visible={handleVisible}
        title="处理异常记录"
        fields={handleFormFields}
        initialValues={currentException ? { status: 'resolved', remark: '' } : {}}
        onOk={handleHandleOk}
        onCancel={() => { setHandleVisible(false); setCurrentException(null); }}
        confirmLoading={handleLoading}
        okText="确认处理"
        width={520}
      />

      {/* 新增/编辑异常规则 */}
      <ModalForm
        visible={ruleVisible}
        title={editingRule ? '编辑异常规则' : '新增异常规则'}
        fields={ruleFormFields}
        initialValues={editingRule ? {
          name: editingRule.name,
          type: editingRule.type,
          threshold: String(editingRule.threshold ?? 0),
          thresholdMax: editingRule.thresholdMax != null ? String(editingRule.thresholdMax) : '',
          deductMinutes: editingRule.deductMinutes ? String(editingRule.deductMinutes) : '0',
          autoResolve: String(!!editingRule.autoResolve),
          status: editingRule.status || 'enabled',
          description: editingRule.description || '',
        } : {
          autoResolve: 'false',
          status: 'enabled',
          threshold: '0',
          deductMinutes: '0',
        }}
        onOk={handleRuleFormOk}
        onCancel={() => { setRuleVisible(false); setEditingRule(null); }}
        confirmLoading={ruleLoading2}
        width={620}
      />
    </PageContainer>
  );
}