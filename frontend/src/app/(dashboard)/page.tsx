'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Grid, Typography, Button } from '@arco-design/web-react';
import {
  IconUserGroup,
  IconCheckCircle,
  IconClockCircle,
  IconRight,
  IconRefresh,
  IconCalendar,
  IconBook,
  IconUser,
  IconEdit,
  IconArchive,
  IconLink,
} from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import QuickActionsManager from '@/components/QuickActionsManager';
import StatCard from '@/components/StatCard';
import { useQuickActions, QuickActionDef } from '@/hooks/use-quick-actions';
import { dashboardApi, DashboardStats, DashboardNotificationItem, AttendanceTrendPoint, DepartmentStat } from '@/services/dashboard';
import { attendanceApi, PunchTodayResult, VacationBalance } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import { paletteCommandsFor } from '@/config/navigation';
import { useAuthStore } from '@/store/auth';
import { useCachedData } from '@/hooks/use-cached-data';
import { getTzParts } from '@/lib/format';
import {
  APPROVAL_INSTANCE_STATUS,
  APPROVAL_STATUS_COLOR_VAR,
} from '@/features/approval/lib/status-maps';

const { Row, Col } = Grid;
const { Text } = Typography;

interface QuickAction {
  label: string;
  path: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: '员工管理', path: '/employees', icon: IconUserGroup },
  { label: '打卡', path: '/attendance/punch', icon: IconClockCircle },
  { label: '考勤日报', path: '/attendance/daily', icon: IconCheckCircle },
  { label: '请假申请', path: '/attendance/vacation/leave', icon: IconCalendar },
  { label: '加班申请', path: '/attendance/vacation/overtime', icon: IconEdit },
  { label: '报销申请', path: '/expense/my', icon: IconArchive },
  { label: '知识库', path: '/knowledge', icon: IconBook },
  { label: '绩效管理', path: '/performance/cycles', icon: IconCalendar },
  { label: '工单客服', path: '/helpdesk', icon: IconUser },
];

/** 入口池（key 取 path，天然唯一）与图标映射：自定义入口无图标，统一用 IconLink 兜底 */
const QUICK_POOL: QuickActionDef[] = QUICK_ACTIONS.map((a) => ({ key: a.path, label: a.label, path: a.path }));
const QUICK_ICON = new Map<string, QuickAction['icon']>(QUICK_ACTIONS.map((a) => [a.path, a.icon]));
const quickIconOf = (a: QuickActionDef) => QUICK_ICON.get(a.key) ?? IconLink;

function todayText() {
  const { Y, M, D } = getTzParts(new Date());
  const week = ['日', '一', '二', '三', '四', '五', '六'][
    new Date(Date.UTC(Number(Y), Number(M) - 1, Number(D))).getUTCDay()
  ];
  return `${Number(M)}月${Number(D)}日 · 星期${week}`;
}

/** 打卡状态 → 文案（与考勤日报 status 枚举同源） */
const PUNCH_STATUS: Record<string, string> = {
  normal: '正常',
  late: '迟到',
  early: '早退',
  late_early: '迟到早退',
  absent: '缺勤',
  half_absent: '半天缺勤',
  leave: '请假',
  makeup: '补卡',
};

/** ISO 时间串 → 北京时间 HH:mm（不用本地时区 getter，避免宿主机时区偏移） */
function formatClock(value?: string | null): string {
  if (!value) return '—';
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return '—';
  const { HH, mm } = getTzParts(t);
  return `${HH}:${mm}`;
}

/**
 * 审批单状态 → 文案 + 颜色。
 * 枚举与「我的申请」页 approvalStatusMap 同源（prisma ApprovalInstanceStatus：
 * pending / approved / rejected / cancelled），色值映射到页面语义 token。
 */

/** 通知圆点：未读用类型色点亮，已读灰化 */
const notificationDotColor = (item: DashboardNotificationItem): string => {
  if (item.read) return 'var(--lx-text-4)';
  return item.type === 'system' ? 'var(--lx-primary)' : 'var(--lx-success)';
};

/** 相对时间（中文）：刚刚 / X分钟前 / X小时前 / 昨天 / M月D日 */
function relativeTime(value?: string | Date | null): string {
  if (!value) return '';
  const t = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(t.getTime())) return '';
  const diffMin = Math.floor((Date.now() - t.getTime()) / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffHour < 48) return '昨天';
  return `${t.getMonth() + 1}月${t.getDate()}日`;
}

interface Metric {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  onClick?: () => void;
}

export default function HomePage() {
  const router = useRouter();
  const { can } = usePermission();
  // 快捷操作：入口池 + 用户自定义（localStorage 持久化），管理面板可增删改查
  const quick = useQuickActions(QUICK_POOL);
  const [quickManagerOpen, setQuickManagerOpen] = useState(false);
  // 自定义入口的可选页面：由导航真值源派生并按权限过滤，用户只选不手输
  const permissions = useAuthStore((s) => s.user?.permissions);
  const quickRoutes = useMemo(
    () => (permissions ? paletteCommandsFor(permissions).map((c) => ({ path: c.path, label: c.label })) : []),
    [permissions],
  );
  // 数据新鲜度：stats 成功返回时打时间戳，hero 展示「更新于 X 分钟前」
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  // 每 60s 触发一次重渲染，让相对时间自然走字（不发请求、不动缓存）
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // 统计指标走 SWR 共享缓存；失败提示由请求拦截器统一弹出，避免重复 Toast
  const fetchStats = useCallback(async () => {
    const res = await dashboardApi.getStats();
    // code 非 0 才算失败；data 为 null 是「暂无统计数据」的合法空态（新部署/空库）
    if (res.code !== 0) throw new Error(res.message || '获取统计数据失败');
    setUpdatedAt(Date.now());
    return res.data ?? null;
  }, []);
  const { data: stats, loading, error, revalidate: refreshStats } = useCachedData<DashboardStats | null>(
    'dashboard:stats',
    fetchStats,
  );

  // hero 描述数据化：有待办时直说数字，不再用寒暄句填充
  const pendingApprovals = stats?.pendingApprovals ?? null;
  const heroDesc = pendingApprovals != null && pendingApprovals > 0
    ? `今日有 ${pendingApprovals} 项审批待处理`
    : '今日暂无待审批';

  const isAdmin = can('system:user:view');

  // 出勤率 = 今日出勤 / 在职员工，只在有分母时才算（空库/全员未建档不显示）
  const attendanceRate =
    stats && stats.employeeCount > 0
      ? Math.round((stats.attendanceCount / stats.employeeCount) * 100)
      : null;

  /** 管理者视角：全局人力与审批负载 */
  const adminMetrics: Metric[] = [
    {
      label: '在职员工',
      value: stats?.employeeCount?.toString() ?? '0',
      suffix: '人',
    },
    {
      label: '今日出勤',
      value: stats?.attendanceCount?.toString() ?? '0',
      suffix: '人',
      // 0 人时先说明「暂无记录」而不是让用户猜是没同步还是真没人打卡；
      // 有迟到优先报异常，其次报出勤率（比「今日打卡」这种填充词有信息量）
      hint: stats
        ? stats.attendanceCount === 0
          ? '今日暂无打卡记录'
          : stats.todayLateCount > 0
            ? `其中迟到 ${stats.todayLateCount} 人`
            : attendanceRate != null
              ? `出勤率 ${attendanceRate}%`
              : undefined
        : undefined,
    },
    {
      label: '待审批',
      value: stats?.pendingApprovals?.toString() ?? '0',
      suffix: '项',
      hint: '待处理',
      onClick: () => router.push('/approval/todo'),
    },
    {
      label: '本月加班',
      value: stats ? String(stats.monthOvertimeHours ?? 0) : '0',
      suffix: '小时',
      hint: '全员累计',
    },
  ];

  /** 员工视角：只放「跟我有关」的数据，全局人力数字对普通员工没有决策价值 */
  const staffMetrics: Metric[] = [
    {
      label: '本周出勤',
      value: stats?.myWeek ? String(stats.myWeek.workDays) : '—',
      suffix: '天',
      hint: stats?.myWeek
        ? stats.myWeek.lateDays > 0
          ? `迟到 ${stats.myWeek.lateDays} 天`
          : '全勤'
        : undefined,
    },
    {
      label: '本周缺勤',
      value: stats?.myWeek ? String(stats.myWeek.absentDays) : '—',
      suffix: '天',
      hint: stats?.myWeek && stats.myWeek.absentDays > 0 ? '需补交说明' : undefined,
    },
    {
      label: '日均工时',
      value: stats?.myWeek ? String(stats.myWeek.avgWorkHours) : '—',
      suffix: 'h',
      hint: '已扣班次休息',
    },
    {
      label: '待我审批',
      value: stats?.pendingApprovals?.toString() ?? '0',
      suffix: '项',
      hint: '待处理',
      onClick: () => router.push('/approval/todo'),
    },
  ];

  const metrics: Metric[] = isAdmin ? adminMetrics : staffMetrics;

  return (
    <PageContainer
      action={
        <Button
          type="text"
          size="small"
          icon={<IconRefresh />}
          loading={loading}
          onClick={refreshStats}
          aria-label="刷新数据"
        />
      }
    >
      {/* 欢迎横幅 */}
      <div className="dsh-hero">
        <div>
          <h2 className="dsh-hero-title">今日概览</h2>
          <p className="dsh-hero-desc">{heroDesc}</p>
        </div>
        <div className="dsh-hero-side">
          <span className="dsh-hero-chip">
            <IconCalendar style={{ color: 'var(--lx-primary)' }} />
            {todayText()}
          </span>
          {updatedAt != null && (
            <span className="dsh-hero-chip dsh-hero-chip-muted">
              更新于 {relativeTime(new Date(updatedAt))}
            </span>
          )}
        </div>
      </div>

      {/* KPI 指标卡：加载中不摆出 0，失败展示错误态 + 重试，不再把 0 当真实数据 */}
      <div style={{ marginBottom: 24 }}>
        <DataState loading={loading} skeleton skeletonRows={1} error={error} onRetry={refreshStats}>
          <Row gutter={[16, 16]}>
            {metrics.map((m, i) => (
              <Col xs={12} md={6} key={m.label}>
                <StatCard
                  label={m.label}
                  value={m.value}
                  suffix={m.suffix}
                  hint={m.hint}
                  onClick={m.onClick}
                  stagger={i}
                />
              </Col>
            ))}
          </Row>
        </DataState>
      </div>

      {/* 今日状态：打卡 + 假期余额 —— 员工每天打开系统最常看的两块，从打卡页提到首屏 */}
      <TodayStatus />

      {/* 快捷操作 */}
      <div style={{ marginBottom: 24 }}>
        <div className="dsh-panel">
          <div className="dsh-panel-head">
            <h3 className="dsh-panel-title">快捷操作</h3>
            <button
              type="button"
              className="dsh-panel-more"
              onClick={() => setQuickManagerOpen(true)}
            >
              管理 <IconRight style={{ fontSize: 12 }} />
            </button>
          </div>
          <div className="dsh-quick-grid">
          {quick.visible.map((a) => {
            const Icon = quickIconOf(a);
            return (
              <button
                key={a.key}
                type="button"
                className="dsh-quick-item"
                onClick={() => router.push(a.path)}
                title={a.label}
              >
                <span className="dsh-quick-ic">
                  <Icon />
                </span>
                <span className="dsh-quick-label">{a.label}</span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      <QuickActionsManager
        visible={quickManagerOpen}
        onClose={() => setQuickManagerOpen(false)}
        api={quick}
        routes={quickRoutes}
        renderIcon={(a) => {
          const Icon = quickIconOf(a);
          return <Icon />;
        }}
      />

      {/* 审批域合并：别人等我办的 + 我提交的进度，同一区域连续呈现，不再被通知区块割裂 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">待办事项</h3>
              <button type="button" className="dsh-panel-more" onClick={() => router.push('/approval/todo')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </button>
            </div>
            <DataState
              loading={loading}
              skeleton
              skeletonType="list"
              skeletonRows={3}
              error={error}
              onRetry={refreshStats}
              isEmpty={(stats?.todoTop ?? []).length === 0}
              emptyText="暂无待办"
              emptyActionLabel={can('approval:todo:view') ? '去审批中心' : undefined}
              onEmptyAction={() => router.push('/approval/todo')}
            >
              {(stats?.todoTop ?? []).map((item) => (
                // 直达单据详情：原来跳列表页，用户还得在列表里再找一遍这条单
                <button
                  type="button"
                  className="dsh-feed-item"
                  key={item.id}
                  onClick={() => router.push(`/approval/instances/${item.instanceId}`)}
                >
                  <span className="dsh-feed-dot" style={{ background: 'var(--lx-primary)' }} />
                  <div className="dsh-feed-main">
                    <div className="dsh-feed-title">{item.title}</div>
                    <div className="dsh-feed-meta">待审批 · {relativeTime(item.createdAt)}</div>
                  </div>
                </button>
              ))}
            </DataState>
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">我的申请进度</h3>
              <button type="button" className="dsh-panel-more" onClick={() => router.push('/approval/submissions')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </button>
            </div>
            <DataState
              loading={loading}
              skeleton
              skeletonType="list"
              skeletonRows={3}
              error={error}
              onRetry={refreshStats}
              isEmpty={(stats?.mySubmissionsTop ?? []).length === 0}
              emptyText="暂无申请"
            >
              {(stats?.mySubmissionsTop ?? []).map((item) => {
                const s = APPROVAL_INSTANCE_STATUS[item.status] ?? {
                  label: item.status,
                  color: 'default',
                };
                return (
                  // 原来是个只读 div：有状态文字但没有后续动作，点了没反应
                  <button
                    type="button"
                    className="dsh-feed-item"
                    key={item.id}
                    onClick={() => router.push('/approval/submissions')}
                  >
                    <span
                      className="dsh-feed-dot"
                      style={{
                        background:
                          APPROVAL_STATUS_COLOR_VAR[item.status] ?? 'var(--lx-text-4)',
                      }}
                    />
                    <div className="dsh-feed-main">
                      <div className="dsh-feed-title">{item.title}</div>
                    </div>
                    <div className="dsh-feed-side">
                      <span
                        style={{
                          fontSize: 12,
                          color: APPROVAL_STATUS_COLOR_VAR[item.status] ?? 'var(--lx-text-3)',
                          fontWeight: 400,
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </DataState>
          </div>
        </Col>
      </Row>

      {/* 最新通知；本周考勤概览仅管理者展示 —— 员工的 myWeek 已在 KPI 卡呈现，重复出现等于同一份数据说两遍 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={isAdmin ? 14 : 24}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">最新通知</h3>
              <button type="button" className="dsh-panel-more" onClick={() => router.push('/notifications')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </button>
            </div>
            <DataState
              loading={loading}
              skeleton
              skeletonType="list"
              skeletonRows={3}
              error={error}
              onRetry={refreshStats}
              isEmpty={(stats?.notificationTop ?? []).length === 0}
              emptyText="暂无通知"
            >
              {(stats?.notificationTop ?? []).map((item) => (
                <button type="button" className="dsh-feed-item" key={item.id} onClick={() => router.push('/notifications')}>
                  <span className="dsh-feed-dot" style={{ background: notificationDotColor(item) }} />
                  <div className="dsh-feed-main">
                    <div className="dsh-feed-title">{item.title}</div>
                    <div className="dsh-feed-meta">{relativeTime(item.createdAt)}</div>
                  </div>
                </button>
              ))}
            </DataState>
          </div>
        </Col>
        {isAdmin && (
          <Col xs={24} lg={10}>
            <div className="dsh-panel">
              <div className="dsh-panel-head">
                <h3 className="dsh-panel-title">本周考勤概览</h3>
                <button type="button" className="dsh-panel-more" onClick={() => router.push('/attendance/daily')}>
                  查看详情 <IconRight style={{ fontSize: 12 }} />
                </button>
              </div>
              <DataState loading={loading} skeleton skeletonRows={1} error={error} onRetry={refreshStats}>
              <div className="dsh-kpi">
                <div className="dsh-kpi-item">
                  <div className="dsh-kpi-value" style={{ color: 'var(--lx-success)' }}>
                    {stats?.myWeek ? stats.myWeek.workDays : '—'}
                  </div>
                  <div className="dsh-kpi-label">正常出勤</div>
                </div>
                <div className="dsh-kpi-divider" />
                <div className="dsh-kpi-item">
                  <div className="dsh-kpi-value" style={{ color: 'var(--lx-warning)' }}>
                    {stats?.myWeek ? stats.myWeek.lateDays : '—'}
                  </div>
                  <div className="dsh-kpi-label">迟到</div>
                </div>
                <div className="dsh-kpi-divider" />
                <div className="dsh-kpi-item">
                  <div className="dsh-kpi-value" style={{ color: 'var(--lx-danger)' }}>
                    {stats?.myWeek ? stats.myWeek.absentDays : '—'}
                  </div>
                  <div className="dsh-kpi-label">缺勤</div>
                </div>
                <div className="dsh-kpi-divider" />
                <div className="dsh-kpi-item">
                  <div className="dsh-kpi-value" style={{ color: 'var(--lx-primary)' }}>
                    {stats?.myWeek ? `${stats.myWeek.avgWorkHours}h` : '—'}
                  </div>
                  <div className="dsh-kpi-label">平均工时</div>
                </div>
              </div>
              </DataState>
            </div>
          </Col>
        )}
      </Row>

      {/* 组织管理看板：低频数据下沉到页面底部，不再挤占管理员第三屏 */}
      {isAdmin && <OrgChart />}
    </PageContainer>
  );
}

// ====== 今日状态（打卡 + 假期余额）：员工每天最关心的两块，从打卡页提到首页 ======

type PunchToday = NonNullable<PunchTodayResult['data']>;

/**
 * 今日打卡状态 + 假期余额。
 * 两个数据源各自独立订阅、独立降级：打卡接口不可用不影响假期余额展示，反之亦然。
 */
function TodayStatus() {
  const router = useRouter();

  const fetchPunch = useCallback(async () => {
    const res = await attendanceApi.getTodayPunch();
    if (res.code !== 0) throw new Error(res.message || '获取打卡状态失败');
    return res.data ?? null;
  }, []);
  const {
    data: punch,
    loading: punchLoading,
    error: punchError,
    revalidate: revalidatePunch,
  } = useCachedData<PunchToday | null>('dashboard:today-punch', fetchPunch);

  const fetchBalances = useCallback(async () => {
    const res = await attendanceApi.getMyBalances();
    if (res.code !== 0) throw new Error(res.message || '获取假期余额失败');
    return res.data ?? [];
  }, []);
  const {
    data: balances,
    loading: balanceLoading,
    error: balanceError,
    revalidate: revalidateBalances,
  } = useCachedData<VacationBalance[]>('dashboard:my-balances', fetchBalances);

  const rows = balances ?? [];
  // 优先年假；没有年假退到第一个有薪假（无薪假剩余天数不能当假期用，会误导）
  const primary =
    rows.find((b) => b.vacationType?.code === 'annual') ??
    rows.find((b) => b.vacationType?.isPaid) ??
    rows[0];
  const remainDays = primary ? Math.round((primary.totalDays - primary.usedDays) * 10) / 10 : null;

  // 提示语优先级：休息日 > 未排班 > 可下班 > 可上班 > 其余准入文案
  // （直接取后端返回的准入文案，与打卡页口径保持一致，避免两处说不同的话）
  const punchTip = punch
    ? punch.isRestDay
      ? '休息日，无需打卡'
      : !punch.hasSchedule
        ? '今日未排班，请先联系排班人'
        : punch.clockOut?.allowed
          ? punch.clockOut.message
          : punch.clockIn?.allowed
            ? punch.clockIn.message
            : punch.clockOut?.message || punch.clockIn?.message || ''
    : '';

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} lg={14}>
        <div className="dsh-panel">
          <div className="dsh-panel-head">
            <h3 className="dsh-panel-title">今日打卡</h3>
            <button type="button" className="dsh-panel-more" onClick={() => router.push('/attendance/punch')}>
              去打卡 <IconRight style={{ fontSize: 12 }} />
            </button>
          </div>
          <DataState
            loading={punchLoading}
            skeleton
            skeletonRows={1}
            error={punchError}
            onRetry={revalidatePunch}
            isEmpty={punch === null}
            emptyText="暂无员工档案，无法查看打卡状态"
          >
            <div className="dsh-today">
              <div className="dsh-today-cell">
                <div className="dsh-today-label">上班</div>
                <div className="dsh-today-value">{formatClock(punch?.firstPunch)}</div>
              </div>
              <div className="dsh-today-cell">
                <div className="dsh-today-label">下班</div>
                <div className="dsh-today-value">{formatClock(punch?.lastPunch)}</div>
              </div>
              <div className="dsh-today-cell">
                <div className="dsh-today-label">班次</div>
                <div className="dsh-today-value is-text">
                  {punch?.shift ? `${punch.shift.startTime}–${punch.shift.endTime}` : '未排班'}
                </div>
              </div>
              <div className="dsh-today-cell">
                <div className="dsh-today-label">状态</div>
                <div className="dsh-today-value is-text">
                  {punch ? (PUNCH_STATUS[punch.status] ?? punch.status) : '—'}
                </div>
              </div>
            </div>
            {punchTip && <p className="dsh-today-tip">{punchTip}</p>}
          </DataState>
        </div>
      </Col>
      <Col xs={24} lg={10}>
        <div className="dsh-panel">
          <div className="dsh-panel-head">
            <h3 className="dsh-panel-title">假期余额</h3>
            <button type="button" className="dsh-panel-more" onClick={() => router.push('/attendance/vacation/balance')}>
              查看全部 <IconRight style={{ fontSize: 12 }} />
            </button>
          </div>
          <DataState
            loading={balanceLoading}
            skeleton
            skeletonRows={1}
            error={balanceError}
            onRetry={revalidateBalances}
            isEmpty={!primary}
            emptyText="暂无假期额度"
          >
            {primary && (
              <div className="dsh-today">
                <div className="dsh-today-cell">
                  <div className="dsh-today-label">{primary.vacationType?.name ?? '假期'}剩余</div>
                  <div className="dsh-today-value" style={{ color: 'var(--lx-primary)' }}>
                    {remainDays}
                    <span className="u">天</span>
                  </div>
                </div>
                <div className="dsh-today-cell">
                  <div className="dsh-today-label">已用</div>
                  <div className="dsh-today-value is-text">{primary.usedDays} 天</div>
                </div>
                <div className="dsh-today-cell">
                  <div className="dsh-today-label">总额度</div>
                  <div className="dsh-today-value is-text">{primary.totalDays} 天</div>
                </div>
              </div>
            )}
          </DataState>
        </div>
      </Col>
    </Row>
  );
}

// ====== 组织管理看板（仅有系统管理权限展示）：部门人力分布 + 近 7 日考勤趋势 ======

/** 趋势柱可用的最大高度（px），date 行预留 18px */
const TREND_STACK_H = 112;

function OrgChart() {
  const fetchDepts = useCallback(async () => {
    const res = await dashboardApi.getDepartmentStats();
    if (res.code === 0 && res.data) return res.data;
    throw new Error(res.message || '获取组织数据失败');
  }, []);
  const fetchTrend = useCallback(async () => {
    const res = await dashboardApi.getAttendanceTrend(7);
    if (res.code === 0 && res.data) return res.data;
    throw new Error(res.message || '获取组织数据失败');
  }, []);
  const { data: depts, loading: deptsLoading, error: deptsError, revalidate: revalidateDepts } = useCachedData<DepartmentStat[]>(
    'dashboard:dept-stats',
    fetchDepts,
  );
  const { data: trend, loading: trendLoading, error: trendError, revalidate: revalidateTrend } = useCachedData<AttendanceTrendPoint[]>(
    'dashboard:attendance-trend:7',
    fetchTrend,
  );

  const deptList = depts ?? [];
  const trendList = trend ?? [];
  const maxDept = Math.max(1, ...deptList.map((d) => d.count));
  // 堆叠柱总高按「最大日出勤人数」归一（present 是绝对主项，单独归一会把异常日放得巨大）
  const maxTotal = Math.max(1, ...trendList.map((p) => p.present + p.late + p.leave + p.absent));

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} lg={10}>
        <div className="dsh-panel">
          <div className="dsh-panel-head">
            <h3 className="dsh-panel-title">部门人力分布</h3>
          </div>
          <DataState
            loading={deptsLoading}
            skeleton
            skeletonType="list"
            skeletonRows={4}
            error={deptsError}
            isEmpty={deptList.length === 0}
            emptyText="暂无部门数据"
            onRetry={revalidateDepts}
          >
            <div className="flex flex-col gap-3 py-2">
              {deptList.map((d) => (
                <div key={d.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <Text type="secondary">{d.name}</Text>
                    <Text style={{ fontWeight: 500 }}>{d.count} 人</Text>
                  </div>
                  {/* 轨道色必须用有效 token：曾写成 bg-bg-3（Tailwind 未注册该色名，类不存在 → 轨道透明隐形） */}
                  <div className="h-2 bg-bg-tertiary rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(d.count / maxDept) * 100}%`,
                        background: 'var(--lx-primary)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DataState>
        </div>
      </Col>
      <Col xs={24} lg={14}>
        <div className="dsh-panel">
          <div className="dsh-panel-head">
            <h3 className="dsh-panel-title">近 7 日考勤趋势</h3>
          </div>
          <DataState
            loading={trendLoading}
            skeleton
            skeletonType="list"
            skeletonRows={3}
            error={trendError}
            isEmpty={trendList.length === 0}
            emptyText="暂无考勤数据"
            onRetry={revalidateTrend}
          >
            <div className="trend-legend">
              <span><i style={{ background: 'var(--lx-primary)' }} />出勤</span>
              <span><i style={{ background: 'var(--lx-warning)' }} />迟到</span>
              <span><i style={{ background: 'var(--lx-teal)' }} />请假</span>
              <span><i style={{ background: 'var(--lx-danger)' }} />缺勤</span>
            </div>
            <div className="trend-chart">
              {/* 网格线（纯装饰）：水平 3 线均匀分布 */}
              <div className="trend-grid" aria-hidden="true">
                <span /><span /><span />
              </div>
              <div className="trend-bars">
                {trendList.map((p) => {
                  const total = p.present + p.late + p.leave + p.absent;
                  const stackH = Math.max(2, Math.round((total / maxTotal) * TREND_STACK_H));
                  // 段内按占比分高；零值段不渲染
                  const segPct = (v: number) => (total === 0 ? 0 : (v / total) * 100);
                  const segments = [
                    { v: p.present, color: 'var(--lx-primary)' },
                    { v: p.late, color: 'var(--lx-warning)' },
                    { v: p.leave, color: 'var(--lx-teal)' },
                    { v: p.absent, color: 'var(--lx-danger)' },
                  ].filter((s) => s.v > 0);
                  return (
                    <div key={p.date} className="trend-col">
                      <div
                        className="trend-stack"
                        style={{ height: stackH }}
                        title={`${p.date}：出勤 ${p.present}，迟到 ${p.late}，请假 ${p.leave}，缺勤 ${p.absent}`}
                      >
                        {segments.map((s) => (
                          <i key={s.color} style={{ height: `${segPct(s.v)}%`, background: s.color }} />
                        ))}
                      </div>
                      <span className="trend-date">{p.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </DataState>
        </div>
      </Col>
    </Row>
  );
}
