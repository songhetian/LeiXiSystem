'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button, Tag, Typography } from '@arco-design/web-react';
import { IconLeft, IconRight } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { attendanceApi, type Schedule, type Shift } from '@/services/attendance';
import { useCachedData } from '@/hooks/use-cached-data';
import { getContrastColor } from '@/lib/contrast';

const { Text } = Typography;

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function formatDate(y: number, m0: number, d: number) {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
}
function getDaysInMonth(y: number, m0: number) {
  return new Date(y, m0 + 1, 0).getDate();
}
function dateOnly(s?: string): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
}

const DEFAULT_COLOR = 'var(--lx-primary-weak)';

export default function MySchedulePage() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const monthStart = formatDate(viewYear, viewMonth, 1);
  const monthEnd = formatDate(viewYear, viewMonth, daysInMonth);

  // SWR 缓存：cacheKey 含月份区间，切月/回到本月即重新订阅
  const cacheKey = `attendance:my-schedule:${monthStart}:${monthEnd}`;
  const { data: list, loading, error, revalidate } = useCachedData<Schedule[]>(
    cacheKey,
    async () => {
      const res = await attendanceApi.getMyScheduleList({
        startDate: monthStart,
        endDate: monthEnd,
        pageSize: 400,
      });
      if (res.code !== 0) throw new Error(res.message || '排班加载失败');
      return res.data?.list ?? [];
    },
    { staleTime: 30_000 },
  );
  const schedules = list ?? [];

  const byDate = useMemo(() => {
    const m = new Map<string, Shift | undefined>();
    schedules.forEach((s) => {
      if (!s || !s.workDate) return;
      m.set(dateOnly(s.workDate), s.shift);
    });
    return m;
  }, [schedules]);

  const goPrev = useCallback(() => {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);
  const goNext = useCallback(() => {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const shiftSet = new Map<number, Shift>();
  schedules.forEach((s) => {
    if (s.shift) shiftSet.set(s.shift.id, s.shift);
  });
  const distinctShifts = Array.from(shiftSet.values());

  return (
    <PageContainer >
      <div className="pro-toolbar pro-toolbar-wrap pro-toolbar-rounded mb-3">
        <div className="flex items-center gap-2">
          <Button icon={<IconLeft />} onClick={goPrev} disabled={loading} aria-label="上一月" />
          <Text bold className="min-w-[110px] text-center inline-block">
            {viewYear} 年 {viewMonth + 1} 月
          </Text>
          <Button icon={<IconRight />} onClick={goNext} disabled={loading} aria-label="下一月" />
          <Button
            onClick={() => {
              setViewYear(today.getFullYear());
              setViewMonth(today.getMonth());
            }}
            disabled={loading || (viewYear === today.getFullYear() && viewMonth === today.getMonth())}
          >
            回到本月
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {distinctShifts.map((s) => (
            <Tag
              key={s.id}
              size="small"
              style={{
                margin: 0,
                backgroundColor: s.color || DEFAULT_COLOR,
                color: getContrastColor(s.color),
                border: 'none',
              }}
            >
              {s.name} {s.startTime}-{s.endTime}
            </Tag>
          ))}
        </div>
      </div>

      <div className="pro-card my-schedule-card">
        <DataState
          loading={loading}
          error={error}
          onRetry={revalidate}
          isEmpty={schedules.length === 0}
          emptyText="本月暂无排班"
        >
          <div className="my-schedule-grid">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="my-schedule-weekday">
                {w}
              </div>
            ))}
            {Array.from({ length: new Date(viewYear, viewMonth, 1).getDay() }).map((_, i) => (
              <div key={`pad_${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDate(viewYear, viewMonth, day);
              const shift = byDate.get(dateStr);
              const isToday = dateStr === formatDate(today.getFullYear(), today.getMonth(), today.getDate());
              return (
                <div
                  key={dateStr}
                  className="my-schedule-day"
                  style={{ background: shift ? shift.color || DEFAULT_COLOR : undefined }}
                >
                  <span
                    className="text-xs"
                    style={{ color: shift ? getContrastColor(shift.color) : undefined }}
                  >
                    {day}
                  </span>
                  {shift && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: getContrastColor(shift.color) }}
                    >
                      {shift.name}
                      <br />
                      {shift.startTime}-{shift.endTime}
                    </span>
                  )}
                  {isToday && (
                    <span
                      className="text-xs rounded px-1 w-fit"
                      style={{
                        background: shift ? 'var(--lx-overlay-soft)' : 'var(--lx-primary-bg)',
                        color: shift ? undefined : 'var(--lx-primary)',
                      }}
                    >
                      今天
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </DataState>
      </div>
    </PageContainer>
  );
}