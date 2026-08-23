'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Message,
  Modal,
  Button,
  Table,
  Tag,
  Space,
  Spin,
} from '@arco-design/web-react';
import type { TableColumnProps } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import {
  deductionApi,
  DeductionRule,
} from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

/** 扣款方式中文映射（固定 / 比例 / 倍数） */
function methodLabel(method?: string): string {
  if (!method) return '--';
  const v = String(method);
  if (v === 'fixed' || v === '固定') return '固定';
  if (v === 'percentage' || v === 'percent' || v === '比例') return '比例';
  if (v === 'multiplier' || v === 'times' || v === '倍数') return '倍数';
  return v;
}

/** 关联假别中文映射（leaveType 为业务别名，前端展示） */
function leaveTypeLabel(leaveType?: string | null): string {
  const map: Record<string, string> = {
    annual: '年假',
    sick: '病假',
    personal: '事假',
    marriage: '婚假',
    maternity: '产假',
    paternity: '陪产假',
    compensatory: '调休',
    other: '其他',
  };
  if (!leaveType) return '--';
  return map[leaveType] || leaveType;
}

export default function DeductionRulesPage() {
  const { can } = usePermission();
  const canManage = can('attendance:deduction:manage');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DeductionRule[]>([]);
  const [total, setTotal] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<DeductionRule | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await deductionApi.listDeductionRules();
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setTotal(res.data.total);
      } else {
        setError(res.message || '获取扣款规则失败');
        Message.error(res.message || '获取扣款规则失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取扣款规则失败');
      notifyError(e, '获取扣款规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAdd = () => {
    setEditingRule(null);
    setModalVisible(true);
  };

  const handleEdit = (record: DeductionRule) => {
    setEditingRule(record);
    setModalVisible(true);
  };

  const handleDelete = (record: DeductionRule) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除扣款规则「${record.name}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await deductionApi.deleteDeductionRule(record.id);
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

  const handleModalOk = async (values: Record<string, any>) => {
    setModalLoading(true);
    try {
      const dto: any = {
        name: String(values.name).trim(),
        type: String(values.type).trim(),
        method: String(values.method),
        amount: values.amount !== '' && values.amount != null ? Number(values.amount) : null,
        percentage: values.percentage !== '' && values.percentage != null ? Number(values.percentage) : null,
        multiplier: values.multiplier !== '' && values.multiplier != null ? Number(values.multiplier) : null,
        leaveType: values.leaveType || null,
        enabled: String(values.enabled) === 'true',
        description: values.description || undefined,
      };
      let res;
      if (editingRule) {
        res = await deductionApi.updateDeductionRule(editingRule.id, dto);
      } else {
        res = await deductionApi.createDeductionRule(dto);
      }
      if (res.code === 0) {
        Message.success(editingRule ? '修改成功' : '创建成功');
        setModalVisible(false);
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
    setEditingRule(null);
  };

  // 导出当前扣款规则
  const handleExport = () => {
    if (!exportToExcel(
      `扣款规则_${new Date().toISOString().slice(0, 10)}.xlsx`,
      '扣款规则',
      [
        { title: '规则名称', dataIndex: 'name' },
        { title: '规则类型', dataIndex: 'type' },
        { title: '扣款方式', value: (r: DeductionRule) => methodLabel(r.method) },
        { title: '金额(元)', dataIndex: 'amount' },
        { title: '百分比(%)', dataIndex: 'percentage' },
        { title: '倍数', dataIndex: 'multiplier' },
        { title: '关联假别', value: (r: DeductionRule) => leaveTypeLabel(r.leaveType) },
        { title: '状态', value: (r: DeductionRule) => (r.enabled ? '启用' : '停用') },
        { title: '描述', dataIndex: 'description' },
      ],
      data,
    )) {
      Message.info('当前没有可导出的扣款规则');
    }
  };

  const columns: TableColumnProps[] = [
    { title: '规则名称', dataIndex: 'name', width: 180 },
    { title: '规则类型', dataIndex: 'type', width: 140 },
    { title: '扣款方式', dataIndex: 'method', width: 100, render: (v) => methodLabel(v) },
    { title: '金额(元)', dataIndex: 'amount', width: 100, render: (v) => (v != null ? v : '--') },
    { title: '百分比(%)', dataIndex: 'percentage', width: 110, render: (v) => (v != null ? v : '--') },
    { title: '倍数', dataIndex: 'multiplier', width: 80, render: (v) => (v != null ? v : '--') },
    { title: '关联假别', dataIndex: 'leaveType', width: 100, render: (v) => leaveTypeLabel(v) },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 90,
      render: (v) => <Tag color={v ? 'green' : 'gray'}>{v ? '启用' : '停用'}</Tag>,
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: (_: any, record: DeductionRule) => (
        <Space>
          <Button size="small" type="text" disabled={!canManage} onClick={() => handleEdit(record)}>编辑</Button>
          <Button size="small" type="text" status="danger" disabled={!canManage} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  // 扣款规则表单
  const formFields: FormFieldConfig[] = [
    { key: 'name', label: '规则名称', type: 'input', required: true, placeholder: '如 迟到扣款' },
    { key: 'type', label: '规则类型', type: 'input', required: true, placeholder: '如 迟到、早退等' },
    {
      key: 'method',
      label: '扣款方式',
      type: 'select',
      required: true,
      options: [
        { value: 'fixed', label: '固定' },
        { value: 'percentage', label: '比例' },
        { value: 'multiplier', label: '倍数' },
      ],
    },
    { key: 'amount', label: '金额(元)', type: 'input', placeholder: '固定方式填金额，如 50' },
    { key: 'percentage', label: '百分比(%)', type: 'input', placeholder: '比例方式填百分比，如 10' },
    { key: 'multiplier', label: '倍数', type: 'input', placeholder: '倍数方式填倍数，如 1.5' },
    {
      key: 'leaveType',
      label: '关联假别',
      type: 'select',
      options: [
        { value: 'annual', label: '年假' },
        { value: 'sick', label: '病假' },
        { value: 'personal', label: '事假' },
        { value: 'marriage', label: '婚假' },
        { value: 'maternity', label: '产假' },
        { value: 'paternity', label: '陪产假' },
        { value: 'compensatory', label: '调休' },
        { value: 'other', label: '其他' },
      ],
    },
    {
      key: 'enabled',
      label: '启用状态',
      type: 'select',
      options: [
        { value: 'true', label: '启用' },
        { value: 'false', label: '停用' },
      ],
    },
    { key: 'description', label: '规则描述', type: 'textarea', placeholder: '可选' },
  ];

  return (
    <PageContainer title="扣款规则">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-text-2">共 {total} 条扣款规则</span>
        <div className="flex gap-2">
          <Button onClick={handleExport}>导出 Excel</Button>
          <Button type="primary" onClick={handleAdd} disabled={!canManage}>
            + 新增扣款规则
          </Button>
        </div>
      </div>

      <Spin loading={loading} style={{ display: 'block' }}>
        {error ? (
          <div className="text-center py-16 bg-surface border border-border-1 rounded-md">
            <p className="text-text-3 mb-3">{error}</p>
            <Button onClick={() => fetchList()}>重试</Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={data}
            rowKey="id"
            loading={loading}
            noDataElement={<span className="text-text-3">暂无扣款规则</span>}
            scroll={{ x: 1200 }}
          />
        )}
      </Spin>

      <ModalForm
        visible={modalVisible}
        title={editingRule ? '编辑扣款规则' : '新增扣款规则'}
        fields={formFields}
        initialValues={editingRule ? {
          name: editingRule.name,
          type: editingRule.type,
          method: editingRule.method || 'fixed',
          amount: editingRule.amount != null ? String(editingRule.amount) : '',
          percentage: editingRule.percentage != null ? String(editingRule.percentage) : '',
          multiplier: editingRule.multiplier != null ? String(editingRule.multiplier) : '',
          leaveType: editingRule.leaveType || '',
          enabled: String(!!editingRule.enabled),
          description: editingRule.description || '',
        } : {
          method: 'fixed',
          enabled: 'true',
        }}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={modalLoading}
        width={620}
      />
    </PageContainer>
  );
}