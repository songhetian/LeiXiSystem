'use client';

import { useState, useEffect } from 'react';
import { Message, Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { attendanceApi, VacationBalance } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

export default function VacationBalancePage() {
  const { can } = usePermission();

  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [vacationTypes, setVacationTypes] = useState<{ id: number; name: string }[]>([]);

  const fetchBalances = async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const res = await attendanceApi.getMyBalances(new Date().getFullYear());
      if (res.code === 0 && res.data) {
        setBalances(res.data);
        const types = [...new Set(res.data.map((b) => b.vacationType.id))].map((id) => {
          const b = res.data!.find((x) => x.vacationType.id === id)!;
          return { id: b.vacationType.id, name: b.vacationType.name };
        });
        setVacationTypes(types);
      }
    } catch (e: any) {
      setBalanceError(e?.message || '获取休假额度失败');
      notifyError(e, '获取休假额度失败');
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  // 导出休假额度到 Excel
  const handleExport = () => {
    if (!exportToExcel(
      `休假额度_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
    <PageContainer title="休假额度">
      <ProTable
        columns={balanceColumns}
        data={balances}
        rowKey="id"
        loading={balanceLoading}
        error={balanceError}
        onRetry={fetchBalances}
        toolbar={[{ key: 'export', label: '导出 Excel', onClick: handleExport }]}
        pagination={false}
      />
    </PageContainer>
  );
}
