import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Statistic, Skeleton, Typography, Space, Tag, Empty, Button, ConfigProvider } from 'antd';
import { 
    LayoutDashboard,
    Users,
    ShieldCheck,
    Wallet,
    History,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    LineChart,
    BarChart3,
    Activity,
    Clock,
    PieChart
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '../../api';
import RealtimeAttendanceCard from './RealtimeAttendanceCard';

const { Text } = Typography;

// --- 1. 子组件：精致统计磁贴 ---
const StatCard = React.memo(({ title, value, suffix, subValue, subLabel, icon: Icon, colorClass, trend }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-xl hover:border-blue-500/20 transition-all duration-500 group relative overflow-hidden h-full">
    {/* 背景修饰 */}
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] transition-transform group-hover:scale-150 duration-700 ${colorClass}`} />
    
    <div className="flex items-start justify-between mb-6 relative z-10">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${colorClass}`}>
        <Icon size={22} strokeWidth={2.5} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>

    <div className="relative z-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">{title}</p>
        <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-800 tracking-tighter">{value || 0}</span>
            {suffix && <span className="text-xs font-black text-slate-400">{suffix}</span>}
        </div>
    </div>

    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between relative z-10">
      <span className="text-[10px] font-bold text-slate-400">{subLabel}</span>
      <span className="text-[11px] font-black text-slate-700">{subValue}</span>
    </div>
  </div>
));

// --- 2. 主看板组件 ---
const AdminDashboard = () => {
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
      const response = await api.get('/admin/dashboard/stats', {
        params: { user_id: localStorage.getItem('userId') }
      });
      if (response.data.success) setData(response.data.data);
    } catch (e) {
      toast.error('数据同步失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const syncTime = useMemo(() => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), [data]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#2563eb', borderRadius: 12 } }}>
    <div className="min-h-full bg-[#f8fafc] p-6 lg:p-10 animate-in fade-in duration-700 select-none">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 极致单行顶栏 */}
        <div className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-2xl shadow-sm p-3 mb-4 sticky top-0 z-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 pl-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                <LayoutDashboard size={18} />
            </div>
            <div className="flex flex-col">
                <h1 className="text-sm font-black text-slate-800">企业数字化看板</h1>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Clock size={8} /> 最后同步时间: {syncTime}
                </span>
            </div>
          </div>

          <button 
            onClick={() => fetchAdminStats(true)}
            className="bg-white border border-slate-200 text-slate-600 font-black py-1.5 px-6 rounded-xl text-[10px] hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex items-center gap-2"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            {refreshing ? '正在拉取...' : '同步实时数据'}
          </button>
        </div>

        {loading ? (
          <div className="space-y-8">
            <Row gutter={[20, 20]}><Col span={24}><Skeleton active paragraph={{ rows: 2 }} /></Col></Row>
            <Row gutter={[20, 20]}>
              {[1,2,3,4].map(i => <Col key={i} xs={24} sm={12} lg={6}><Skeleton.Button active block style={{ height: 180, borderRadius: 16 }} /></Col>)}
            </Row>
          </div>
        ) : (
          <>
            {/* 指标矩阵 */}
            <Row gutter={[20, 20]}>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="全员用户规模" 
                  value={data?.overview?.totalUsers} 
                  subLabel="当前待审核" 
                  subValue={`${data?.overview?.pendingUsers || 0} 位`}
                  icon={Users} 
                  colorClass="bg-gradient-to-br from-blue-500 to-blue-700"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="今日综合出勤率" 
                  value={data?.overview?.totalUsers ? (data.overview.todayClocks / data.overview.totalUsers * 100).toFixed(1) : 0} 
                  suffix="%"
                  subLabel="实到人数" 
                  subValue={`${data?.overview?.todayClocks || 0} 人`}
                  icon={ShieldCheck} 
                  colorClass="bg-gradient-to-br from-emerald-500 to-teal-600"
                  trend={2.4}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="本月运营支出" 
                  value={data?.overview?.monthReimbursement || 0} 
                  suffix="元 (人民币)"
                  subLabel="报销统计" 
                  subValue="已核销单据"
                  icon={Wallet} 
                  colorClass="bg-gradient-to-br from-indigo-500 to-indigo-700"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="全站操作审计" 
                  value={data?.overview?.todayLogs || 0} 
                  subLabel="安全轨迹" 
                  subValue="今日总触发"
                  icon={History} 
                  colorClass="bg-gradient-to-br from-slate-700 to-slate-900"
                />
              </Col>
            </Row>

            {/* 趋势分析图表 */}
            <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Activity size={18} /></div>
                    <h3 className="text-sm font-black text-slate-800">近七日系统活跃度与出勤趋势</h3>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" /><span className="text-[10px] font-black text-slate-400 uppercase">出勤比率</span></div>
                </div>
              </div>
              
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={data?.charts?.attendanceTrend || [
                      { name: '周一', value: 85 }, { name: '周二', value: 88 }, 
                      { name: '周三', value: 92 }, { name: '周四', value: 90 }, 
                      { name: '周五', value: 95 }, { name: '周六', value: 40 }, { name: '周日', value: 35 }
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 900, color: '#1e293b' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#2563eb" 
                      strokeWidth={4}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      name="出勤率"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Row gutter={[20, 20]}>
              <Col xs={24} lg={14}>
                <RealtimeAttendanceCard />
              </Col>

              <Col xs={24} lg={10}>
                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><PieChart size={18} /></div>
                    <h3 className="text-sm font-black text-slate-800">月度运营费用分布</h3>
                  </div>
                  
                  <div className="flex-1 min-h-[300px]">
                    {data?.charts?.reimbursementByType?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.charts?.reimbursementByType} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="value" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={28}>
                            <defs>
                              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#4f46e5" />
                                <stop offset="100%" stopColor="#818cf8" />
                              </linearGradient>
                            </defs>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center opacity-30"><Empty description="暂无数据" /></div>
                    )}
                  </div>
                </div>
              </Col>
            </Row>
          </>
        )}
      </div>
    </div>
    </ConfigProvider>
  );
};

export default AdminDashboard;
