'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Grid, Typography, Button, Empty, Spin } from '@arco-design/web-react';
import {
  IconUserGroup,
  IconCheckCircle,
  IconClockCircle,
  IconRight,
  IconRefresh,
  IconCalendar,
  IconBook,
  IconStorage,
  IconUser,
  IconEdit,
  IconArchive,
  IconExclamation,
  IconLink,
} from '@arco-design/web-react/icon';
import { BRAND_PRIMARY, brandBarGradient } from '@/lib/dashboard-tone';
import PageContainer from '@/components/PageContainer';
import QuickActionsManager from '@/components/QuickActionsManager';
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

function buildMetrics(stats: DashboardStats | null) {
  return [
    {
      label: '在职员工',
      value: stats?.employeeCount?.toString() ?? '0',
      suffix: '人',
      icon: IconUserGroup,
      trend: '实时统计',
    },
    {
      label: '今日出勤',
      value: stats?.attendanceCount?.toString() ?? '0',
      suffix: '人',
      icon: IconCheckCircle,
      trend: '今日打卡',
    },
    {
      label: '待审批',
      value: stats?.pendingApprovals?.toString() ?? '0',
      suffix: '项',
      icon: IconClockCircle,
      trend: '待处理',
    },
    {
      label: '本月工资',
      // 注意：接口未核算完成时返回 null，展示「—」而非「¥0.00」——
      // 0 会让人误以为工资真的为零（金额口径：后端以分存储，核算完成后换算展示）
      value: stats?.monthlySalary != null ? `¥${(stats.monthlySalary / 10000).toFixed(1)}万` : '—',
      icon: IconArchive,
      trend: '本月合计',
    },
    {
      label: '今日迟到',
      value: stats?.todayLateCount?.toString() ?? '0',
      suffix: '人',
      icon: IconExclamation,
      trend: '今日',
    },
    {
      label: '本月加班',
      value: stats?.monthOvertimeHours != null ? `${stats.monthOvertimeHours}` : '0',
      suffix: '小时',
      icon: IconStorage,
      trend: '本月累计',
    },
  ];
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

/** 待办圆点：统一品牌蓝 + 呼吸光晕（--dot-c 供脉冲动画取色） */
const todoDotStyle = {
  background: 'var(--lx-primary)',
  '--dot-c': 'var(--lx-primary)',
} as React.CSSProperties;

/** 通知圆点：未读用类型色点亮，已读灰化 */
const notificationDotColor = (item: DashboardNotificationItem): string => {
  if (item.read) return 'var(--lx-text-4)';
  return item.type === 'system' ? BRAND_PRIMARY : 'var(--lx-success)';
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

/** 解析字符串中的数值段（保留前后缀与小数位），如 '¥12.5万' → {prefix:'¥', num:'12.5', suffix:'万'} */
function parseNumberPart(text: string): { prefix: string; num: string; suffix: string; decimals: number } | null {
  const m = text.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  return { prefix: m[1], num: m[2], suffix: m[3], decimals: (m[2].split('.')[1] ?? '').length };
}

/** 数字滚动：目标值从 0 缓动滚到真实值，非数字（如 '—'）原样渲染 */
function Ticker({ text }: { text: string }) {
  const part = parseNumberPart(text);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!part) return;
    const target = parseFloat(part.num);
    let raf = 0;
    const t0 = performance.now();
    const ms = 650;
    const tick = (t: number) => {
      const k = Math.min((t - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  if (!part) return <>{text}</>;
  return (
    <>
      {part.prefix}
      {value.toFixed(part.decimals)}
      {part.suffix}
    </>
  );
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
    if (res.code === 0 && res.data) return res.data;
    throw new Error(res.message || '获取统计数据失败');
  }, []);
  const { data: stats, loading, revalidate: refreshStats } = useCachedData<DashboardStats>(
    'dashboard:stats',
    fetchStats,
  );

  const metrics = buildMetrics(stats);

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
          <p className="dsh-hero-desc">祝工作顺利 · 今日待办与全局动态已为您汇总</p>
        </div>
        <div className="dsh-hero-side">
          <span className="dsh-hero-chip">
            <IconCalendar style={{ color: 'var(--lx-primary)' }} />
            {todayText()}
          </span>
        </div>
      </div>

      {/* KPI 指标卡 */}
      <div style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <Col xs={12} md={6} xl={4} key={m.label}>
                <div
                  className="dsh-stat"
                  style={{ padding: 16, background: 'var(--lx-bg-card)', animationDelay: `${idx * 40}ms` }}
                >
                  <div className="dsh-stat-top">
                    <span className="dsh-stat-ic">
                      <Icon style={{ fontSize: 18 }} />
                    </span>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {m.trend}
                    </Text>
                  </div>
                  <div className="dsh-stat-value">
                    {loading ? '—' : <Ticker text={m.value} />}
                    {m.suffix && <span className="u">{m.suffix}</span>}
                  </div>
                  <div className="dsh-stat-label">{m.label}</div>
                </div>
              </Col>
            );
          })}
        </Row>
      </div>

      {/* 组织管理看板（管理员可见） */}
      {can('system:user:view') && <OrgChart />}

      {/* 快捷操作 */}
      <div style={{ marginBottom: 16 }}>
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
          {quick.visible.map((a, idx) => {
            const Icon = quickIconOf(a);
            return (
              <button
                key={a.key}
                type="button"
                className="dsh-quick-item"
                style={{ animationDelay: `${idx * 30}ms` }}
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
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">待办事项</h3>
              <button type="button" className="dsh-panel-more" onClick={() => router.push('/approval/todo')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </button>
            </div>
            <div>
              {(stats?.todoTop ?? []).length === 0 ? (
                <Empty description="暂无待办" />
              ) : (
                stats!.todoTop!.map((item) => (
                  <button type="button" className="dsh-feed-item" key={item.id} onClick={() => router.push('/approval/todo')}>
                    <span className="dsh-feed-dot is-pulse" style={todoDotStyle} />
                    <div className="dsh-feed-main">
                      <div className="dsh-feed-title">{item.title}</div>
                      <div className="dsh-feed-meta">待审批 · {relativeTime(item.createdAt)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">最新通知</h3>
              <button type="button" className="dsh-panel-more" onClick={() => router.push('/notifications')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </button>
            </div>
            <div>
              {(stats?.notificationTop ?? []).length === 0 ? (
                <Empty description="暂无通知" />
              ) : (
                stats!.notificationTop!.map((item) => (
                  <button type="button" className="dsh-feed-item" key={item.id} onClick={() => router.push('/notifications')}>
                    <span className="dsh-feed-dot" style={{ background: notificationDotColor(item) }} />
                    <div className="dsh-feed-main">
                      <div className="dsh-feed-title">{item.title}</div>
                      <div className="dsh-feed-meta">{relativeTime(item.createdAt)}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* 考勤概览 + 我的申请进度（stats 服务端聚合字段） */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">本周考勤概览</h3>
              <button type="button" className="dsh-panel-more" onClick={() => router.push('/attendance/daily')}>
                查看详情 <IconRight style={{ fontSize: 12 }} />
              </button>
            </div>
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
                <div className="dsh-kpi-value" style={{ color: BRAND_PRIMARY }}>
                  {stats?.myWeek ? `${stats.myWeek.avgWorkHours}h` : '—'}
                </div>
                <div className="dsh-kpi-label">平均工时</div>
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">我的申请进度</h3>
              <button type="button" className="dsh-panel-more" onClick={() => router.push('/approval/submissions')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </button>
            </div>
            <div>
              {(stats?.mySubmissionsTop ?? []).length === 0 ? (
                <Empty description="暂无申请" />
              ) : (
                stats!.mySubmissionsTop!.map((item) => {
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
                })
              )}
            </div>
          </div>
        </Col>
      </Row>
    </PageContainer>
  );
}

// ====== 组织管理看板（仅有系统管理权限展示）：部门人力分布 + 近 7 日考勤趋势 ======
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
  const { data: depts, loading: deptsLoading } = useCachedData<DepartmentStat[]>(
    'dashboard:dept-stats',
    fetchDepts,
  );
  const { data: trend, loading: trendLoading } = useCachedData<AttendanceTrendPoint[]>(
    'dashboard:attendance-trend:7',
    fetchTrend,
  );

  const deptList = depts ?? [];
  const trendList = trend ?? [];
  const maxDept = Math.max(1, ...deptList.map((d) => d.count));
  const maxDay = Math.max(1, ...trendList.map((p) => p.present));

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} lg={10}>
        <div className="dsh-panel">
          <div className="dsh-panel-head">
            <h3 className="dsh-panel-title">部门人力分布</h3>
          </div>
            {deptsLoading ? (
              <Spin />
            ) : deptList.length === 0 ? (
              <Empty description="暂无部门数据" />
            ) : (
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
                          background: `linear-gradient(90deg, var(--lx-primary), var(--lx-primary-400))`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Col>
        <Col xs={24} lg={14}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">近 7 日考勤趋势</h3>
            </div>
            {trendLoading ? (
              <Spin />
            ) : trendList.length === 0 ? (
              <Empty description="暂无考勤数据" />
            ) : (
              <div className="flex items-end justify-between gap-3 py-3" style={{ height: 140 }}>
                {trendList.map((p) => (
                  <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-text-2">{p.present}</span>
                    <div
                      className="w-full max-w-[28px] rounded-t"
                      style={{
                        height: `${(p.present / maxDay) * 90 + 6}px`,
                        background: brandBarGradient(),
                      }}
                      title={`${p.date}：出勤 ${p.present}，迟到 ${p.late}，请假 ${p.leave}，缺勤 ${p.absent}`}
                    />
                    <span className="text-xs text-text-3">{p.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Col>
      </Row>
  );
}