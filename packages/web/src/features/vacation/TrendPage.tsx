import { useState } from 'react';
import { useTrend } from './hooks';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Select } from '../../components/ui/field';
import { Empty } from '../../components/ui/table';
import type { LeaveTrendPoint } from '@leixi/shared';

/** 自绘轻量柱状图：按月展示已审批请假单数量，避免引入重型图表库 */
function TrendBars({ points }: { points: LeaveTrendPoint[] }) {
  const W = 760;
  const H = 260;
  const PAD = { top: 20, right: 16, bottom: 32, left: 40 };
  const n = 12;
  const slot = (W - PAD.left - PAD.right) / n;
  const barW = Math.min(34, slot * 0.5);
  const max = Math.max(1, ...points.map((p) => p.count));
  const innerH = H - PAD.top - PAD.bottom;
  const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  const countByMonth = new Map<number, number>();
  for (const p of points) countByMonth.set(p.month, p.count);

  return (
    <svg
      role="img"
      aria-label="年度请假审批趋势柱状图"
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* 水平网格线 */}
      {Array.from({ length: 5 }, (_, i) => {
        const v = max - (max * i) / 4;
        const y = PAD.top + (innerH * i) / 4;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#E7E5E4" strokeWidth={1} />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#8B8A92">
              {Math.round(v)}
            </text>
          </g>
        );
      })}
      {/* 柱体 + 数值标注 */}
      {months.map((m, idx) => {
        const month = idx + 1;
        const count = countByMonth.get(month) ?? 0;
        const h = (count / max) * innerH;
        const x = PAD.left + slot * idx + (slot - barW) / 2;
        const y = PAD.top + innerH - h;
        const hasValue = count > 0;
        return (
          <g key={month}>
            <rect x={x} y={y} width={barW} height={h} rx={4} fill={hasValue ? '#131417' : '#F5F5F4'} />
            {hasValue && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="#131417" fontWeight={600}>
                {count}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - PAD.bottom + 16}
              textAnchor="middle"
              fontSize={11}
              fill={idx + 1 <= 9 ? '#8B8A92' : '#8B8A92'}
            >
              {m}月
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function currentYear(): number {
  return new Date().getFullYear();
}

export function TrendPage() {
  const [year, setYear] = useState<number>(currentYear());
  const trendQ = useTrend(year);
  const points = trendQ.data?.trend ?? [];
  const total = points.reduce((acc, p) => acc + p.count, 0);
  const withData = points.filter((p) => p.count > 0).length;

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear() + i - 2;
    return { label: `${y} 年`, value: y };
  });

  return (
    <PageShell>
      <PageHeader title="请假趋势" description="按月统计本年度已审批的请假单数量，观察请假波动。" />

      <Panel>
        <PanelHeader
          title="年度趋势"
          extra={
            <div className="w-40">
              <Select value={year} onChange={(v) => setYear(Number(v))} options={yearOptions} />
            </div>
          }
        />
        <div className="p-4">
          {points.length === 0 ? (
            <Empty>本年度暂无已审批的请假记录</Empty>
          ) : (
            <>
              <div className="mb-4 flex gap-8 text-sm">
                <div>
                  <div className="text-faint">已审批单量</div>
                  <div className="text-xl font-semibold text-ink">{total}</div>
                </div>
                <div>
                  <div className="text-faint">有请假月份</div>
                  <div className="text-xl font-semibold text-ink">{withData}</div>
                </div>
              </div>
              <TrendBars points={points} />
            </>
          )}
        </div>
      </Panel>
    </PageShell>
  );
}