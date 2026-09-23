import { Inbox, CalendarDays, TrendingUp, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { usePermissions } from '../auth/permission';
import { useAuthStore } from '../auth/store';
import { PageShell } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Badge } from '../../components/ui/badge';
import { useDashboardStats } from './hooks';
import type { DashboardStatsView } from '@leixi/shared';

/** 金额格式化：¥3,000.00（千分位 + 两位小数） */
function fmtMoney(n: number): string {
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 单条指标：标签 + 数值 */
function StatItem({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={strong ? 'text-lg font-bold tracking-tight text-ink' : 'text-sm font-medium text-ink'}>
        {value}
      </span>
    </div>
  );
}

/** 数值占位 */
function Dash({ label }: { label: string }) {
  return <StatItem label={label} value="…" />;
}

/** 顶部四张大卡 */
function Cards({
  approvalsTotal,
  attendanceAbnormal,
  reimburseAmount,
  trendTotal,
  loading,
}: {
  approvalsTotal: number;
  attendanceAbnormal: number;
  reimburseAmount: number;
  trendTotal: number;
  loading: boolean;
}) {
  const items = [
    { label: '待办审批', value: loading ? '…' : String(approvalsTotal), icon: Inbox },
    { label: '本月考勤异常', value: loading ? '…' : String(attendanceAbnormal), icon: CalendarDays },
    { label: '本月报销总额', value: loading ? '…' : fmtMoney(reimburseAmount), icon: HandCoins },
    { label: '本月趋势发起量', value: loading ? '…' : String(trendTotal), icon: TrendingUp },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="panel px-4 py-3.5">
          <div className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{it.value}</div>
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-muted">{it.label}</span>
            <it.icon className="h-4 w-4 text-faint" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 「待办审批」详情面板 */
function ApprovalPanels({ a }: { a: DashboardStatsView['approvals'] }) {
  const rows = [
    { label: '请假审批', value: a.leave },
    { label: '加班审批', value: a.overtime },
    { label: '补卡审批', value: a.makeup },
    { label: '报销审批', value: a.reimburse },
  ];
  return (
    <Panel>
      <PanelHeader
        title="待办审批"
        description="当前作用域内待您处理"
        extra={<Badge tone="warn">{a.total} 项</Badge>}
      />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
        {rows.map((r) => (
          <StatItem key={r.label} label={r.label} value={String(r.value)} strong />
        ))}
      </div>
    </Panel>
  );
}

/** 「本月考勤」详情面板 */
function AttendancePanel({ at }: { at: DashboardStatsView['attendance'] }) {
  const abnormal = [
    { label: '迟到', value: at.late },
    { label: '早退', value: at.earlyLeave },
    { label: '缺卡', value: at.missingPunch },
    { label: '缺勤', value: at.absent },
  ];
  return (
    <Panel>
      <PanelHeader title="本月考勤" description={`打卡 ${at.records} 次`} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
        {abnormal.map((r) => (
          <StatItem key={r.label} label={r.label} value={String(r.value)} strong />
        ))}
      </div>
    </Panel>
  );
}

/** 「本月趋势」详情面板 */
function TrendPanel({ t }: { t: DashboardStatsView['trend'] }) {
  return (
    <Panel>
      <PanelHeader title="本月趋势" description="各模块本月发起量" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3">
        <StatItem label="请假发起" value={String(t.leaves)} strong />
        <StatItem label="补卡发起" value={String(t.makeupCount)} strong />
        <StatItem label="加班时长" value={`${t.overtimeHours} h`} strong />
        <StatItem label="报销笔数" value={String(t.reimburseCount)} strong />
        <StatItem label="报销金额" value={fmtMoney(t.reimburseAmount)} strong />
      </div>
    </Panel>
  );
}

/** 「规模与类别 TOP」面板 */
function ScalePanel({ s }: { s: DashboardStatsView['scale'] }) {
  const cats = s.topCategories.slice(0, 4);
  return (
    <Panel>
      <PanelHeader title="规模与类别 TOP" description="作用域内规模与报销热门类别" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
        <StatItem label="部门数" value={String(s.departments)} strong />
        <StatItem label="员工数" value={String(s.employees)} strong />
      </div>
      <div className="border-t border-line px-5 py-4">
        <div className="mb-2 text-xs font-semibold text-muted">本月报销类别 TOP</div>
        {cats.length === 0 ? (
          <p className="text-sm text-faint">暂无数据</p>
        ) : (
          <ul className="space-y-2">
            {cats.map((c) => (
              <li key={c.name} className="flex items-center justify-between text-sm">
                <span className="truncate text-ink">{c.name}</span>
                <span className="ml-3 shrink-0 font-medium text-ink">{fmtMoney(c.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

export function DashboardPage() {
  const permissions = usePermissions();
  const user = useAuthStore((s) => s.user);
  const hour = new Date().getHours();
  const greet = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';

  const { data, isLoading, isError, error } = useDashboardStats();
  const stats = data?.stats;

  useEffect(() => {
    if (isError && error) {
      toast.error(error instanceof Error ? error.message : '工作台数据加载失败');
    }
  }, [isError, error]);

  return (
    <PageShell>
      {/* 欢迎条 */}
      <div className="panel flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">
            {greet}，{user?.realName}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            欢迎使用雷犀内部管理系统
            {stats?.month ? ` · ${stats.month} 概览` : ''}
          </p>
        </div>
        <span className="hidden rounded-md bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink sm:inline">
          工作台
        </span>
      </div>

      {/* 顶部统计卡 */}
      <Cards
        approvalsTotal={stats?.approvals.total ?? 0}
        attendanceAbnormal={(stats?.attendance.late ?? 0) + (stats?.attendance.earlyLeave ?? 0) + (stats?.attendance.missingPunch ?? 0) + (stats?.attendance.absent ?? 0)}
        reimburseAmount={stats?.trend.reimburseAmount ?? 0}
        trendTotal={(stats?.trend.leaves ?? 0) + (stats?.trend.makeupCount ?? 0) + (stats?.trend.reimburseCount ?? 0)}
        loading={isLoading}
      />

      {/* 统计详情 */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {isLoading ? (
          <Panel>
            <PanelHeader title="待办审批" extra={<Dash label="total" />} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
              <Dash label="请假审批" />
              <Dash label="加班审批" />
              <Dash label="补卡审批" />
              <Dash label="报销审批" />
            </div>
          </Panel>
        ) : stats ? (
          <ApprovalPanels a={stats.approvals} />
        ) : null}

        {stats ? <AttendancePanel at={stats.attendance} /> : null}
        {stats ? <TrendPanel t={stats.trend} /> : null}
        {stats ? <ScalePanel s={stats.scale} /> : null}
      </div>

      {/* 我的权限 */}
      <div className="panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">我的权限点</h2>
            <p className="mt-0.5 text-xs text-faint">当前账号已生效的页面与动作权限码</p>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink ring-1 ring-inset ring-brand-ink/20">
            {permissions.length} 项
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 px-4 py-3.5">
          {permissions.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 font-mono text-xs text-muted"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </PageShell>
  );
}