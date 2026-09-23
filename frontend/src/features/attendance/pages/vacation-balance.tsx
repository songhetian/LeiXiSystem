'use client';

import { Message, Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { attendanceApi, VacationBalance } from '@/services/attendance';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import { todayStr } from '@/lib/format';

interface BalanceEnvelope {
  code: number;
  data?: VacationBalance[];
}

export default function VacationBalancePage() {
  const { can } = usePermission();
  const year = new Date().getFullYear();

  // SWR 缓存：切出再切回本页直接复用缓存；失败时 error 交由 ProTable 展示 + 重试
  const { data: res, loading, error, revalidate } = useCachedData<BalanceEnvelope>(
    `vacation:balances:${year}`,
    () => attendanceApi.getMyBalances(year),
    { staleTime: 30_000 },
  );
  const balances = res?.code === 0 && res.data ? res.data : [];

  // 导出休假额度到 Excel
  const handleExport = () => {
    if (!exportToExcel(
      `休假额度_${todayStr()}.xlsx`,
      '休假额度',
      [
        { title: '假期类型', value: (r: VacationBalance) => r.vacationType?.name ?? '' },
        { title: '年度', dataIndex: 'year' },
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
    { title: '年度', dataIndex: 'year', width: 100 },
    { title: '总天数', dataIndex: 'totalDays', width: 100 },
    { title: '已用', dataIndex: 'usedDays', width: 100 },
    {
      title: '剩余',
      dataIndex: 'remaining',
      width: 100,
      render: (_: any, r: VacationBalance) => {
        const remaining = Number(r.totalDays) - Number(r.usedDays);
        return <Tag color={remaining > 0 ? 'green' : 'red'}>{remaining.toFixed(1)} 天</Tag>;
      },
    },
  ];

  return (
    <PageContainer >
      <ProTable
        columns={balanceColumns}
        data={balances}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        toolbar={[{ key: 'export', label: '导出 Excel', onClick: handleExport }]}
        pagination={false}
      />
    </PageContainer>
  );
}
