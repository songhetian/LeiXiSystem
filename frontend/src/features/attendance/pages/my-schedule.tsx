'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button, Tag, Typography } from '@arco-design/web-react';
import { IconLeft, IconRight } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { attendanceApi, type Schedule, type Shift } from '@/services/attendance';
import { useCachedData } from '@/hooks/use-cached-data';
import { getContrastColor } from '@/lib/contrast';
import { formatDate as formatDateTz, getTzParts } from '@/lib/format';

const { Text } = Typography;

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function formatDate(y: number, m0: number, d: number) {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
}
/** 月份天数 / 当月 1 日是星期几：用 UTC 构造再取，避免宿主机时区与夏令时干扰 */
function getDaysInMonth(y: number, m0: number) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}
function getFirstWeekday(y: number, m0: number) {
  return new Date(Date.UTC(y, m0, 1)).getUTCDay();
}
function dateOnly(s?: string): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // 时间戳按全站展示口径（北京时间）折算成日期，不用宿主机本地时区
  return formatDateTz(s, 'YYYY-MM-DD', s);
}

const DEFAULT_COLOR = 'var(--lx-primary-weak)';

export default function MySchedulePage() {
  // 「今天」按北京时间判定：在非 +08 时区的机器上，月初/月末会开错月份，
  // 「今天」也会标到隔壁那天
  const today = useMemo(() => getTzParts(new Date()), []);
  const todayYear = Number(today.Y);
  const todayMonth0 = Number(today.M) - 1;
  const todayDateStr = formatDate(todayYear, todayMonth0, Number(today.D));

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonth0);

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
    // 年份/月份是两个独立 state：不能在 setViewMonth 的 updater 里再 setViewYear
    // （StrictMode 下 updater 会被调用两次，年份会连减两次）
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }, [viewMonth, viewYear]);
  const goNext = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }, [viewMonth, viewYear]);

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
              setViewYear(todayYear);
              setViewMonth(todayMonth0);
            }}
            disabled={loading || (viewYear === todayYear && viewMonth === todayMonth0)}
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
            {Array.from({ length: getFirstWeekday(viewYear, viewMonth) }).map((_, i) => (
              <div key={`pad_${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = formatDate(viewYear, viewMonth, day);
              const shift = byDate.get(dateStr);
              const isToday = dateStr === todayDateStr;
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