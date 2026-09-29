'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Grid, Typography, Button, Message, Empty } from '@arco-design/web-react';
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
} from '@arco-design/web-react/icon';
import { BRAND_PRIMARY } from '@/lib/dashboard-tone';
import PageContainer from '@/components/PageContainer';
import { dashboardApi, DashboardStats, AttendanceTrendPoint, DepartmentStat } from '@/services/dashboard';
import { usePermission } from '@/hooks/use-permission';

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
      trend: '+2.3%',
    },
    {
      label: '今日出勤',
      value: stats?.attendanceCount?.toString() ?? '0',
      suffix: '人',
      icon: IconCheckCircle,
      trend: '95.2%',
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
      value: stats?.monthlySalary != null ? `¥${(stats.monthlySalary / 10000).toFixed(1)}万` : '¥0.00',
      icon: IconArchive,
      trend: '已核算',
    },
    {
      label: '今日迟到',
      value: stats?.todayLateCount?.toString() ?? '0',
      suffix: '人',
      icon: IconExclamation,
      trend: '较昨日',
    },
    {
      label: '本月加班',
      value: stats?.monthOvertimeHours != null ? `${stats.monthOvertimeHours}` : '0',
      suffix: '小时',
      icon: IconStorage,
      trend: '+8.5%',
    },
  ];
}

const TODO_ITEMS = [
  { id: 1, title: '张三的请假申请', type: '待审批', time: '10分钟前', priority: 'high' },
  { id: 2, title: '李四的报销申请', type: '待审批', time: '30分钟前', priority: 'medium' },
  { id: 3, title: '王五的补卡申请', type: '待审批', time: '1小时前', priority: 'low' },
  { id: 4, title: '月度考勤报表待确认', type: '待处理', time: '2小时前', priority: 'medium' },
];

const NOTIFICATION_ITEMS = [
  { id: 1, title: '本月工资条已发放', type: 'system', time: '今天 09:00' },
  { id: 2, title: '您的请假申请已通过', type: 'approval', time: '昨天 14:30' },
  { id: 3, title: '考勤规则已更新', type: 'system', time: '2天前' },
];

const dotColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'var(--lx-danger)';
    case 'medium': return 'var(--lx-warning)';
    case 'low': return 'var(--lx-primary)';
    default: return 'var(--lx-text-3)';
  }
};

const priorityText = (priority: string) => {
  switch (priority) {
    case 'high': return '紧急';
    case 'medium': return '普通';
    case 'low': return '一般';
    default: return '';
  }
};

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
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getStats();
      if (res.code === 0 && res.data) {
        setStats(res.data);
      }
    } catch (e) {
      Message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const metrics = buildMetrics(stats);

  return (
    <PageContainer
      action={
        <Button
          type="primary"
          icon={<IconRefresh />}
          loading={loading}
          onClick={fetchStats}
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
            <span className="dsh-panel-more">
              更多 <IconRight style={{ fontSize: 12 }} />
            </span>
          </div>
          <div className="dsh-quick-grid">
          {QUICK_ACTIONS.map((a, idx) => {
            const Icon = a.icon;
            return (
              <div
                key={a.path}
                className="dsh-quick-item"
                style={{ animationDelay: `${idx * 30}ms` }}
                onClick={() => router.push(a.path)}
              >
                <span className="dsh-quick-ic">
                  <Icon />
                </span>
                <span className="dsh-quick-label">{a.label}</span>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* 待办事项 + 最新通知 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">待办事项</h3>
              <span className="dsh-panel-more" onClick={() => router.push('/approval/todo')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </span>
            </div>
            <div>
              {TODO_ITEMS.map((item) => (
                <div className="dsh-feed-item" key={item.id} onClick={() => router.push('/approval/todo')}>
                  <span className="dsh-feed-dot" style={{ background: dotColor(item.priority) }} />
                  <div className="dsh-feed-main">
                    <div className="dsh-feed-title">{item.title}</div>
                    <div className="dsh-feed-meta">{item.type} · {item.time}</div>
                  </div>
                  <div className="dsh-feed-side">
                    <span
                      style={{
                        fontSize: 12,
                        color: dotColor(item.priority),
                        fontWeight: 400,
                      }}
                    >
                      {priorityText(item.priority)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">最新通知</h3>
              <span className="dsh-panel-more" onClick={() => router.push('/notifications')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </span>
            </div>
            <div>
              {NOTIFICATION_ITEMS.map((item) => (
                <div className="dsh-feed-item" key={item.id} onClick={() => router.push('/notifications')}>
                  <span className="dsh-feed-dot" style={{ background: item.type === 'system' ? BRAND_PRIMARY : 'var(--lx-success)' }} />
                  <div className="dsh-feed-main">
                    <div className="dsh-feed-title">{item.title}</div>
                    <div className="dsh-feed-meta">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>

      {/* 考勤概览 + 我的申请进度 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">本周考勤概览</h3>
              <span className="dsh-panel-more" onClick={() => router.push('/attendance/daily')}>
                查看详情 <IconRight style={{ fontSize: 12 }} />
              </span>
            </div>
            <div className="dsh-kpi">
              <div className="dsh-kpi-item">
                <div className="dsh-kpi-value" style={{ color: 'var(--lx-success)' }}>5</div>
                <div className="dsh-kpi-label">正常出勤</div>
              </div>
              <div className="dsh-kpi-divider" />
              <div className="dsh-kpi-item">
                <div className="dsh-kpi-value" style={{ color: 'var(--lx-warning)' }}>1</div>
                <div className="dsh-kpi-label">迟到</div>
              </div>
              <div className="dsh-kpi-divider" />
              <div className="dsh-kpi-item">
                <div className="dsh-kpi-value" style={{ color: 'var(--lx-danger)' }}>0</div>
                <div className="dsh-kpi-label">缺勤</div>
              </div>
              <div className="dsh-kpi-divider" />
              <div className="dsh-kpi-item">
                <div className="dsh-kpi-value" style={{ color: BRAND_PRIMARY }}>8.5h</div>
                <div className="dsh-kpi-label">平均工时</div>
              </div>
            </div>
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="dsh-panel">
            <div className="dsh-panel-head">
              <h3 className="dsh-panel-title">我的申请进度</h3>
              <span className="dsh-panel-more" onClick={() => router.push('/approval/submissions')}>
                查看全部 <IconRight style={{ fontSize: 12 }} />
              </span>
            </div>
            <div>
              {[
                { label: '年假申请（2天）', color: 'var(--lx-success)', status: '已通过' },
                { label: '加班申请（3小时）', color: 'var(--lx-warning)', status: '审批中' },
                { label: '报销申请（交通费）', color: BRAND_PRIMARY, status: '待提交' },
              ].map((it) => (
                <div className="dsh-feed-item" key={it.label}>
                  <span className="dsh-feed-dot" style={{ background: it.color }} />
                  <div className="dsh-feed-main">
                    <div className="dsh-feed-title">{it.label}</div>
                  </div>
                  <div className="dsh-feed-side">
                    <span style={{ fontSize: 12, color: it.color }}>{it.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>
    </PageContainer>
  );
}

// ====== 组织管理看板（仅有系统管理权限展示）：部门人力分布 + 近 7 日考勤趋势 ======
function OrgChart() {
  const [depts, setDepts] = useState<DepartmentStat[]>([]);
  const [trend, setTrend] = useState<AttendanceTrendPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, tRes] = await Promise.all([
          dashboardApi.getDepartmentStats(),
          dashboardApi.getAttendanceTrend(7),
        ]);
        if (dRes.code === 0 && dRes.data) setDepts(dRes.data);
        if (tRes.code === 0 && tRes.data) setTrend(tRes.data);
      } catch (e) {
        Message.error('获取组织数据失败');
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const maxDept = Math.max(1, ...depts.map((d) => d.count));
  const maxDay = Math.max(1, ...trend.map((p) => p.present));

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} lg={10}>
        <div className="dsh-panel">
          <div className="dsh-panel-head">
            <h3 className="dsh-panel-title">部门人力分布</h3>
          </div>
            {!loaded ? (
              <Empty description="加载中" />
            ) : depts.length === 0 ? (
              <Empty description="暂无部门数据" />
            ) : (
              <div className="flex flex-col gap-3 py-2">
                {depts.map((d) => (
                  <div key={d.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <Text type="secondary">{d.name}</Text>
                      <Text style={{ fontWeight: 500 }}>{d.count} 人</Text>
                    </div>
                    <div className="h-2 bg-bg-3 rounded overflow-hidden">
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
            {!loaded ? (
              <Empty description="加载中" />
            ) : trend.length === 0 ? (
              <Empty description="暂无考勤数据" />
            ) : (
              <div className="flex items-end justify-between gap-3 py-3" style={{ height: 140 }}>
                {trend.map((p) => (
                  <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-text-2">{p.present}</span>
                    <div
                      className="w-full max-w-[28px] rounded-t"
                      style={{
                        height: `${(p.present / maxDay) * 90 + 6}px`,
                        background: BRAND_PRIMARY,
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