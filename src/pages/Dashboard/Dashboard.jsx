/**
 * 系统首页工作台 - 权限感知 & 全功能磁贴版
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  DesktopOutlined,
  FileSearchOutlined,
  ThunderboltOutlined,
  ReconciliationOutlined,
  AuditOutlined,
  PlusOutlined,
  HomeOutlined,
  SoundOutlined,
  GlobalOutlined,
  SafetyOutlined,
  KeyOutlined,
  ShopOutlined,
  DollarOutlined,
  ExportOutlined,
  ReadOutlined
} from '@ant-design/icons';
import { apiGet } from '../../utils/apiClient';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { usePermission } from '../../contexts/PermissionContext';
import Breadcrumb from '../../components/Breadcrumb';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

// --- 全量功能字典 (绑定权限代码) ---
const ALL_TILES = {
  // --- 人事管理 ---
  'user-employee': { label: '员工管理', icon: <UserOutlined />, color: 'bg-blue-500', permission: 'user:employee:view' },
  'user-changes': { label: '变动记录', icon: <HistoryOutlined />, color: 'bg-slate-600', permission: 'user:employee:view' },
  'user-approval': { label: '员工审核', icon: <AuditOutlined />, color: 'bg-cyan-600', permission: 'user:audit:manage' },
  'org-department': { label: '部门管理', icon: <ApartmentOutlined />, color: 'bg-teal-600', permission: 'org:department:view' },
  'org-position': { label: '职位设置', icon: <SolutionOutlined />, color: 'bg-indigo-600', permission: 'org:position:view' },
  'user-permission': { label: '权限配置', icon: <SafetyOutlined />, color: 'bg-rose-700', permission: 'system:role:view' },
  'user-role-management': { label: '角色分配', icon: <UserOutlined />, color: 'bg-orange-700', permission: 'system:role:manage' },
  
  // --- 办公协作 ---
  'messaging-chat': { label: '即时通讯', icon: <MessageOutlined />, color: 'bg-green-500', permission: 'messaging:chat:use' },
  'messaging-broadcast': { label: '系统广播', icon: <SoundOutlined />, color: 'bg-orange-500', permission: 'messaging:broadcast:view' },
  'broadcast-management': { label: '发布广播', icon: <ThunderboltOutlined />, color: 'bg-amber-500', permission: 'messaging:broadcast:manage' },
  'employee-memos': { label: '部门备忘', icon: <FileTextOutlined />, color: 'bg-yellow-600', permission: 'user:memo:manage' },
  'messaging-group-management': { label: '群组管理', icon: <ApartmentOutlined />, color: 'bg-emerald-600', permission: 'messaging:chat:manage' },
  
  // --- 考勤假务 ---
  'attendance-home': { label: '考勤中心', icon: <HomeOutlined />, color: 'bg-indigo-500', permission: 'attendance:record:view' },
  'attendance-records': { label: '打卡记录', icon: <ClockCircleOutlined />, color: 'bg-blue-400', permission: 'attendance:record:view' },
  'attendance-leave-apply': { label: '请假申请', icon: <CalendarOutlined />, color: 'bg-rose-500', permission: 'attendance:record:view' },
  'attendance-overtime-apply': { label: '加班申请', icon: <ClockCircleOutlined />, color: 'bg-orange-600', permission: 'attendance:record:view' },
  'compensatory-apply': { label: '调休申请', icon: <ReconciliationOutlined />, color: 'bg-violet-500', permission: 'vacation:record:view' },
  'attendance-stats': { label: '考勤统计', icon: <BarChartOutlined />, color: 'bg-blue-700', permission: 'attendance:report:view' },
  'attendance-shift': { label: '班次设置', icon: <SettingOutlined />, color: 'bg-zinc-500', permission: 'attendance:config:manage' },
  'attendance-schedule': { label: '排班管理', icon: <CalendarOutlined />, color: 'bg-sky-600', permission: 'attendance:schedule:manage' },
  
  // --- 质检与知识 ---
  'quality-score': { label: '会话质检', icon: <SecurityScanOutlined />, color: 'bg-purple-600', permission: 'quality:session:view' },
  'quality-tags': { label: '质检标签', icon: <TagsOutlined />, color: 'bg-pink-600', permission: 'quality:config:manage' },
  'knowledge-articles': { label: '公共知识', icon: <ReadOutlined />, color: 'bg-emerald-500', permission: 'knowledge:article:view' },
  'knowledge-base': { label: '知识库管', icon: <BookOutlined />, color: 'bg-green-700', permission: 'knowledge:article:manage' },
  
  // --- 财务后勤 ---
  'reimbursement-apply': { label: '新建报销', icon: <WalletOutlined />, color: 'bg-blue-600', permission: 'reimbursement:apply:submit' },
  'reimbursement-approval': { label: '报销审批', icon: <CheckCircleOutlined />, color: 'bg-amber-600', permission: 'reimbursement:apply:approve' },
  'logistics-device-mgmt': { label: '资产管理', icon: <DesktopOutlined />, color: 'bg-slate-700', permission: 'finance:asset:manage' },
  'my-payslips': { label: '我的工资', icon: <DollarOutlined />, color: 'bg-green-600', permission: 'payroll:payslip:view' },
  
  // --- 个人中心 ---
  'personal-info': { label: '资料设置', icon: <UserOutlined />, color: 'bg-slate-800' }, // 无需权限
  'my-todo': { label: '待办中心', icon: <BellOutlined />, color: 'bg-rose-600' }  // 无需权限
};

const DEFAULT_SELECTED = [
  'attendance-home', 'messaging-chat', 'my-todo', 'reimbursement-apply', 
  'knowledge-articles', 'personal-info', 'attendance-leave-apply', 'user-employee'
];

const Dashboard = ({ onNavigate }) => {
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedTileIds, setSelectedTileIds] = useState([]);

  // 计算当前用户有权限看到的磁贴 ID
  const allowedTileIds = useMemo(() => {
    return Object.entries(ALL_TILES)
      .filter(([_, config]) => !config.permission || hasPermission(config.permission))
      .map(([id]) => id);
  }, [hasPermission]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_v4_tiles');
    let initialIds = saved ? JSON.parse(saved) : DEFAULT_SELECTED;
    
    // 过滤掉当前用户没权限的
    initialIds = initialIds.filter(id => allowedTileIds.includes(id));
    
    setSelectedTileIds(initialIds);
    fetchStats();
    fetchNotifications();
  }, [allowedTileIds]);

  const fetchStats = async () => {
    const userId = localStorage.getItem('userId') || JSON.parse(localStorage.getItem('user'))?.id;
    if (!userId) { setLoading(false); return; }
    try {
      const data = await apiGet('/api/dashboard/stats', { params: { user_id: userId } });
      setStats(data.data);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const fetchNotifications = async () => {
    const userId = localStorage.getItem('userId') || JSON.parse(localStorage.getItem('user'))?.id;
    if (!userId) return;
    try {
      const data = await apiGet('/api/notifications', { params: { userId, pageSize: 1 } });
      setNotifications(data.data || []);
    } catch (error) { console.error(error); }
  };

  const handleSaveConfig = () => {
    localStorage.setItem('dashboard_v4_tiles', JSON.stringify(selectedTileIds));
    setIsConfigModalOpen(false);
    message.success('已应用您的专属桌面布局');
  };

  const latestSignal = notifications[0];

  return (
    <div className="min-h-full bg-[#f2f2f7] p-6 lg:p-10 animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {loading ? (
          <Skeleton active avatar paragraph={{ rows: 15 }} />
        ) : (
          <>
            {/* 1. 顶部核心任务条 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* A. 考勤状态 */}
              <div onClick={() => onNavigate('attendance-home')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group border-2 border-transparent hover:border-emerald-100">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110 ${stats?.personalStats?.todayClock?.clock_in ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                    <ClockCircleOutlined />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">今日考勤任务</p>
                    <Text strong className={`text-lg ${stats?.personalStats?.todayClock?.clock_in ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {stats?.personalStats?.todayClock?.clock_in ? '签到已完成' : '尚未进行签到'}
                    </Text>
                  </div>
                </div>
                <RightOutlined className="text-slate-200 group-hover:text-emerald-400" />
              </div>

              {/* B. 待办中心 */}
              <div onClick={() => onNavigate('my-todo')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group border-2 border-transparent hover:border-rose-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110">
                    <BellOutlined />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">待办处理中心</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">{stats?.pendingCount || 0}</span>
                      <span className="text-xs font-bold text-slate-400">项流程待处理</span>
                    </div>
                  </div>
                </div>
                <RightOutlined className="text-slate-200 group-hover:text-rose-400" />
              </div>

              {/* C. 系统讯号 - 直接跳转通知中心 */}
              <div onClick={() => onNavigate('my-notifications')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group border-2 border-transparent hover:border-indigo-100">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110">
                    <InfoCircleOutlined />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">最新系统讯号</p>
                    <Text strong className="text-slate-800 text-sm block truncate pr-2 italic">
                      {latestSignal ? latestSignal.title : '暂无最新讯号'}
                    </Text>
                  </div>
                </div>
                {!latestSignal?.is_read && latestSignal && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />}
              </div>
            </div>

            {/* 2. 快捷启动启动墙 (Launchpad) */}
            <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-4 bg-slate-900 rounded-full" />
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">快速功能启动墙</h2>
                </div>
                <Button 
                  type="text" 
                  icon={<SettingOutlined />} 
                  className="text-slate-400 hover:text-blue-600 font-bold text-[10px] uppercase tracking-widest"
                  onClick={() => setIsConfigModalOpen(true)}
                >
                  自定义桌面
                </Button>
              </div>

              {/* 磁贴网格 */}
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
                      <Text strong className="text-slate-700 text-[11px] font-bold tracking-tight">{tile.label}</Text>
                    </div>
                  );
                })}
                
                <div 
                  onClick={() => setIsConfigModalOpen(true)}
                  className="group bg-slate-100/50 border-2 border-dashed border-slate-200 p-4 rounded-[28px] hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer flex flex-col items-center justify-center aspect-square"
                >
                  <PlusOutlined className="text-slate-300 text-xl mb-1 group-hover:text-blue-400" />
                  <Text className="text-slate-300 text-[9px] font-black uppercase tracking-tighter group-hover:text-blue-400">设置</Text>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 桌面配置 Modal */}
        <Modal
          title={<div className="flex items-center gap-3 pt-2 font-black">桌面快捷功能配置</div>}
          open={isConfigModalOpen}
          onCancel={() => setIsConfigModalOpen(false)}
          onOk={handleSaveConfig}
          centered width={850}
          okText="应用布局" cancelText="返回"
          styles={{ body: { padding: '24px' } }}
        >
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <Text className="text-xs text-slate-500 font-bold block mb-1 uppercase tracking-widest">Selected Slots</Text>
                <Text strong className="text-blue-600">{selectedTileIds.length} 个功能已添加至桌面</Text>
              </div>
              <Button type="link" size="small" onClick={() => setSelectedTileIds(DEFAULT_SELECTED.filter(id => allowedTileIds.includes(id)))}>重置为默认</Button>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              <Checkbox.Group className="w-full" value={selectedTileIds} onChange={(vals) => setSelectedTileIds(vals)}>
                <div className="space-y-8">
                  {/* 分类展示 */}
                  {[
                    { label: '人事与组织', ids: ['user-employee', 'user-changes', 'user-approval', 'org-department', 'org-position', 'user-permission', 'user-role-management'] },
                    { label: '办公与协作', ids: ['messaging-chat', 'messaging-broadcast', 'broadcast-management', 'employee-memos', 'messaging-group-management'] },
                    { label: '考勤与事务', ids: ['attendance-home', 'attendance-records', 'attendance-leave-apply', 'attendance-overtime-apply', 'compensatory-apply', 'attendance-stats', 'attendance-shift', 'attendance-schedule'] },
                    { label: '质检、知识、财务', ids: ['quality-score', 'quality-tags', 'knowledge-articles', 'knowledge-base', 'reimbursement-apply', 'reimbursement-approval', 'logistics-device-mgmt', 'my-payslips'] },
                    { label: '个人快捷', ids: ['personal-info', 'my-todo'] }
                  ].map((group, gIdx) => {
                    // 仅显示有权限的
                    const filteredIds = group.ids.filter(id => allowedTileIds.includes(id));
                    if (filteredIds.length === 0) return null;
                    
                    return (
                      <div key={gIdx}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-3 bg-blue-500 rounded-full" />
                          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.label}</Text>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {filteredIds.map(id => {
                            const tile = ALL_TILES[id];
                            return (
                              <div key={id} className={`p-3 rounded-2xl border transition-all ${selectedTileIds.includes(id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}>
                                <Checkbox value={id} className="w-full font-bold text-gray-700">
                                  <Space>
                                    <span className={`inline-flex p-1.5 rounded-lg ${tile.color} text-white text-[10px]`}>{tile.icon}</span>
                                    <span className="text-[11px]">{tile.label}</span>
                                  </Space>
                                </Checkbox>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Checkbox.Group>
            </div>
          </div>
        </Modal>

      </div>
    </div>
  );
};

export default Dashboard;
