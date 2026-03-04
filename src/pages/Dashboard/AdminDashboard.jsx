/**
 * 公司概况看板 (雷犀旗舰办公版 - 轻量白话版)
 * 
 * 遵守 smart-cs-pro-ui-pro 准则：
 * 1. 零缩水：保留所有 API 请求、自动刷新、点击跳转、实时卡片逻辑。
 * 2. 交互闭环：确保 StatCard 和快捷链接的 onNavigate 依然生效。
 * 3. 视觉轻量：移除沉重的装饰，使用通俗易懂的“白话”文案。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Statistic, Skeleton, Typography, Space, Tag, Empty, Button, ConfigProvider, Divider, Avatar } from 'antd';
import { 
    HomeOutlined,
    UserOutlined,
    CheckCircleOutlined,
    WalletOutlined,
    HistoryOutlined,
    SyncOutlined,
    RiseOutlined,
    FallOutlined,
    LineChartOutlined,
    ClockCircleOutlined,
    PieChartOutlined,
    ArrowRightOutlined,
    SettingOutlined,
    DatabaseOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    CoffeeOutlined,
    SmileOutlined
} from '@ant-design/icons';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '../../api';
import RealtimeAttendanceCard from './RealtimeAttendanceCard';
import { toast } from 'sonner';

const { Text } = Typography;

// --- 轻量指标卡 ---
const StatCard = React.memo(({ title, value, suffix, subValue, subLabel, icon: Icon, colorClass, trend, onClick }) => (
  <div 
    onClick={onClick}
    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-lg hover:border-emerald-500/30 transition-all duration-300 cursor-pointer flex flex-col h-full group"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${colorClass} shadow-sm group-hover:scale-110 transition-transform`}>
        <Icon style={{ fontSize: 20 }} />
      </div>
      {trend && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend > 0 ? '涨了' : '跌了'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    
    <div className="text-left flex-1">
      <p className="text-xs font-bold text-slate-400 mb-1">{title}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-slate-800">{value || 0}</span>
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>

    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
      <span className="text-[10px] text-slate-400">{subLabel}</span>
      <span className="text-[10px] font-bold text-slate-600">{subValue}</span>
    </div>
  </div>
));

const AdminDashboard = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAdminStats(true);
    const timer = setInterval(() => fetchAdminStats(false), 1000 * 60 * 5);
    return () => clearInterval(timer);
  }, []);

  const fetchAdminStats = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setRefreshing(true);
    try {
      const response = await api.get('/admin/dashboard/stats');
      if (response.data.success) setData(response.data.data);
    } catch (e) {
      toast.error('数据没拿到，刷新一下试试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const syncTime = useMemo(() => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), [data]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#07C160', borderRadius: 12 } }}>
    <div className="min-h-full bg-[#f8fafc] p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* 简洁页头 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
          <div className="text-left">
            <h1 className="text-xl font-bold text-slate-800 m-0 flex items-center gap-2">
              <SmileOutlined className="text-emerald-500" /> 这里是公司最近的情况
            </h1>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <ClockCircleOutlined /> 数据是 {syncTime} 更新的，自动同步开启中
            </p>
          </div>
          <Button 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={() => fetchAdminStats(true)} 
            className="rounded-xl border-slate-200 font-bold text-slate-600 hover:text-emerald-500 hover:border-emerald-500"
          >
            {refreshing ? '正在刷新...' : '手动刷新一下'}
          </Button>
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : (
          <>
            {/* 核心指标 */}
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                    title="公司总人数" 
                    value={data?.overview?.totalUsers} 
                    subLabel="还没过审的" 
                    subValue={`${data?.overview?.pendingUsers || 0} 个人`} 
                    icon={UserOutlined} 
                    colorClass="bg-blue-500" 
                    onClick={() => onNavigate?.('user-employee')}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                    title="今天出勤怎么样" 
                    value={data?.overview?.totalUsers ? (data.overview.todayClocks / data.overview.totalUsers * 100).toFixed(1) : 0} 
                    suffix="%" 
                    subLabel="实到人数" 
                    subValue={`${data?.overview?.todayClocks || 0} 个人`} 
                    icon={CheckCircleOutlined} 
                    colorClass="bg-emerald-500" 
                    trend={2.4} 
                    onClick={() => onNavigate?.('attendance-approval')}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                    title="这个月花了多少钱" 
                    value={data?.overview?.monthReimbursement || 0} 
                    suffix="元" 
                    subLabel="已经报销的" 
                    subValue="财务已确认" 
                    icon={WalletOutlined} 
                    colorClass="bg-orange-500" 
                    onClick={() => onNavigate?.('reimbursement-approval')}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                    title="今天系统干了啥" 
                    value={data?.overview?.todayLogs || 0} 
                    subLabel="操作记录" 
                    subValue="今日触发" 
                    icon={HistoryOutlined} 
                    colorClass="bg-slate-600" 
                    onClick={() => onNavigate?.('system-logs')}
                />
              </Col>
            </Row>

            {/* 流程设置直达 */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                    <SettingOutlined className="text-emerald-500" />
                    <h3 className="text-sm font-bold text-slate-700 m-0">快速设置审批流程</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { title: '领东西流程', desc: '设置电脑等资产怎么领', icon: <SyncOutlined />, tab: 'system-workflow', color: 'bg-blue-50 text-blue-500' },
                        { title: '报销怎么批', desc: '设置报销单谁来看、怎么批', icon: <SettingOutlined />, tab: 'approval-workflow-config', color: 'bg-emerald-50 text-emerald-500' },
                        { title: '谁来负责批', desc: '给不同的人分配审批权力', icon: <UserOutlined />, tab: 'role-workflow-config', color: 'bg-purple-50 text-purple-500' }
                    ].map(link => (
                        <div key={link.tab} onClick={() => onNavigate?.(link.tab)} className="p-4 rounded-xl border border-slate-50 hover:border-emerald-500 hover:bg-emerald-50/20 transition-all cursor-pointer group flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${link.color} flex items-center justify-center transition-colors`}>{link.icon}</div>
                                <div className="text-left">
                                    <div className="text-xs font-bold text-slate-700">{link.title}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{link.desc}</div>
                                </div>
                            </div>
                            <ArrowRightOutlined className="text-slate-200 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                        </div>
                    ))}
                </div>
            </div>

            {/* 图表区 */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2 text-left">
                            <LineChartOutlined className="text-emerald-500" />
                            <h3 className="text-sm font-bold text-slate-700 m-0">最近一周出勤情况</h3>
                        </div>
                        <Tag color="success" className="m-0 border-none px-2 text-[10px] font-bold">实到比率</Tag>
                    </div>
                    <div className="h-[280px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data?.charts?.attendanceTrend || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dx={-10} />
                            <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                            <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" name="出勤率" />
                        </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={14}><RealtimeAttendanceCard /></Col>
                    <Col xs={24} lg={10}>
                        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-6 text-left">
                                <PieChartOutlined className="text-orange-500" />
                                <h3 className="text-sm font-bold text-slate-700 m-0">钱都花哪了 (按分类)</h3>
                            </div>
                            <div className="flex-1 min-h-[260px]">
                                {data?.charts?.reimbursementByType?.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data?.charts?.reimbursementByType} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dx={-10} tickFormatter={(v) => `¥${v}`} />
                                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={24} name="报销总额" />
                                    </BarChart>
                                </ResponsiveContainer>
                                ) : <div className="h-full flex items-center justify-center opacity-30"><Empty description="还没花钱数据" /></div>}
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            <div className="py-8 text-center opacity-40">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.4em]">
                    雷犀系统 · 数字化运行中枢
                </span>
            </div>
          </>
        )}
      </div>
    </div>
    </ConfigProvider>
  );
};

export default AdminDashboard;
