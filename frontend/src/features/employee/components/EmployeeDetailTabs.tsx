'use client';

import { useState, useEffect } from 'react';
import { Tabs, Table, Timeline, Empty } from '@arco-design/web-react';
import { attendanceApi, MonthlyRecord, VacationBalance } from '@/services/attendance';
import { employeeApi, TimelineRecord } from '@/services/employee';

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
  const [loading, setLoading] = useState(true);
  const [monthly, setMonthly] = useState<MonthlyRecord[]>([]);
  const [balances, setBalances] = useState<VacationBalance[]>([]);
  const [timeline, setTimeline] = useState<TimelineRecord[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      attendanceApi.getMonthlyList({ employeeId, pageSize: 12 }),
      attendanceApi.getBalanceList({ employeeId }),
      employeeApi.getTimeline({ employeeId, pageSize: 20 }),
    ])
      .then(([m, b, t]) => {
        if (!active) return;
        if (m.code === 0 && m.data) setMonthly(m.data.list ?? []);
        if (b.code === 0 && b.data) setBalances(b.data.list ?? []);
        if (t.code === 0 && t.data) setTimeline(t.data.list ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [employeeId]);

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
          <Table rowKey="id" columns={monthlyColumns as any} data={monthly} pagination={false} />
        )}
      </Tabs.TabPane>
      <Tabs.TabPane key="leave" title="假期">
        {loading ? (
          <Empty description="加载中…" />
        ) : balanceRows.length === 0 ? (
          <Empty description="暂无假期额度" />
        ) : (
          <Table rowKey="key" columns={balanceColumns as any} data={balanceRows} pagination={false} />
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