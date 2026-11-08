'use client';

import { useState } from 'react';
import { Message, Space, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { payrollApi, PayrollRun } from '@/services/payroll';
import { SearchFieldConfig } from '@/components/SearchForm';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { formatDateTime, formatMoney } from '@/lib/format';
import RunDetailsModal from '@/features/payroll/components/RunDetailsModal';

interface RunListEnvelope {
  code: number;
  message?: string;
  data?: { list: PayrollRun[]; page: number; pageSize: number; total: number };
}

const searchFields: SearchFieldConfig[] = [
  // 月份用月选择器：手输 YYYY-MM 容易写成 2026-8 / 2026/08，查不到数据
  { key: 'month', label: '月份', type: 'month', placeholder: '请选择月份' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'draft', label: '草稿' },
      { value: 'confirmed', label: '已确认' },
      { value: 'published', label: '已发布' },
      { value: 'recalled', label: '已撤回' },
    ],
  },
];

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'arcoblue' },
  confirmed: { label: '已确认', color: 'green' },
  published: { label: '已发布', color: 'purple' },
  recalled: { label: '已撤回', color: 'gray' },
};

const createFormFields: FormFieldConfig[] = [
  {
    key: 'month',
    label: '月份',
    // 月选择器：手输月份格式不统一（2026-8 / 2026/08）会直接建出查不到的批次
    type: 'month',
    placeholder: '请选择月份',
    required: true,
  },
  {
    key: 'remark',
    label: '备注',
    type: 'input',
    placeholder: '请输入备注（选填）',
  },
];

export default function PayrollRunsPage() {
  const { can } = usePermission();
  // 后端 create/confirm/publish/recall 均要求 payroll:manage；
  // 11.6-3：无权限的写操作按钮一律不渲染（而非 disabled）
  const canManage = can('payroll:manage');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [detailRun, setDetailRun] = useState<PayrollRun | null>(null);

  // SWR 缓存：翻页/搜索参数编入 cacheKey，同参数复用缓存
  const cacheKey = `payroll:runs:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<RunListEnvelope>(
    cacheKey,
    async () => {
      const envelope = await payrollApi.getPayrollRuns({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...searchParams,
      });
      // 业务码非 0 视为失败，避免失败被渲染成「暂无核算批次」
      if (envelope.code !== 0) throw new Error(envelope.message || '核算批次读取失败');
      return envelope;
    },
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ ...pageResult, current: page, pageSize });
  };

  const handleCreate = () => {
    setCreateModalVisible(true);
  };

  const handleCreateCancel = () => {
    setCreateModalVisible(false);
  };

  const handleCreateOk = async (values: Record<string, any>) => {
    setCreateLoading(true);
    try {
      const result = await payrollApi.createPayrollRun({
        month: values.month,
        remark: values.remark,
      });
      if (result.code === 0) {
        Message.success('创建成功');
        setCreateModalVisible(false);
        revalidate();
      } else {
        Message.error(result.message || '创建失败');
      }
    } catch {
      Message.error('创建失败');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewDetails = (record: PayrollRun) => {
    setDetailRun(record);
  };

  const handlePublish = async (record: PayrollRun) => {
    try {
      const result = await payrollApi.publishPayrollRun(record.id);
      if (result.code === 0) {
        Message.success('发布成功');
        revalidate();
      } else {
        Message.error(result.message || '发布失败');
      }
    } catch {
      Message.error('发布失败');
    }
  };

  const handleRecall = async (record: PayrollRun) => {
    try {
      const result = await payrollApi.recallPayrollRun(record.id);
      if (result.code === 0) {
        Message.success('撤回成功');
        revalidate();
      } else {
        Message.error(result.message || '撤回失败');
      }
    } catch {
      Message.error('撤回失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '月份', dataIndex: 'month', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    { title: '员工数', dataIndex: 'totalEmployees', width: 100, align: 'center' },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      width: 140,
      align: 'center',
      render: (v: unknown) => `¥ ${formatMoney(v)}`,
    },
    { title: '创建人', dataIndex: 'createdByName', width: 120 },
    { title: '创建时间', dataIndex: 'createdAt', width: 200, render: (v: unknown) => formatDateTime(v) },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 280,
      render: (_: any, record: PayrollRun) => (
        <Space>
          <Button type="text" size="mini" onClick={() => handleViewDetails(record)}>
            明细
          </Button>
          {canManage && record.status === 'draft' && (
            // 确认必须先抽检 ≥3 名员工（后端强校验），所以入口指向批次明细里的勾选确认
            <Button
              type="text"
              size="mini"
              status="success"
              onClick={() => handleViewDetails(record)}
            >
              核对确认
            </Button>
          )}
          {canManage && record.status === 'confirmed' && (
            <ConfirmButton
              type="text"
              size="mini"
              status="success"
              title="发布工资条"
              content={`发布后 ${record.month} 批次的工资条将推送给 ${record.totalEmployees} 名员工，员工可见即不可再修改。确定发布吗？`}
              okText="发布"
              onConfirm={() => handlePublish(record)}
            >
              发布
            </ConfirmButton>
          )}
          {canManage && record.status === 'published' && (
            <ConfirmButton
              type="text"
              size="mini"
              status="warning"
              title="撤回工资条"
              content={`确定撤回 ${record.month} 批次吗？撤回后员工将无法查看该月工资条，需重新发布。`}
              okText="撤回"
              onConfirm={() => handleRecall(record)}
            >
              撤回
            </ConfirmButton>
          )}
        </Space>
      ),
    },
  ];

  // 11.6-3：无 payroll:manage 时工具栏不出现「创建批次」入口
  const toolbar: ProTableToolbarAction[] = canManage
    ? [{ key: 'create', label: '创建批次', type: 'primary', onClick: handleCreate }]
    : [];

  return (
    <PageContainer >
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pageResult}
        onPageChange={handlePageChange}
      />
      <ModalForm
        visible={createModalVisible}
        title="创建算薪批次"
        fields={createFormFields}
        onOk={handleCreateOk}
        onCancel={handleCreateCancel}
        confirmLoading={createLoading}
      />
      {detailRun && (
        <RunDetailsModal
          run={detailRun}
          visible={!!detailRun}
          canManage={canManage}
          onCancel={() => setDetailRun(null)}
          onChanged={revalidate}
        />
      )}
    </PageContainer>
  );
}
