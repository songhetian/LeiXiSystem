'use client';

import { useMemo, useState } from 'react';
import { Message, Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { attendanceApi, VacationBalance } from '@/services/attendance';
import { useCachedData } from '@/hooks/use-cached-data';
import { exportToExcel } from '@/lib/excel';
import { todayStr, getTzParts } from '@/lib/format';

interface BalanceEnvelope {
  code: number;
  message?: string;
  data?: VacationBalance[];
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} 月`,
}));

/** 月份筛选（客户端过滤，不额外请求）：走 ProTable 标准搜索区，与全站列表页一致 */
const searchFields: SearchFieldConfig[] = [
  {
    key: 'month',
    label: '月份',
    type: 'select',
    placeholder: '全部月份',
    allLabel: '全部月份',
    options: MONTH_OPTIONS,
  },
];

/** month=0 表示非月假的年度整户额度，其余为月假当月额度 */
function monthText(month?: number | null) {
  return !month ? '全年' : `${month} 月`;
}

export default function VacationBalancePage() {
  // 年度按北京时间取：宿主机在 UTC 等时区时，元旦早晨会取到上一年
  const year = Number(getTzParts(new Date()).Y);
  const [monthFilter, setMonthFilter] = useState<number | undefined>(undefined);

  // SWR 缓存：切出再切回本页直接复用缓存；失败时 error 交由 ProTable 展示 + 重试
  const { data: res, loading, error, revalidate } = useCachedData<BalanceEnvelope>(
    `vacation:balances:${year}`,
    async () => {
      const envelope = await attendanceApi.getMyBalances({ year });
      // 业务码非 0 视为失败，避免把失败展示成「暂无休假额度」
      if (envelope.code !== 0) throw new Error(envelope.message || '休假额度读取失败');
      return envelope;
    },
    { staleTime: 30_000 },
  );
  const allBalances = res?.code === 0 && res.data ? res.data : [];
  // 月假按月建额度，同类型会有 12 行，故按月筛选区分
  const balances = useMemo(
    () => (monthFilter ? allBalances.filter((b) => b.month === monthFilter) : allBalances),
    [allBalances, monthFilter],
  );

  // 导出休假额度到 Excel
  const handleExport = () => {
    if (!exportToExcel(
      `休假额度_${todayStr()}.xlsx`,
      '休假额度',
      [
        { title: '假期类型', value: (r: VacationBalance) => r.vacationType?.name ?? '' },
        { title: '年度', dataIndex: 'year' },
        { title: '月份', value: (r: VacationBalance) => monthText(r.month) },
        { title: '总天数', dataIndex: 'totalDays' },
        { title: '已用', dataIndex: 'usedDays' },
        { title: '剩余', value: (r: VacationBalance) => (Number(r.totalDays) - Number(r.usedDays)).toFixed(1) },
      ],
      balances,
    )) {
      Message.info('当前没有可导出的休假额度数据');
    }
  };

  const balanceColumns: ProTableColumn[] = [
    { title: '假期类型', dataIndex: 'vacationTypeName', width: 140, render: (_: any, r: VacationBalance) => r.vacationType?.name },
    { title: '年度', dataIndex: 'year', width: 100, align: 'right' },
    {
      title: '月份',
      dataIndex: 'month',
      width: 100,
      render: (_: any, r: VacationBalance) => monthText(r.month),
    },
    { title: '总天数', dataIndex: 'totalDays', width: 100, align: 'right' },
    { title: '已用', dataIndex: 'usedDays', width: 100, align: 'right' },
    {
      title: '剩余',
      dataIndex: 'remaining',
      width: 100,
      align: 'right',
      render: (_: any, r: VacationBalance) => {
        const remaining = Number(r.totalDays ?? 0) - Number(r.usedDays ?? 0);
        return <Tag color={remaining > 0 ? 'green' : 'red'}>{remaining.toFixed(1)} 天</Tag>;
      },
    },
  ];

  return (
    <PageContainer>
      <ProTable
        columns={balanceColumns}
        data={balances}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        onSearch={(values) => setMonthFilter(values.month as number | undefined)}
        onReset={() => setMonthFilter(undefined)}
        toolbar={[{ key: 'export', label: '导出 Excel', onClick: handleExport }]}
        pagination={false}
      />
    </PageContainer>
  );
}
