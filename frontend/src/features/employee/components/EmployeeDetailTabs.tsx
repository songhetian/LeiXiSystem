'use client';

import { Tabs, Table, Timeline, Empty } from '@arco-design/web-react';
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
  { title: '出勤天数', dataIndex: 'workDays', width: 90 },
  { title: '迟到', dataIndex: 'lateCount', width: 70 },
  { title: '缺勤', dataIndex: 'absentDays', width: 70 },
  { title: '加班(时)', dataIndex: 'overtimeHours', width: 90 },
];

const balanceColumns = [
  { title: '类型', dataIndex: 'vacationType', width: 100, render: (v: VacationBalance['vacationType']) => v.name },
  { title: '总额', dataIndex: 'totalDays', width: 80 },
  { title: '已用', dataIndex: 'usedDays', width: 80 },
  { title: '剩余', dataIndex: 'remaining', width: 80 },
];

export default function EmployeeDetailTabs({ employeeId }: EmployeeDetailTabsProps) {
  // SWR 缓存：3 个详情接口各自订阅，同员工切换页签/重进复用缓存
  const { data: mRes, loading: mLoading } = useCachedData<{
    code: number;
    data?: { list: MonthlyRecord[] };
  }>(
    `employee:detail:${employeeId}:monthly`,
    () => attendanceApi.getMonthlyList({ employeeId, pageSize: 12 }),
    { staleTime: 30_000 },
  );
  const { data: bRes, loading: bLoading } = useCachedData<{
    code: number;
    data?: { list: VacationBalance[] };
  }>(
    `employee:detail:${employeeId}:balances`,
    () => attendanceApi.getBalanceList({ employeeId }),
    { staleTime: 30_000 },
  );
  const { data: tRes, loading: tLoading } = useCachedData<{
    code: number;
    data?: { list: TimelineRecord[] };
  }>(
    `employee:detail:${employeeId}:timeline`,
    () => employeeApi.getTimeline({ employeeId, pageSize: 20 }),
    { staleTime: 30_000 },
  );
  const loading = mLoading || bLoading || tLoading;

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
    color: 'green' as const,
    time: r.occurredAt,
    content: `${r.detailText}${r.fromText ? `：${r.fromText} → ${r.toText ?? ''}` : ''}`,
  }));

  return (
    <Tabs defaultActiveTab="attendance">
      <Tabs.TabPane key="attendance" title="考勤">
        {loading ? (
          <Empty description="加载中…" />
        ) : monthly.length === 0 ? (
          <Empty description="暂无考勤记录" />
        ) : (
          <Table rowKey="id" columns={monthlyColumns as any} data={monthly} scroll={{ x: true }} pagination={false} />
        )}
      </Tabs.TabPane>
      <Tabs.TabPane key="leave" title="假期">
        {loading ? (
          <Empty description="加载中…" />
        ) : balanceRows.length === 0 ? (
          <Empty description="暂无假期额度" />
        ) : (
          <Table rowKey="key" columns={balanceColumns as any} data={balanceRows} scroll={{ x: true }} pagination={false} />
        )}
      </Tabs.TabPane>
      <Tabs.TabPane key="timeline" title="履历">
        {loading ? (
          <Empty description="加载中…" />
        ) : timelineItems.length === 0 ? (
          <Empty description="暂无履历记录" />
        ) : (
          <Timeline>
            {timelineItems.map((it, i) => (
              <Timeline.Item key={i} label={it.time}>{it.content}</Timeline.Item>
            ))}
          </Timeline>
        )}
      </Tabs.TabPane>
    </Tabs>
  );
}