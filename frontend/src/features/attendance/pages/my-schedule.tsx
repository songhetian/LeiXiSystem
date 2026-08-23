'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Spin, Tag, Typography, Empty } from '@arco-design/web-react';
import { IconLeft, IconRight } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import { attendanceApi, type Schedule, type Shift } from '@/services/attendance';

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

/** 计算底色文字颜色 */
function getContrastColor(hex?: string): string {
  if (!hex) return '#1d2129';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  if (c.length !== 6) return '#1d2129';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#1d2129';
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1d2129' : '#ffffff';
}

const DEFAULT_COLOR = 'rgba(22, 93, 255, 0.15)';

export default function MySchedulePage() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const monthStart = formatDate(viewYear, viewMonth, 1);
  const monthEnd = formatDate(viewYear, viewMonth, daysInMonth);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getMyScheduleList({
        startDate: monthStart,
        endDate: monthEnd,
        pageSize: 400,
      });
      setSchedules(res.code === 0 && res.data ? res.data.list : []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <PageContainer title="我的排班">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border-1 rounded-md mb-3">
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

      <Spin loading={loading} style={{ display: 'block' }} className="bg-surface border border-border-1 rounded-md p-4">
        {schedules.length === 0 && !loading ? (
          <Empty description="本月暂无排班" style={{ padding: '40px 0' }} />
        ) : (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
          >
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="text-center text-xs text-text-3 py-1">
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
                  className="min-h-[72px] rounded-md border border-border-1 p-2 flex flex-col gap-1"
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
                      className="text-[10px] rounded px-1 w-fit"
                      style={{
                        background: shift ? 'rgba(255,255,255,0.5)' : 'var(--lx-primary-bg)',
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
        )}
      </Spin>
    </PageContainer>
  );
}