'use client';

import { useState, useEffect } from 'react';
import { Modal, Table, Space, Button, Descriptions, Message } from '@arco-design/web-react';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import SalaryComposition from '@/features/payroll/components/SalaryComposition';
import { useCachedData } from '@/hooks/use-cached-data';
import { payrollApi, PayrollRun, PayrollEmployeeDetail, SalaryItem } from '@/services/payroll';

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

export default function RunDetailsModal({ run, visible = false, onCancel, onChanged }: RunDetailsModalProps) {
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustFormFields, setAdjustFormFields] = useState<FormFieldConfig[]>(adjustmentFields([]));

  // SWR 缓存：批次明细，按 run.id 隔离
  const { data: dRes, loading, revalidate } = useCachedData<
    Awaited<ReturnType<typeof payrollApi.getPayrollRunDetails>>
  >(
    `payroll:run-details:${run.id}`,
    () => (visible
      ? payrollApi.getPayrollRunDetails(run.id)
      : Promise.resolve({ code: 0, message: '', data: null } as unknown as Awaited<ReturnType<typeof payrollApi.getPayrollRunDetails>>)
    ),
    { staleTime: 30_000 },
  );
  const details = dRes?.code === 0 && dRes.data ? dRes.data : null;

  // 工资项参考数据：跨组件共享缓存
  const { data: sRes } = useCachedData<
    Awaited<ReturnType<typeof payrollApi.getSalaryItems>>
  >(
    'payroll:salary-items:active',
    () => (visible
      ? payrollApi.getSalaryItems({ status: 'active' })
      : Promise.resolve({ code: 0, message: '', data: { list: [], total: 0, page: 1, pageSize: 20 } } as Awaited<ReturnType<typeof payrollApi.getSalaryItems>>)
    ),
    { staleTime: 60_000 },
  );
  const salaryItems = sRes?.code === 0 && sRes.data ? sRes.data.list ?? [] : [];

  // 工资项就绪后用默认项生成调整表单字段；依赖服务端 res 引用避免空数组字面量死循环
  useEffect(() => {
    if (!sRes || sRes.code !== 0 || !sRes.data) return;
    setAdjustFormFields(adjustmentFields(salaryItems));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sRes]);

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
        revalidate();
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
      <div className="lx-salary-expand" data-testid="detail-expand">
        <SalaryComposition items={d.items} adjustments={d.adjustments} total={d.total} />
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
        columns={columns}
        data={rows}
        scroll={{ x: true }}
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