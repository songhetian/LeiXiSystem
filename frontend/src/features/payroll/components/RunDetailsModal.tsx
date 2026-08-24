'use client';

import { useState, useEffect } from 'react';
import { Modal, Table, Space, Button, Tag, Descriptions, Message } from '@arco-design/web-react';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { payrollApi, PayrollRun, PayrollRunDetails, PayrollEmployeeDetail, SalaryItem } from '@/services/payroll';

interface RunDetailsModalProps {
  run: PayrollRun;
  visible?: boolean;
  onCancel: () => void;
  /** 调整成功后通知父级刷新列表 */
  onChanged?: () => void;
}

const statusMapText: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  published: '已发布',
  recalled: '已撤回',
};

const adjustmentFields = (salaryItems: SalaryItem[]): FormFieldConfig[] => [
  {
    key: 'employeeId',
    label: '员工ID',
    type: 'select',
    required: true,
    placeholder: '选择员工（取批次明细中员工）',
  },
  {
    key: 'itemCode',
    label: '调整项',
    type: 'select',
    required: true,
    placeholder: '选择工资项或输入编码',
    options: [
      ...salaryItems
        .filter((s) => s.status === 'active')
        .map((s) => ({ value: s.code, label: s.name })),
      { value: 'penalty', label: '扣款（penalty）' },
      { value: 'bonus', label: '奖金（bonus）' },
    ],
  },
  {
    key: 'amount',
    label: '金额',
    type: 'input',
    required: true,
    placeholder: '正数为增加，负数为扣减',
  },
  {
    key: 'reason',
    label: '原因',
    type: 'textarea',
    required: true,
    placeholder: '请输入调整原因',
  },
];

function amountValue(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

export default function RunDetailsModal({ run, visible = false, onCancel, onChanged }: RunDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<PayrollRunDetails | null>(null);
  const [salaryItems, setSalaryItems] = useState<SalaryItem[]>([]);
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustFormFields, setAdjustFormFields] = useState<FormFieldConfig[]>(adjustmentFields([]));

  const fetchDetails = async () => {
    if (!visible) return;
    setLoading(true);
    setDetails(null);
    try {
      const res = await payrollApi.getPayrollRunDetails(run.id);
      if (res.code === 0 && res.data) setDetails(res.data);
      else Message.error(res.message || '加载明细失败');
    } catch {
      Message.error('加载明细失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    fetchDetails();
    payrollApi.getSalaryItems({ status: 'active' }).then((res) => {
      if (res.code === 0 && res.data) setSalaryItems(res.data.list ?? []);
    }).catch(() => {
      // 工资项加载失败不回退，使用缺省调整项
    });
  }, [visible, run.id]);

  useEffect(() => {
    setAdjustFormFields(adjustmentFields(salaryItems));
  }, [salaryItems]);

  const openAdjust = () => {
    const employees = details?.employees ?? [];
    const fieldsWithEmployees = adjustmentFields(salaryItems).map((f) =>
      f.key === 'employeeId'
        ? {
            ...f,
            options: employees.map((e: PayrollEmployeeDetail) => ({
              value: e.employee.id,
              label: `${e.employee.employeeNo} ${e.employee.name}`,
            })),
          }
        : f,
    );
    setAdjustFormFields(fieldsWithEmployees);
    setAdjustVisible(true);
  };

  const handleAdjustOk = async (values: Record<string, any>) => {
    setAdjustLoading(true);
    try {
      const itemName = salaryItems.find((s) => s.code === values.itemCode)?.name || values.itemCode;
      const res = await payrollApi.adjustPayrollRun(run.id, {
        employeeId: Number(values.employeeId),
        itemCode: values.itemCode,
        itemName,
        amount: Number(values.amount),
        reason: values.reason,
      });
      if (res.code === 0) {
        Message.success('调整成功');
        setAdjustVisible(false);
        onChanged?.();
        fetchDetails();
      } else {
        Message.error(res.message || '调整失败');
      }
    } catch {
      Message.error('调整失败');
    } finally {
      setAdjustLoading(false);
    }
  };

  const columns = [
    { title: '工号', dataIndex: 'employeeNo', width: 90 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '合计', dataIndex: 'total', width: 110 },
  ];

  const rows = (details?.employees ?? []).map((e) => ({
    key: e.employee.id,
    employeeNo: e.employee.employeeNo,
    name: e.employee.name,
    total: e.total,
    _detail: e,
  }));

  const expandedRowRender = (row: any) => {
    const d: PayrollEmployeeDetail = row._detail;
    return (
      <div data-testid="detail-expand" style={{ padding: '0 24px 8px' }}>
        <Descriptions
          title="工资构成"
          layout="horizontal"
          data={[
            ...d.items.map((it) => ({ label: it.name, value: `${it.amount}` })),
            ...d.adjustments.map((a) => ({
              label: `调整 · ${a.reason}`,
              value: amountValue(a.amount),
            })),
          ]}
          column={2}
        />
        {d.adjustments.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Tag color="orange">调整项 {d.adjustments.length}</Tag>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title={`批次明细 · ${run.month}`}
      visible={visible}
      onCancel={onCancel}
      footer={null}
      style={{ width: 720, maxWidth: '92vw' }}
    >
      <Descriptions
        data={[
          { label: '批次状态', value: statusMapText[run.status] ?? run.status },
          { label: '员工数', value: `${run.totalEmployees}` },
          { label: '总金额', value: `${run.totalAmount}` },
        ]}
        column={3}
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 12 }}>
        {run.status === 'draft' && (
          <Button type="primary" size="small" onClick={openAdjust}>
            添加调整
          </Button>
        )}
      </Space>
      <Table
        rowKey="key"
        loading={loading}
        columns={columns as any}
        data={rows}
        pagination={false}
        expandedRowRender={expandedRowRender}
      />

      <ModalForm
        visible={adjustVisible}
        title="添加调整项"
        fields={adjustFormFields}
        onOk={handleAdjustOk}
        onCancel={() => setAdjustVisible(false)}
        confirmLoading={adjustLoading}
        okText="确定"
        cancelText="取消"
      />
    </Modal>
  );
}