'use client';

import { useMemo, useState } from 'react';
import { Button, Descriptions, Divider, Message, Modal, Table } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import MoneyText from '@/components/MoneyText';
import {
  payslipApi,
  PayslipDetail,
  PayslipWithEmployee,
} from '@/services/payslip';
import { payrollApi, PayrollRun } from '@/services/payroll';
import { notificationApi } from '@/services/notification';
import { useCachedData } from '@/hooks/use-cached-data';
import { useDepartments } from '@/hooks/use-departments';
import { usePermission } from '@/hooks/use-permission';
import { useSystemInfo } from '@/hooks/use-system-info';
import { formatDateTime } from '@/lib/format';
import { fetchAllPages } from '@/lib/fetch-all';
import { shiftMonth, thisMonth } from '@/lib/month';
import { buildPayslipPrintHtml, openPayslipPrintWindow, downloadPayslipHtml } from '@/lib/payslip-print';
import { SearchFieldConfig } from '@/components/SearchForm';

interface PayslipListEnvelope {
  code: number;
  message?: string;
  data?: { list: PayslipWithEmployee[]; page: number; pageSize: number; total: number };
}

const runStatusLabels: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  published: '已发布',
  recalled: '已撤回',
};

const statusMap: Record<string, { label: string; color: string }> = {
  unviewed: { label: '未查看', color: 'arcoblue' },
  viewed: { label: '已查看', color: 'gray' },
};

/**
 * 管理端工资条列表（只读 + 详情核对）。
 *
 * 员工端的「我的工资条」只看得到自己；HR 需要跨员工核对发放情况、
 * 找出还没查看的人去催办，因此这里按 批次/月份/查看状态/部门 筛选，
 * 支持导出台账、点开某人某月看明细，并在有通知权限时一键催办。
 * 不提供编辑动作——工资条是计算结果，要改金额必须回到算薪批次或调整项。
 */
export default function PayslipsPage() {
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const { departments } = useDepartments();
  const { can } = usePermission();
  const { info: systemInfo } = useSystemInfo();

  // 批次下拉：只在需要筛选时取最近 100 个批次，避免下拉里出现历史全部数据
  const { data: runsRes } = useCachedData<{ code: number; data?: { list: PayrollRun[] } }>(
    'payroll:runs:options',
    () => payrollApi.getPayrollRuns({ page: 1, pageSize: 100 }),
    { staleTime: 60_000 },
  );
  const runOptions = useMemo(() => {
    const list = runsRes?.code === 0 && runsRes.data ? runsRes.data.list : [];
    return list.map((run) => ({
      value: run.id,
      label: `${run.month} · ${runStatusLabels[run.status] ?? run.status}`,
    }));
  }, [runsRes]);

  const searchFields = useMemo<SearchFieldConfig[]>(
    () => [
      {
        key: 'month',
        label: '月份',
        type: 'month',
        placeholder: '请选择月份',
        // 与员工端同一套快捷预设，省去每月重复点日历
        presets: [
          { label: '本月', value: thisMonth() },
          { label: '上月', value: shiftMonth(thisMonth(), -1) },
        ],
      },
      {
        key: 'status',
        // 「未查看」即待催办名单：筛出来导出或直接催办
        label: '查看状态',
        type: 'select',
        placeholder: '请选择查看状态',
        options: [
          { value: 'unviewed', label: '未查看' },
          { value: 'viewed', label: '已查看' },
        ],
      },
      {
        key: 'departmentId',
        label: '部门',
        type: 'select',
        placeholder: '请选择部门',
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      },
      {
        key: 'runId',
        label: '算薪批次',
        type: 'select',
        placeholder: '请选择批次',
        options: runOptions,
      },
    ],
    [departments, runOptions],
  );

  // SWR 缓存：参数编入 cacheKey，筛选/翻页自动重新订阅；同参数复用缓存
  const cacheKey = `payroll:payslips:${JSON.stringify({
    page: pagination.current,
    pageSize: pagination.pageSize,
    search: searchParams,
  })}`;
  const { data: res, loading, error, revalidate } = useCachedData<PayslipListEnvelope>(
    cacheKey,
    async () => {
      const result = await payslipApi.getPayslips({
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...searchParams,
      });
      // 业务码非 0 视为失败，否则表格会显示成「暂无数据」
      if (result.code !== 0) throw new Error(result.message || '工资条列表读取失败');
      return result;
    },
    { staleTime: 30_000 },
  );

  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult =
    res?.code === 0 && res.data
      ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
      : pagination;

  // 详情按 id 缓存；弹窗关闭后仍保留，重复打开同一张工资条无需再请求
  const { data: detailRes, loading: detailLoading } = useCachedData<{
    code: number;
    message?: string;
    data?: PayslipDetail;
  }>(
    `payroll:payslip-detail:${detailId ?? 'none'}`,
    async () => {
      if (detailId === null) return { code: -1 };
      const result = await payslipApi.getPayslipDetail(detailId);
      if (result.code !== 0) throw new Error(result.message || '获取工资条详情失败');
      return result;
    },
    { staleTime: 30_000 },
  );
  const detail = detailRes?.code === 0 ? detailRes.data : undefined;

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleView = (id: number) => {
    setDetailId(id);
    setDetailVisible(true);
  };

  /** 打印 / 另存 PDF：与员工端共用同一份打印稿，口径一致 */
  const handlePrint = () => {
    if (!detail) return;
    const html = buildPayslipPrintHtml(detail, {
      companyName: systemInfo.name,
      logoUrl: systemInfo.logoUrl || undefined,
    });
    if (!openPayslipPrintWindow(html)) {
      Message.warning('浏览器拦截了打印窗口，请允许本站弹出窗口后重试');
    }
  };

  const handleDownload = () => {
    if (!detail) return;
    const html = buildPayslipPrintHtml(detail, {
      companyName: systemInfo.name,
      logoUrl: systemInfo.logoUrl || undefined,
    });
    downloadPayslipHtml(
      html,
      `工资条-${detail.month}-${detail.employeeName || detail.employeeNo || '员工'}.html`,
    );
  };

  /**
   * 按给定筛选条件翻页拉全量工资条（后端 pageSize 上限 100，不能只处理第一页）。
   * 导出与催办共用，避免「看起来成功、实际只处理了前 100 人」的静默漏数据。
   */
  const fetchAllPayslips = async (
    params: Record<string, any> = {},
  ): Promise<PayslipWithEmployee[]> =>
    fetchAllPages<PayslipWithEmployee>(async (page, pageSize) => {
      const result = await payslipApi.getPayslips({ ...params, page, pageSize });
      if (result.code !== 0) throw new Error(result.message || '工资条台账读取失败');
      return { list: result.data?.list ?? [], total: result.data?.total ?? 0 };
    });

  /**
   * 一键催办：在当前筛选条件下（强制叠加「未查看」）取全部未读工资条，
   * 按员工 userId 发站内通知。仅具备通知发送权限的用户可见此入口。
   */
  const handleNotifyUnviewed = async () => {
    setNotifying(true);
    try {
      const list = await fetchAllPayslips({ ...searchParams, status: 'unviewed' });
      const userIds = Array.from(
        new Set(
          list
            .map((row) => row.employee?.userId)
            .filter((id): id is number => typeof id === 'number'),
        ),
      );
      if (userIds.length === 0) {
        Message.info('当前筛选下没有未查看的工资条');
        return;
      }
      const sent = await notificationApi.send({
        title: '工资条待查看提醒',
        content: `您有 ${searchParams.month || '最新一期'} 的工资条尚未查看，请登录系统进入「我的工资条」查看。`,
        targetType: 'user',
        userIds,
      });
      if (sent.code !== 0) throw new Error(sent.message || '催办通知发送失败');
      Message.success(`已向 ${userIds.length} 人发送提醒`);
    } catch (err) {
      Message.error((err as Error).message || '催办失败');
    } finally {
      setNotifying(false);
    }
  };

  const itemColumns = [
    { title: '项目', dataIndex: 'name' },
    {
      title: '金额',
      dataIndex: 'amount',
      align: 'right' as const,
      render: (value: unknown) => <MoneyText value={value} />,
    },
  ];

  const columns: ProTableColumn[] = [
    { title: '月份', dataIndex: 'month', width: 110 },
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 120,
      render: (_: unknown, record: PayslipWithEmployee) => record.employee?.employeeNo || '--',
    },
    {
      title: '姓名',
      dataIndex: 'employeeName',
      width: 120,
      render: (_: unknown, record: PayslipWithEmployee) => record.employee?.name || '--',
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 140,
      render: (_: unknown, record: PayslipWithEmployee) => record.employee?.department?.name || '--',
    },
    {
      // 实发 = 批次落库的 total_amount（已含调整项），与员工端「实发工资」同一口径
      title: '实发工资',
      dataIndex: 'totalAmount',
      width: 130,
      render: (value: unknown) => (
        <span className="lx-payslip-net">
          <MoneyText value={value} />
        </span>
      ),
    },
    {
      title: '查看状态',
      dataIndex: 'status',
      width: 110,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    {
      title: '查看时间',
      dataIndex: 'viewedAt',
      width: 170,
      render: (value: unknown) => (value ? formatDateTime(value) : '--'),
    },
    {
      title: '发放时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (value: unknown) => formatDateTime(value),
    },
    {
      title: '操作',
      dataIndex: 'id',
      width: 90,
      render: (value: number) => (
        <Button type="text" size="small" onClick={() => handleView(value)}>
          查看
        </Button>
      ),
    },
  ];

  const incomeItems = detail?.items?.filter((i) => i.type === 'income') ?? [];
  const deductionItems = detail?.items?.filter((i) => i.type === 'deduction') ?? [];
  const adjustmentItems = detail?.adjustments ?? [];

  return (
    <PageContainer>
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
        pagination={pageResult}
        onPageChange={(page, pageSize) => setPagination({ current: page, pageSize, total: pageResult.total })}
        // 台账导出：全量（不限当前页），未查看名单可拿去逐个跟进
        showExport
        exportFilename={`工资条台账${searchParams.month ? `-${searchParams.month}` : ''}.csv`}
        onExportAll={() => fetchAllPayslips(searchParams)}
        toolbar={
          can('system:notification:send')
            ? [
                {
                  key: 'notify-unviewed',
                  label: '催办未查看人员',
                  type: 'primary',
                  loading: notifying,
                  onClick: handleNotifyUnviewed,
                },
              ]
            : undefined
        }
      />

      <Modal
        title={`工资条明细${detail ? ` · ${detail.month}` : ''}`}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <div className="lx-payslip-modal-footer">
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            <Button disabled={detailLoading || !detail} onClick={handleDownload}>
              下载工资条
            </Button>
            <Button type="primary" disabled={detailLoading || !detail} onClick={handlePrint}>
              打印 / 另存 PDF
            </Button>
          </div>
        }
        style={{ width: 720 }}
        unmountOnExit
      >
        {detailLoading ? (
          <div className="lx-payslip-detail-loading">加载中…</div>
        ) : detail ? (
          <>
            <Descriptions
              column={2}
              data={[
                { label: '工号', value: detail.employeeNo || '--' },
                { label: '姓名', value: detail.employeeName || '--' },
                { label: '部门', value: detail.departmentName || '--' },
                { label: '发放时间', value: formatDateTime(detail.createdAt) },
              ]}
            />
            <Divider />
            <div className="lx-payslip-summary">
              <div className="lx-payslip-summary-item">
                <span>应发合计</span>
                <MoneyText value={detail.totalIncome} />
              </div>
              <div className="lx-payslip-summary-item">
                <span>扣款合计</span>
                <MoneyText value={detail.totalDeduction} />
              </div>
              <div className="lx-payslip-summary-item">
                <span>实发工资</span>
                <span className="lx-payslip-net">
                  <MoneyText value={detail.netSalary} />
                </span>
              </div>
            </div>
            <Divider />
            {incomeItems.length > 0 && (
              <>
                <h4 className="lx-payslip-section-title">收入明细</h4>
                <Table
                  columns={itemColumns}
                  data={incomeItems}
                  rowKey="code"
                  pagination={false}
                  size="small"
                  border={false}
                />
              </>
            )}
            {deductionItems.length > 0 && (
              <>
                <h4 className="lx-payslip-section-title">扣款明细</h4>
                <Table
                  columns={itemColumns}
                  data={deductionItems}
                  rowKey="code"
                  pagination={false}
                  size="small"
                  border={false}
                />
              </>
            )}
            {adjustmentItems.length > 0 && (
              <>
                <h4 className="lx-payslip-section-title">调整项</h4>
                <Table
                  columns={itemColumns}
                  data={adjustmentItems}
                  rowKey="code"
                  pagination={false}
                  size="small"
                  border={false}
                />
              </>
            )}
          </>
        ) : (
          <div className="lx-payslip-detail-loading">暂无数据</div>
        )}
      </Modal>
    </PageContainer>
  );
}
