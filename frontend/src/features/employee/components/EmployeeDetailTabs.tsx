'use client';

import { Tabs, Table, Timeline } from '@arco-design/web-react';
import DataState from '@/components/DataState';
import StatusTag from '@/components/StatusTag';
import { attendanceApi, MonthlyRecord, VacationBalance } from '@/services/attendance';
import { employeeApi, TimelineRecord } from '@/services/employee';
import { useCachedData } from '@/hooks/use-cached-data';

interface EmployeeDetailTabsProps {
  employeeId: number;
}

const MONTH_STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed: { label: '已确认', color: 'green' },
  draft: { label: '草稿', color: 'orange' },
};

const monthlyColumns = [
  { title: '月份', dataIndex: 'month', width: 100 },
  { title: '出勤天数', dataIndex: 'workDays', width: 90, align: 'right' as const },
  { title: '迟到', dataIndex: 'lateCount', width: 70, align: 'right' as const },
  { title: '缺勤', dataIndex: 'absentDays', width: 70, align: 'right' as const },
  { title: '加班(时)', dataIndex: 'overtimeHours', width: 90, align: 'right' as const },
  {
    title: '状态',
    dataIndex: 'status',
    width: 90,
    render: (value: string) => <StatusTag status={value} statusMap={MONTH_STATUS_MAP} />,
  },
];

const balanceColumns = [
  { title: '类型', dataIndex: 'vacationType', width: 100, render: (v: VacationBalance['vacationType']) => v.name },
  { title: '总额', dataIndex: 'totalDays', width: 80, align: 'right' as const },
  { title: '已用', dataIndex: 'usedDays', width: 80, align: 'right' as const },
  { title: '剩余', dataIndex: 'remaining', width: 80, align: 'right' as const },
];

export default function EmployeeDetailTabs({ employeeId }: EmployeeDetailTabsProps) {
  // SWR 缓存：3 个详情接口各自订阅，同员工切换页签/重进复用缓存
  const {
    data: mRes,
    loading: mLoading,
    error: mError,
    revalidate: mRevalidate,
  } = useCachedData<{
    code: number;
    message?: string;
    data?: { list: MonthlyRecord[] };
  }>(
    `employee:detail:${employeeId}:monthly`,
    async () => {
      const res = await attendanceApi.getMonthlyList({ employeeId, pageSize: 12 });
      // 业务码非 0 视为失败：否则页签会显示成「暂无考勤记录」
      if (res.code !== 0) throw new Error(res.message || '考勤记录读取失败');
      return res;
    },
    { staleTime: 30_000 },
  );
  const {
    data: bRes,
    loading: bLoading,
    error: bError,
    revalidate: bRevalidate,
  } = useCachedData<{
    code: number;
    message?: string;
    data?: { list: VacationBalance[] };
  }>(
    `employee:detail:${employeeId}:balances`,
    async () => {
      const res = await attendanceApi.getBalanceList({ employeeId });
      if (res.code !== 0) throw new Error(res.message || '假期额度读取失败');
      return res;
    },
    { staleTime: 30_000 },
  );
  const {
    data: tRes,
    loading: tLoading,
    error: tError,
    revalidate: tRevalidate,
  } = useCachedData<{
    code: number;
    message?: string;
    data?: { list: TimelineRecord[] };
  }>(
    `employee:detail:${employeeId}:timeline`,
    async () => {
      const res = await employeeApi.getTimeline({ employeeId, pageSize: 20 });
      if (res.code !== 0) throw new Error(res.message || '履历记录读取失败');
      return res;
    },
    { staleTime: 30_000 },
  );

  const monthly = mRes?.code === 0 && mRes.data ? mRes.data.list ?? [] : [];
  const balances = bRes?.code === 0 && bRes.data ? bRes.data.list ?? [] : [];
  const timeline = tRes?.code === 0 && tRes.data ? tRes.data.list ?? [] : [];

  const balanceRows = balances.map((b) => ({
    key: b.id,
    vacationType: b.vacationType,
    totalDays: b.totalDays,
    usedDays: b.usedDays,
    remaining: b.totalDays - b.usedDays,
  }));

  const timelineItems = timeline.map((r) => ({
    id: r.id,
    color: 'green' as const,
    time: r.occurredAt,
    content: `${r.detailText}${r.fromText ? `：${r.fromText} → ${r.toText ?? ''}` : ''}`,
  }));

  return (
    <Tabs defaultActiveTab="attendance">
      {/* 三个页签各自 loading / error / 空态：某一维度取数失败不再让整块显示成「加载中…」 */}
      <Tabs.TabPane key="attendance" title="考勤">
        <DataState
          loading={mLoading}
          error={mError}
          onRetry={mRevalidate}
          isEmpty={monthly.length === 0}
          emptyText="暂无考勤记录"
        >
          <Table rowKey="id" columns={monthlyColumns} data={monthly} scroll={{ x: true }} pagination={false} />
        </DataState>
      </Tabs.TabPane>
      <Tabs.TabPane key="leave" title="假期">
        <DataState
          loading={bLoading}
          error={bError}
          onRetry={bRevalidate}
          isEmpty={balanceRows.length === 0}
          emptyText="暂无假期额度"
        >
          <Table rowKey="key" columns={balanceColumns} data={balanceRows} scroll={{ x: true }} pagination={false} />
        </DataState>
      </Tabs.TabPane>
      <Tabs.TabPane key="timeline" title="履历">
        <DataState
          loading={tLoading}
          error={tError}
          onRetry={tRevalidate}
          isEmpty={timelineItems.length === 0}
          emptyText="暂无履历记录"
        >
          <Timeline>
            {timelineItems.map((it) => (
              <Timeline.Item key={it.id} label={it.time}>{it.content}</Timeline.Item>
            ))}
          </Timeline>
        </DataState>
      </Tabs.TabPane>
    </Tabs>
  );
}
