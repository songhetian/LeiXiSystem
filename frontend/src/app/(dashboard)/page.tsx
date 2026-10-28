'use client';

import { useCallback, useState } from 'react';
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
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';

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

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function todayText() {
  const now = new Date();
  const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
  return `${now.getMonth() + 1}月${now.getDate()}日 · 星期${week}`;
}

/**
 * 审批单状态 → 文案 + 颜色。
 * 枚举与「我的申请」页 approvalStatusMap 同源（prisma ApprovalInstanceStatus：
 * pending / approved / rejected / cancelled），色值映射到页面语义 token。
 */
const SUBMISSION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '审批中', color: 'var(--lx-warning)' },
  approved: { label: '已通过', color: 'var(--lx-success)' },
  rejected: { label: '已驳回', color: 'var(--lx-danger)' },
  cancelled: { label: '已撤销', color: 'var(--lx-text-3)' },
};

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
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  hint?: string;
  onClick?: () => void;
}

export default function HomePage() {
  const router = useRouter();
  const { can } = usePermission();
  // 快捷操作：入口池 + 用户自定义（localStorage 持久化），管理面板可增删改查
  const quick = useQuickActions(QUICK_POOL);
  const [quickManagerOpen, setQuickManagerOpen] = useState(false);

  // 统计指标走 SWR 共享缓存；失败提示由请求拦截器统一弹出，避免重复 Toast
  const fetchStats = useCallback(async () => {
    const res = await dashboardApi.getStats();
    // code 非 0 才算失败；data 为 null 是「暂无统计数据」的合法空态（新部署/空库）
    if (res.code !== 0) throw new Error(res.message || '获取统计数据失败');
    return res.data ?? null;
  }, []);
  const { data: stats, loading, error, revalidate: refreshStats } = useCachedData<DashboardStats | null>(
    'dashboard:stats',
    fetchStats,
  );

  // hero 描述数据化：有待办时直说数字，而不是一句固定寒暄
  const pendingApprovals = stats?.pendingApprovals ?? null;
  const heroDesc = pendingApprovals != null && pendingApprovals > 0
    ? `今日有 ${pendingApprovals} 项审批待处理`
    : '祝工作顺利 · 今日待办与全局动态已为您汇总';

  // KPI 从 6 张收敛为 4 张核心指标；待审批卡可点直达审批中心
  const metrics: Metric[] = [
    {
      label: '在职员工',
      value: stats?.employeeCount?.toString() ?? '0',
      suffix: '人',
      icon: IconUserGroup,
      hint: '实时统计',
    },
    {
      label: '今日出勤',
      value: stats?.attendanceCount?.toString() ?? '0',
      suffix: '人',
      icon: IconCheckCircle,
      hint: '今日打卡',
    },
    {
      label: '待审批',
      value: stats?.pendingApprovals?.toString() ?? '0',
      suffix: '项',
      icon: IconClockCircle,
      hint: '待处理',
      onClick: () => router.push('/approval/todo'),
    },
    {
      label: '本月工资',
      // 注意：接口未核算完成时返回 null，展示「—」而非「¥0.00」——
      // 0 会让人误以为工资真的为零（金额口径：后端以分存储，核算完成后换算展示）
      value: stats?.monthlySalary != null ? `¥${(stats.monthlySalary / 10000).toFixed(1)}万` : '—',
      icon: IconArchive,
      hint: '本月合计',
    },
  ];

  return (
    <PageContainer
      action={
        <Button
          type="primary"
          icon={<IconRefresh />}
          loading={loading}
          onClick={refreshStats}
        >
          刷新
        </Button>
      }
    >
      {/* 欢迎横幅 */}
      <div className="dsh-hero">
        <div>
          <h2 className="dsh-hero-title">{greeting()}，欢迎回来</h2>
          <p className="dsh-hero-desc">{heroDesc}</p>
        </div>
        <div className="dsh-hero-side">
          <span className="dsh-hero-chip">
            <IconCalendar style={{ color: 'var(--lx-primary)' }} />
            {todayText()}
          </span>
        </div>
      </div>

      {/* KPI 指标卡：加载中不摆出 0，失败展示错误态 + 重试，不再把 0 当真实数据 */}
      <div style={{ marginBottom: 24 }}>
        <DataState loading={loading} skeleton skeletonRows={1} error={error} onRetry={refreshStats}>
          <Row gutter={[16, 16]}>
            {metrics.map((m) => (
              <Col xs={12} md={6} key={m.label}>
                <StatCard
                  label={m.label}
                  value={m.value}
                  suffix={m.suffix}
                  icon={m.icon}
                  hint={m.hint}
                  onClick={m.onClick}
                />
              </Col>
            ))}
          </Row>
        </DataState>
      </div>

      {/* 组织管理看板（管理员可见） */}
      {can('system:user:view') && <OrgChart />}

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
              更多 <IconRight style={{ fontSize: 12 }} />
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
        renderIcon={(a) => {
          const Icon = quickIconOf(a);
          return <Icon />;
        }}
      />

      {/* 待办事项 + 最新通知（数据来自 stats 服务端裁剪字段；面板始终渲染，无权限/空数据走空态） */}
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
                <button type="button" className="dsh-feed-item" key={item.id} onClick={() => router.push('/approval/todo')}>
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
      </Row>

      {/* 考勤概览 + 我的申请进度（stats 服务端聚合字段） */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
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
              skeletonRows={2}
              error={error}
              onRetry={refreshStats}
              isEmpty={(stats?.mySubmissionsTop ?? []).length === 0}
              emptyText="暂无申请"
            >
              {(stats?.mySubmissionsTop ?? []).map((item) => {
                const s = SUBMISSION_STATUS[item.status] ?? {
                  label: item.status,
                  color: 'var(--lx-text-3)',
                };
                return (
                  <div className="dsh-feed-item" key={item.id}>
                    <span className="dsh-feed-dot" style={{ background: s.color }} />
                    <div className="dsh-feed-main">
                      <div className="dsh-feed-title">{item.title}</div>
                    </div>
                    <div className="dsh-feed-side">
                      <span style={{ fontSize: 12, color: s.color, fontWeight: 400 }}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </DataState>
          </div>
        </Col>
      </Row>
    </PageContainer>
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
