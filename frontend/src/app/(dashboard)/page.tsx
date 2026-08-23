'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Grid, Typography, Button, Message, List, Tag, Avatar, Badge } from '@arco-design/web-react';
import {
  IconUserGroup,
  IconCheckCircle,
  IconClockCircle,
  IconRight,
  IconRefresh,
  IconCalendar,
  IconBook,
  IconNotification,
  IconStorage,
  IconUser,
  IconEdit,
  IconPlus,
  IconExclamation,
  IconArchive,
} from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import { dashboardApi, DashboardStats } from '@/services/dashboard';

const { Row, Col } = Grid;
const { Title, Text } = Typography;

interface QuickAction {
  label: string;
  path: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  color: string;
  bgColor: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: '员工管理', path: '/employees', icon: IconUserGroup, color: '#2455D9', bgColor: 'linear-gradient(135deg, rgba(36,85,217,0.1), rgba(36,85,217,0.03))' },
  { label: '打卡', path: '/attendance/punch', icon: IconClockCircle, color: '#22c55e', bgColor: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.03))' },
  { label: '考勤日报', path: '/attendance/daily', icon: IconCheckCircle, color: '#f59e0b', bgColor: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.03))' },
  { label: '请假申请', path: '/attendance/vacation/leave', icon: IconCalendar, color: '#8b5cf6', bgColor: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.03))' },
  { label: '加班申请', path: '/attendance/vacation/overtime', icon: IconEdit, color: '#14b8a6', bgColor: 'linear-gradient(135deg, rgba(20,184,166,0.1), rgba(20,184,166,0.03))' },
  { label: '报销申请', path: '/expense/my', icon: IconArchive, color: '#ef4444', bgColor: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.03))' },
  { label: '知识库', path: '/knowledge', icon: IconBook, color: '#6366f1', bgColor: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.03))' },
  { label: '绩效管理', path: '/performance/cycles', icon: IconCalendar, color: '#8b5cf6', bgColor: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.03))' },
  { label: '工单客服', path: '/helpdesk', icon: IconUser, color: '#14b8a6', bgColor: 'linear-gradient(135deg, rgba(20,184,166,0.1), rgba(20,184,166,0.03))' },
];

const METRIC_ICON_CONFIGS = [
  { bg: 'linear-gradient(135deg, rgba(36,85,217,0.12), rgba(36,85,217,0.04))', color: '#2455D9' },
  { bg: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))', color: '#22c55e' },
  { bg: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', color: '#f59e0b' },
  { bg: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))', color: '#8b5cf6' },
  { bg: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))', color: '#ef4444' },
  { bg: 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(20,184,166,0.04))', color: '#14b8a6' },
];

function buildMetrics(stats: DashboardStats | null) {
  return [
    {
      label: '在职员工',
      value: stats?.employeeCount?.toString() ?? '0',
      suffix: '人',
      icon: IconUserGroup,
      iconIndex: 0,
      trend: '+2.3%',
      trendUp: true,
    },
    {
      label: '今日出勤',
      value: stats?.attendanceCount?.toString() ?? '0',
      suffix: '人',
      icon: IconCheckCircle,
      iconIndex: 1,
      trend: '95.2%',
      trendUp: true,
    },
    {
      label: '待审批',
      value: stats?.pendingApprovals?.toString() ?? '0',
      suffix: '项',
      icon: IconClockCircle,
      iconIndex: 2,
      trend: '待处理',
      trendUp: false,
    },
    {
      label: '本月工资',
      value: stats?.monthlySalary != null ? `¥${(stats.monthlySalary / 10000).toFixed(1)}万` : '¥0.00',
      icon: IconArchive,
      iconIndex: 3,
      trend: '已核算',
      trendUp: true,
    },
    {
      label: '今日迟到',
      value: '3',
      suffix: '人',
      icon: IconExclamation,
      iconIndex: 4,
      trend: '较昨日',
      trendUp: false,
    },
    {
      label: '本月加班',
      value: '128',
      suffix: '小时',
      icon: IconStorage,
      iconIndex: 5,
      trend: '+8.5%',
      trendUp: true,
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

export default function HomePage() {
  const router = useRouter();
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'blue';
      default: return 'gray';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '紧急';
      case 'medium': return '普通';
      case 'low': return '一般';
      default: return '';
    }
  };

  return (
    <PageContainer
      title="工作台"
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
      <div>
        {/* 数据统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            const iconConfig = METRIC_ICON_CONFIGS[m.iconIndex] || METRIC_ICON_CONFIGS[0];
            return (
              <Col span={4} key={m.label}>
                <Card
                  hoverable
                  className="lx-card-hover lx-hover-lift"
                  bodyStyle={{ padding: 18 }}
                  loading={loading}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: iconConfig.bg }}
                    >
                      <Icon style={{ fontSize: 22, color: iconConfig.color }} />
                    </div>
                    <Tag
                      color={m.trendUp ? 'green' : 'orange'}
                      size="small"
                      style={{ borderRadius: 4 }}
                    >
                      {m.trend}
                    </Tag>
                  </div>
                  <div className="text-xs text-text-3 mb-1">
                    {m.label}
                  </div>
                  <div className="text-2xl font-semibold text-text-1 tracking-tight">
                    {m.value}
                    {m.suffix && (
                      <span className="text-sm font-normal text-text-3 ml-1">
                        {m.suffix}
                      </span>
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>

        {/* 快捷操作 */}
        <div style={{ marginBottom: 24 }}>
          <div className="flex items-center justify-between mb-3">
            <Title heading={5} style={{ margin: 0 }}>
              快捷操作
            </Title>
            <Text type="secondary" style={{ fontSize: 12, cursor: 'pointer' }}>
              更多 <IconRight style={{ fontSize: 12 }} />
            </Text>
          </div>
          <Row gutter={[12, 12]}>
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <Col span={3} key={a.path}>
                  <Card
                    hoverable
                    className="lx-card-hover lx-hover-lift"
                    bodyStyle={{ padding: 14 }}
                    style={{ cursor: 'pointer', animationDelay: `${QUICK_ACTIONS.indexOf(a) * 40}ms` }}
                    onClick={() => router.push(a.path)}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-2"
                        style={{ background: a.bgColor }}
                      >
                        <Icon style={{ fontSize: 22, color: a.color }} />
                      </div>
                      <span className="text-xs font-medium text-text-2">
                        {a.label}
                      </span>
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>

        {/* 待办事项 + 最新通知 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card
              title="待办事项"
              extra={
                <Button
                  type="text"
                  size="small"
                  onClick={() => router.push('/approval/todo')}
                >
                  查看全部
                </Button>
              }
              bodyStyle={{ padding: 0 }}
            >
              <List
                size="small"
                dataSource={TODO_ITEMS}
                render={(item) => (
                  <List.Item key={item.id}>
                    <List.Item.Meta
                      avatar={
                        <Badge dot color={getPriorityColor(item.priority)}>
                          <Avatar size={36}>
                            <IconClockCircle style={{ fontSize: 18 }} />
                          </Avatar>
                        </Badge>
                      }
                      title={
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-text-1">
                            {item.title}
                          </span>
                          <Tag color={getPriorityColor(item.priority)} size="small">
                            {getPriorityText(item.priority)}
                          </Tag>
                        </div>
                      }
                      description={
                        <div className="flex items-center justify-between mt-1">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.type}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.time}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title="最新通知"
              extra={
                <Button
                  type="text"
                  size="small"
                  onClick={() => router.push('/notifications')}
                >
                  查看全部
                </Button>
              }
              bodyStyle={{ padding: 0 }}
            >
              <List
                size="small"
                dataSource={NOTIFICATION_ITEMS}
                render={(item) => (
                  <List.Item key={item.id}>
                    <List.Item.Meta
                      avatar={
                        <Avatar size={36}>
                          <IconNotification style={{ fontSize: 18 }} />
                        </Avatar>
                      }
                      title={item.title}
                      description={item.time}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>

        {/* 考勤概览 + 我的审批 */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card
              title="本周考勤概览"
              extra={
                <Button
                  type="text"
                  size="small"
                  onClick={() => router.push('/attendance/daily')}
                >
                  查看详情
                </Button>
              }
            >
              <div className="flex items-center justify-around py-4">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-success mb-1">5</div>
                  <div className="text-xs text-text-3">正常出勤</div>
                </div>
                <div className="w-px h-10 bg-border-2" />
                <div className="text-center">
                  <div className="text-2xl font-semibold text-warning mb-1">1</div>
                  <div className="text-xs text-text-3">迟到</div>
                </div>
                <div className="w-px h-10 bg-border-2" />
                <div className="text-center">
                  <div className="text-2xl font-semibold text-danger mb-1">0</div>
                  <div className="text-xs text-text-3">缺勤</div>
                </div>
                <div className="w-px h-10 bg-border-2" />
                <div className="text-center">
                  <div className="text-2xl font-semibold text-brand mb-1">8.5h</div>
                  <div className="text-xs text-text-3">平均工时</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title="我的申请进度"
              extra={
                <Button
                  type="text"
                  size="small"
                  onClick={() => router.push('/approval/submissions')}
                >
                  查看全部
                </Button>
              }
            >
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-success mr-3" />
                    <span className="text-sm text-text-1">年假申请（2天）</span>
                  </div>
                  <Tag color="green" size="small">已通过</Tag>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-warning mr-3" />
                    <span className="text-sm text-text-1">加班申请（3小时）</span>
                  </div>
                  <Tag color="orange" size="small">审批中</Tag>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-brand mr-3" />
                    <span className="text-sm text-text-1">报销申请（交通费）</span>
                  </div>
                  <Tag color="blue" size="small">待提交</Tag>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </PageContainer>
  );
}
