/**
 * 企业管理看板 - 增强分析版 (iCloud 风格)
 */
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Skeleton, Typography, Space, Tag, Empty, Button } from 'antd';
import { 
  TeamOutlined, 
  SafetyCertificateOutlined, 
  AccountBookOutlined, 
  AuditOutlined,
  BarChartOutlined,
  SyncOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  LineChartOutlined,
  AreaChartOutlined
} from '@ant-design/icons';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '../../api';
import RealtimeAttendanceCard from './RealtimeAttendanceCard';

const { Text } = Typography;

// --- 性能优化：使用 React.memo 封装静态指标卡片，防止重复重绘 ---
const StatCard = React.memo(({ title, value, suffix, subValue, subLabel, icon, color, trend }) => (
  <Card bordered={false} className="rounded-[32px] shadow-sm hover:shadow-md transition-all border-none h-full">
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-2xl ${color} text-white shadow-lg shadow-gray-100`}>
        {React.cloneElement(icon, { style: { fontSize: 20 } })}
      </div>
      {trend && (
        <Tag color={trend > 0 ? 'success' : 'error'} className="border-none rounded-full font-bold text-[10px]">
          {trend > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(trend)}%
        </Tag>
      )}
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
    <Statistic
      value={value}
      suffix={suffix}
      valueStyle={{ color: '#1d1d1f', fontWeight: 900, fontSize: 32, letterSpacing: '-1px' }}
    />
    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
      <Text className="text-[10px] font-bold text-slate-400">{subLabel}</Text>
      <Text className="text-xs font-black text-slate-700">{subValue}</Text>
    </div>
  </Card>
));

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 新增：静默刷新状态
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchAdminStats(true); // 首次加载显示 Skeleton

    // --- 性能优化：自动每 5 分钟静默刷新数据 ---
    const timer = setInterval(() => {
      fetchAdminStats(false);
    }, 1000 * 60 * 5);

    return () => clearInterval(timer);
  }, []);

  const fetchAdminStats = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    setRefreshing(true);
    try {
      const response = await api.get('/admin/dashboard/stats', {
        params: { user_id: localStorage.getItem('userId') }
      });
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('获取管理员统计数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f2f2f7] p-6 lg:p-10 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* 顶部操作条 */}
        <div className="flex justify-end mb-2">
          <Button 
            icon={<SyncOutlined spin={refreshing} />} 
            onClick={() => fetchAdminStats(true)}
            className="rounded-xl border-none shadow-sm font-bold text-xs bg-white h-10 px-6 hover:text-blue-600"
          >
            {refreshing ? '正在同步...' : '同步实时数据'}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-8">
            <Row gutter={[20, 20]}><Col span={24}><Skeleton active paragraph={{ rows: 2 }} /></Col></Row>
            <Row gutter={[20, 20]}>
              {[1,2,3,4].map(i => <Col key={i} xs={24} sm={12} lg={6}><Skeleton.Button active block style={{ height: 160, borderRadius: 32 }} /></Col>)}
            </Row>
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : (
          <>
            {/* 1. 核心指标矩阵 */}
            <Row gutter={[20, 20]}>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="用户规模" 
                  value={data?.overview?.totalUsers} 
                  subLabel="待审核用户" 
                  subValue={data?.overview?.pendingUsers}
                  icon={<TeamOutlined />} 
                  color="bg-blue-500"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="今日考勤率" 
                  value={data?.overview?.totalUsers ? (data.overview.todayClocks / data.overview.totalUsers * 100).toFixed(1) : 0} 
                  suffix="%"
                  subLabel="今日已签到" 
                  subValue={`${data?.overview?.todayClocks} 人`}
                  icon={<SafetyCertificateOutlined />} 
                  color="bg-emerald-500"
                  trend={2.4}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="本月报销支出" 
                  value={data?.overview?.monthReimbursement} 
                  prefix="¥"
                  subLabel="统计范围" 
                  subValue="已通过单据"
                  icon={<AccountBookOutlined />} 
                  color="bg-rose-500"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard 
                  title="系统操作轨迹" 
                  value={data?.overview?.todayLogs} 
                  subLabel="安全日志" 
                  subValue="今日总行为"
                  icon={<AuditOutlined />} 
                  color="bg-slate-800"
                />
              </Col>
            </Row>

            {/* 2. 趋势分析图表 - 新增 */}
            <Card 
              title={<Space><AreaChartOutlined className="text-blue-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">近七日活跃度与考勤趋势</span></Space>}
              bordered={false}
              className="rounded-[32px] shadow-sm border-none overflow-hidden"
            >
              <div className="h-[300px] w-full mt-4">
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
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} 
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      name="出勤率 (%)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Row gutter={[20, 20]}>
              {/* 部门实时考勤 */}
              <Col xs={24} lg={14}>
                <div className="h-full">
                  <RealtimeAttendanceCard />
                </div>
              </Col>

              {/* 报销费用分布 */}
              <Col xs={24} lg={10}>
                <Card 
                  title={<Space><BarChartOutlined className="text-indigo-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">本月费用分类统计</span></Space>} 
                  bordered={false} 
                  className="rounded-[32px] shadow-sm border-none h-full min-h-[400px]"
                >
                  <div className="h-[300px] w-full mt-4">
                    {data?.charts?.reimbursementByType?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.charts?.reimbursementByType} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                          />
                          <RechartsTooltip 
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="url(#barGradient)" 
                            radius={[6, 6, 0, 0]} 
                            barSize={32} 
                          >
                            <defs>
                              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" />
                                <stop offset="100%" stopColor="#818cf8" />
                              </linearGradient>
                            </defs>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center opacity-40">
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类数据" />
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
