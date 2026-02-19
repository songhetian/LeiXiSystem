/**
 * 系统首页工作台 - 全磁贴桌面版
 */
import React, { useState, useEffect } from 'react';
import { Row, Col, Statistic, Tag, Button, Empty, Skeleton, Typography, Space, Modal, Checkbox, message, Card } from 'antd';
import {
  UserOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  CalendarOutlined,
  WalletOutlined,
  BellOutlined,
  ArrowRightOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  RightOutlined,
  SettingOutlined,
  MessageOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  BookOutlined,
  BarChartOutlined,
  StarOutlined,
  SolutionOutlined,
  SecurityScanOutlined,
  HistoryOutlined,
  TagsOutlined,
  ShopOutlined,
  DesktopOutlined,
  FileSearchOutlined,
  ThunderboltOutlined,
  ReconciliationOutlined,
  AuditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { apiGet } from '../../utils/apiClient';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

// 补充 Home 图标（Antd 中是 HomeOutlined）
const HomeOutlined = ({ style }) => <span style={{ ...style, lineHeight: 1 }}>🏠</span>;

// --- 全量功能字典 ---
const ALL_TILES = {
  // 人事管理
  'user-employee': { label: '员工管理', icon: <UserOutlined />, color: 'bg-blue-500' },
  'user-changes': { label: '变动记录', icon: <HistoryOutlined />, color: 'bg-slate-600' },
  'user-approval': { label: '员工审核', icon: <AuditOutlined />, color: 'bg-cyan-600' },
  'org-department': { label: '部门架构', icon: <ApartmentOutlined />, color: 'bg-teal-600' },
  'org-position': { label: '职位设置', icon: <SolutionOutlined />, color: 'bg-indigo-600' },
  
  // 办公协作
  'messaging-chat': { label: '即时通讯', icon: <MessageOutlined />, color: 'bg-green-500' },
  'messaging-broadcast': { label: '系统广播', icon: <BellOutlined />, color: 'bg-orange-500' },
  'broadcast-management': { label: '发布广播', icon: <ThunderboltOutlined />, color: 'bg-amber-500' },
  'employee-memos': { label: '部门备忘', icon: <FileTextOutlined />, color: 'bg-yellow-600' },
  
  // 考勤假务
  'attendance-home': { label: '考勤主页', icon: <HomeOutlined />, color: 'bg-indigo-500' },
  'attendance-leave-apply': { label: '请假申请', icon: <CalendarOutlined />, color: 'bg-rose-500' },
  'attendance-overtime-apply': { label: '加班申请', icon: <ClockCircleOutlined />, color: 'bg-orange-600' },
  'compensatory-apply': { label: '调休申请', icon: <ReconciliationOutlined />, color: 'bg-violet-500' },
  'attendance-stats': { label: '考勤统计', icon: <BarChartOutlined />, color: 'bg-blue-700' },
  
  // 质检与知识
  'quality-score': { label: '会话质检', icon: <SecurityScanOutlined />, color: 'bg-purple-600' },
  'quality-tags': { label: '标签管理', icon: <TagsOutlined />, color: 'bg-pink-600' },
  'knowledge-articles': { label: '公共知识', icon: <BookOutlined />, color: 'bg-emerald-500' },
  'my-knowledge': { label: '我的知识', icon: <StarOutlined />, color: 'bg-amber-400' },
  
  // 财务与后勤
  'reimbursement-apply': { label: '报销申请', icon: <WalletOutlined />, color: 'bg-blue-600' },
  'my-payslips': { label: '我的工资', icon: <FileTextOutlined />, color: 'bg-emerald-600' },
  'logistics-device-mgmt': { label: '资产管理', icon: <DesktopOutlined />, color: 'bg-slate-700' },
  'logistics-device-list': { label: '实机明细', icon: <FileSearchOutlined />, color: 'bg-zinc-600' },
  
  // 个人中心
  'personal-info': { label: '个人信息', icon: <UserOutlined />, color: 'bg-slate-800' },
  'my-todo': { label: '待办中心', icon: <BellOutlined />, color: 'bg-rose-600' }
};

// 默认展示的磁贴
const DEFAULT_SELECTED = [
  'reimbursement-apply', 'attendance-leave-apply', 'messaging-chat', 'knowledge-articles',
  'my-todo', 'attendance-home', 'user-employee'
];

const Dashboard = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedTileIds, setSelectedTileIds] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_v2_tiles');
    setSelectedTileIds(saved ? JSON.parse(saved) : DEFAULT_SELECTED);
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const userId = localStorage.getItem('userId') || JSON.parse(localStorage.getItem('user'))?.id;
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiGet('/api/dashboard/stats', { params: { user_id: userId } });
      setStats(data.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('dashboard_v2_tiles', JSON.stringify(selectedTileIds));
    setIsConfigModalOpen(false);
    message.success('桌面布局已更新');
  };

  return (
    <div className="min-h-full bg-[#f2f2f7] p-6 lg:p-10 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {loading ? (
          <Skeleton active avatar paragraph={{ rows: 15 }} />
        ) : (
          <>
            {/* 1. 顶部核心指标栏 - 极其扁平化 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div onClick={() => onNavigate('my-todo')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center text-xl">
                    <BellOutlined />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">待办任务</p>
                    <Title level={3} className="!m-0">{stats?.pendingCount || 0}</Title>
                  </div>
                </div>
                <ArrowRightOutlined className="text-slate-200" />
              </div>

              <div onClick={() => setIsInfoModalOpen(true)} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all border-2 border-transparent hover:border-blue-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl">
                    <InfoCircleOutlined />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">今日概览</p>
                    <Text strong className="text-slate-800 text-sm">点击查看运行简报</Text>
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              </div>

              <div onClick={() => onNavigate('attendance-home')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${stats?.personalStats?.todayClock?.clock_in ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                    <ClockCircleOutlined />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">考勤状态</p>
                    <Text strong className="text-slate-800 text-sm">{stats?.personalStats?.todayClock?.clock_in ? '今日签到完成' : '尚未进行签到'}</Text>
                  </div>
                </div>
                <ArrowRightOutlined className="text-slate-200" />
              </div>
            </div>

            {/* 2. 快捷启动墙 (Launchpad 风格) */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-4 bg-slate-900 rounded-full" />
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">快捷功能启动墙</h2>
                </div>
                <Button 
                  type="text" 
                  icon={<SettingOutlined />} 
                  className="text-slate-400 hover:text-blue-600 font-bold text-xs"
                  onClick={() => setIsConfigModalOpen(true)}
                >
                  自定义桌面
                </Button>
              </div>

              {/* 磁贴网格 - 紧凑型 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {selectedTileIds.map(id => {
                  const tile = ALL_TILES[id];
                  if (!tile) return null;
                  return (
                    <div 
                      key={id}
                      onClick={() => onNavigate(id)}
                      className="group bg-white p-4 rounded-[28px] border border-transparent hover:border-blue-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center justify-center aspect-square"
                    >
                      <div className={`w-12 h-12 rounded-[18px] ${tile.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                        {React.cloneElement(tile.icon, { style: { fontSize: 22, color: '#fff' } })}
                      </div>
                      <Text strong className="text-slate-700 text-[11px] tracking-tight">{tile.label}</Text>
                    </div>
                  );
                })}
                
                {/* 新增按钮 (占位) */}
                <div 
                  onClick={() => setIsConfigModalOpen(true)}
                  className="bg-dashed border-2 border-dashed border-slate-200 p-4 rounded-[28px] hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center aspect-square"
                >
                  <PlusOutlined className="text-slate-300 text-xl mb-1" />
                  <Text className="text-slate-300 text-[10px] font-bold">添加更多</Text>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 自定义 Modal - 全量选择 */}
        <Modal
          title={<div className="flex items-center gap-3 pt-2 font-black">桌面功能配置</div>}
          open={isConfigModalOpen}
          onCancel={() => setIsConfigModalOpen(false)}
          onOk={handleSaveConfig}
          centered width={700}
          okText="应用布局" cancelText="返回"
          className="refined-modal"
        >
          <div className="py-4">
            <div className="bg-slate-50 p-4 rounded-2xl mb-6 flex items-center justify-between">
              <Text className="text-xs text-slate-500 font-bold">已选择 {selectedTileIds.length} 个快捷功能</Text>
              <Button type="link" size="small" onClick={() => setSelectedTileIds(DEFAULT_SELECTED)}>重置默认</Button>
            </div>
            
            <Checkbox.Group 
              className="w-full"
              value={selectedTileIds}
              onChange={(vals) => setSelectedTileIds(vals)}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(ALL_TILES).map(([id, tile]) => (
                  <div key={id} className={`p-3 rounded-2xl border transition-all ${selectedTileIds.includes(id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}>
                    <Checkbox value={id} className="w-full font-bold text-gray-700">
                      <Space>
                        <span className={`inline-flex p-1.5 rounded-lg ${tile.color} text-white text-xs`}>{tile.icon}</span>
                        <span className="text-xs">{tile.label}</span>
                      </Space>
                    </Checkbox>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </div>
        </Modal>

        {/* 运行简报 Modal */}
        <Modal
          title={<div className="flex items-center gap-3 pt-2 font-black text-lg">系统运行简报</div>}
          open={isInfoModalOpen}
          onCancel={() => setIsInfoModalOpen(false)}
          footer={null} centered width={460}
        >
          <div className="py-2 space-y-5">
            <div className="bg-blue-50 p-6 rounded-[28px] border border-blue-100">
              <p className="text-blue-900 text-sm font-medium mb-0 leading-loose">
                实时统计显示：今日公司共有 <Text strong className="text-blue-600 underline underline-offset-4">{stats?.adminStats?.totalEmployees || 0} 名</Text> 员工，当前在线人数为 <Text strong className="text-emerald-600 font-black">{stats?.adminStats?.todayClockIn || 0}</Text>。
                您的待办事项已同步完成加载。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-5 rounded-2xl text-center border border-gray-100 shadow-inner">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">异常考勤</p>
                <Title level={3} className={`!m-0 ${stats?.personalStats?.monthAbsents > 0 ? 'text-rose-500' : ''}`}>{stats?.personalStats?.monthAbsents || 0}</Title>
              </div>
              <div className="bg-gray-50 p-5 rounded-2xl text-center border border-gray-100 shadow-inner">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">待批流程</p>
                <Title level={3} className="!m-0 text-slate-800">{stats?.pendingCount || 0}</Title>
              </div>
            </div>
            <Button block type="primary" size="large" className="bg-gray-900 border-none rounded-2xl h-14 font-black uppercase text-xs tracking-widest" onClick={() => onNavigate('my-notifications')}>
              进入消息中心
            </Button>
          </div>
        </Modal>

      </div>
    </div>
  );
};

export default Dashboard;
