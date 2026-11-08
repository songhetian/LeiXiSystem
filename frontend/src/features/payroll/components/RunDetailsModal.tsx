'use client';

import { useState, useEffect } from 'react';
import { Modal, Table, Space, Button, Descriptions, Message, Typography } from '@arco-design/web-react';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import DataState from '@/components/DataState';
import SalaryComposition from '@/features/payroll/components/SalaryComposition';
import { useCachedData } from '@/hooks/use-cached-data';
import { payrollApi, PayrollRun, PayrollEmployeeDetail, SalaryItem } from '@/services/payroll';
import MoneyText from '@/components/MoneyText';
import { exportToExcel } from '@/lib/excel';

interface RunDetailsModalProps {
  run: PayrollRun;
  visible?: boolean;
  /** 是否具备 payroll:manage：无权限时不展示调整/确认入口（后端两个接口都要求 manage） */
  canManage: boolean;
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

/** 确认前必须抽检的员工数（与后端 confirmRunSchema 的最小人数保持一致） */
const MIN_CHECKED_EMPLOYEES = 3;

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

export default function RunDetailsModal({ run, visible = false, canManage, onCancel, onChanged }: RunDetailsModalProps) {
  const [adjustVisible, setAdjustVisible] = useState(false);
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustFormFields, setAdjustFormFields] = useState<FormFieldConfig[]>(adjustmentFields([]));
  // 确认批次前的抽检：必须勾选 ≥3 名员工（后端强校验），勾选即"人工核对过"
  const [checkedKeys, setCheckedKeys] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setCheckedKeys([]);
  }, [run.id, visible]);

  // SWR 缓存：批次明细，按 run.id 隔离
  const { data: dRes, loading, error, revalidate } = useCachedData<
    Awaited<ReturnType<typeof payrollApi.getPayrollRunDetails>>
  >(
    `payroll:run-details:${run.id}`,
    async () => {
      if (!visible) {
        return { code: 0, message: '', data: null } as unknown as Awaited<ReturnType<typeof payrollApi.getPayrollRunDetails>>;
      }
      const res = await payrollApi.getPayrollRunDetails(run.id);
      // 业务码非 0 视为失败：否则弹窗里会显示成「暂无明细」，
      // 财务会以为该批次真的没有员工数据
      if (res.code !== 0) throw new Error(res.message || '批次明细读取失败');
      return res;
    },
    { staleTime: 30_000 },
  );
  const details = dRes?.code === 0 && dRes.data ? dRes.data : null;

  // 工资项参考数据：跨组件共享缓存。失败时不能让调整表单拿到一个空下拉
  const {
    data: sRes,
    loading: salaryItemsLoading,
    error: salaryItemsError,
  } = useCachedData<
    Awaited<ReturnType<typeof payrollApi.getSalaryItems>>
  >(
    'payroll:salary-items:active',
    async () => {
      if (!visible) {
        return { code: 0, message: '', data: { list: [], total: 0, page: 1, pageSize: 20 } } as Awaited<ReturnType<typeof payrollApi.getSalaryItems>>;
      }
      // 一次取满启用项：接口已改为 {list,total} 分页信封，默认页大小 20 会截断下拉选项
      const res = await payrollApi.getSalaryItems({ status: 'active', pageSize: 100 });
      if (res.code !== 0) throw new Error(res.message || '工资项读取失败');
      return res;
    },
    { staleTime: 60_000 },
  );
  const salaryItems = sRes?.code === 0 && sRes.data ? sRes.data.list ?? [] : [];
  // 加载中不算「没有工资项」；失败或确实为空时都不允许添加调整（工资项是必填）
  const salaryItemsEmpty = !salaryItemsLoading && !salaryItemsError && salaryItems.length === 0;
  const salaryItemsBlocked = !!salaryItemsError || salaryItemsEmpty;

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

  const needMore = MIN_CHECKED_EMPLOYEES - checkedKeys.length;

  const handleConfirmRun = () => {
    Modal.confirm({
      title: '确认算薪批次',
      content: `已勾选 ${checkedKeys.length} 名员工核对。确认后 ${run.month} 批次将锁定，不能再调整薪资项。`,
      okText: '确认',
      onOk: async () => {
        setConfirming(true);
        try {
          const res = await payrollApi.confirmPayrollRun(run.id, checkedKeys);
          if (res.code !== 0) throw new Error(res.message || '确认失败');
          Message.success('确认成功');
          onChanged?.();
          // 状态已从草稿变为已确认，关闭弹窗让用户看到刷新后的列表
          onCancel();
        } catch {
          Message.error('确认失败');
        } finally {
          setConfirming(false);
        }
      },
    });
  };

  /**
   * 导出批次明细：按「员工 × 明细项」摊平导出，财务可在 Excel 里按项做对账。
   * 只读操作，不受 payroll:manage 限制。
   */
  const handleExportDetails = () => {
    const employees = details?.employees ?? [];
    const exportRows = employees.flatMap((e) => [
      ...e.items.map((item) => ({
        employeeNo: e.employee.employeeNo,
        name: e.employee.name,
        type: '工资项',
        itemName: item.name,
        amount: item.amount,
      })),
      ...e.adjustments.map((adj) => ({
        employeeNo: e.employee.employeeNo,
        name: e.employee.name,
        type: '调整项',
        itemName: adj.reason || adj.itemCode,
        amount: adj.amount,
      })),
    ]);
    const exported = exportToExcel(
      `算薪明细-${run.month}.xlsx`,
      `${run.month}明细`,
      [
        { title: '工号', dataIndex: 'employeeNo', value: (row) => row.employeeNo },
        { title: '姓名', dataIndex: 'name', value: (row) => row.name },
        { title: '类型', dataIndex: 'type', value: (row) => row.type },
        { title: '工资项', dataIndex: 'itemName', value: (row) => row.itemName },
        { title: '金额', dataIndex: 'amount', value: (row) => row.amount },
      ],
      exportRows,
    );
    if (!exported) Message.info('该批次暂无员工明细');
  };

  const columns = [
    { title: '工号', dataIndex: 'employeeNo', width: 90 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    {
      title: '合计',
      dataIndex: 'total',
      width: 110,
      align: 'center' as const,
      // 合计统一经 MoneyText → formatMoney（含千分位/两位小数/负数标红），列不再丢裸数值
      render: (v: string) => v,
    },
  ];

  const rows = (details?.employees ?? []).map((e) => ({
    key: e.employee.id,
    employeeNo: e.employee.employeeNo,
    name: e.employee.name,
    // 11.6-6：扣减大于收入时合计可能为负，负数红色标注
    total: (
      <>
        ¥ <MoneyText value={e.total} />
      </>
    ),
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
          { label: '总金额', value: <>¥ <MoneyText value={run.totalAmount} /></> },
        ]}
        column={3}
        style={{ marginBottom: 16 }}
      />
      <Space style={{ marginBottom: 12 }} wrap>
        {details && rows.length > 0 && (
          <Button size="small" onClick={handleExportDetails}>
            导出明细
          </Button>
        )}
        {details && canManage && run.status === 'draft' && (
          <>
            <Button
              type="primary"
              size="small"
              disabled={salaryItemsBlocked}
              onClick={openAdjust}
            >
              添加调整
            </Button>
            <Button
              type="primary"
              size="small"
              status="success"
              loading={confirming}
              disabled={checkedKeys.length < MIN_CHECKED_EMPLOYEES}
              onClick={handleConfirmRun}
            >
              确认批次
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {needMore > 0
                ? `确认前请勾选至少 ${MIN_CHECKED_EMPLOYEES} 名员工核对薪资（还差 ${needMore} 名）`
                : `已勾选 ${checkedKeys.length} 名员工，可确认批次`}
            </Typography.Text>
          </>
        )}
      </Space>
      {salaryItemsError && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-danger bg-danger-light px-3 py-2 text-sm text-danger"
        >
          工资项加载失败，暂时无法添加调整：{salaryItemsError}
        </div>
      )}
      {salaryItemsEmpty && canManage && run.status === 'draft' && (
        <div className="mb-3 rounded-md border border-warning bg-warning-light px-3 py-2 text-sm text-warning-text">
          暂无启用的工资项（配置为空或已全部停用），暂时无法添加调整。
        </div>
      )}
      <DataState
        loading={loading}
        error={error}
        onRetry={revalidate}
        isEmpty={!details || rows.length === 0}
        emptyText="该批次暂无员工明细"
      >
        <Table
          rowKey="key"
          columns={columns}
          data={rows}
          scroll={{ x: true }}
          pagination={false}
          expandedRowRender={expandedRowRender}
          rowSelection={
            canManage && run.status === 'draft'
              ? {
                  selectedRowKeys: checkedKeys,
                  onChange: (keys: (string | number)[]) => setCheckedKeys(keys.map(Number)),
                }
              : undefined
          }
        />
      </DataState>

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