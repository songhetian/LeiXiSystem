/**
 * 系统首页工作台 - 权限感知 & 全功能磁贴版 (雷犀旗舰办公版 - 视觉进化)
 * 
 * 核心升级：
 * 1. 交互视觉进化：磁贴 Hover 状态由黑色改为微信绿 (#07C160)，增加扩散型柔和阴影。
 * 2. 状态统合：设置磁贴同步应用绿色高亮与阴影效果。
 * 3. 极致本地化：维持全量中文体验。
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
  ReadOutlined,
  SyncOutlined,
  TeamOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { apiGet } from '../../utils/apiClient';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { usePermission } from '../../contexts/PermissionContext';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text, Paragraph } = Typography;

// --- 全量功能字典 ---
const ALL_TILES = {
  'user-employee': { label: '员工管理', icon: <UserOutlined />, color: 'bg-blue-500', permission: 'user:employee:view' },
  'user-changes': { label: '变动记录', icon: <HistoryOutlined />, color: 'bg-slate-600', permission: 'user:employee:view' },
  'user-approval': { label: '员工审核', icon: <AuditOutlined />, color: 'bg-cyan-600', permission: 'user:audit:manage' },
  'org-department': { label: '部门管理', icon: <ApartmentOutlined />, color: 'bg-teal-600', permission: 'org:department:view' },
  'org-position': { label: '职位设置', icon: <SolutionOutlined />, color: 'bg-indigo-600', permission: 'org:position:view' },
  'user-permission': { label: '权限配置', icon: <SafetyOutlined />, color: 'bg-rose-700', permission: 'system:role:view' },
  'user-role-management': { label: '角色分配', icon: <UserOutlined />, color: 'bg-orange-700', permission: 'system:role:manage' },
  'user-reset-password': { label: '重置密码', icon: <KeyOutlined />, color: 'bg-zinc-700', permission: 'user:security:reset_password' },
  'messaging-chat': { label: '即时通讯', icon: <MessageOutlined />, color: 'bg-green-500', permission: 'messaging:chat:use' },
  'messaging-broadcast': { label: '系统广播', icon: <SoundOutlined />, color: 'bg-orange-500', permission: 'messaging:broadcast:view' },
  'broadcast-management': { label: '发布广播', icon: <ThunderboltOutlined />, color: 'bg-amber-500', permission: 'messaging:broadcast:manage' },
  'employee-memos': { label: '部门备忘', icon: <FileTextOutlined />, color: 'bg-yellow-600', permission: 'user:memo:manage' },
  'messaging-group-management': { label: '群组管理', icon: <ApartmentOutlined />, color: 'bg-emerald-600', permission: 'messaging:chat:manage' },
  'attendance-home': { label: '考勤中心', icon: <HomeOutlined />, color: 'bg-indigo-500', permission: 'attendance:record:view' },
  'attendance-records': { label: '打卡记录', icon: <ClockCircleOutlined />, color: 'bg-blue-400', permission: 'attendance:record:view' },
  'attendance-dept-stats': { label: '部门报表', icon: <BarChartOutlined />, color: 'bg-blue-700', permission: 'attendance:record:view' },
  'attendance-leave-apply': { label: '请假申请', icon: <CalendarOutlined />, color: 'bg-rose-500', permission: 'attendance:record:view' },
  'attendance-overtime-apply': { label: '加班申请', icon: <ClockCircleOutlined />, color: 'bg-orange-600', permission: 'attendance:record:view' },
  'compensatory-apply': { label: '调休申请', icon: <ReconciliationOutlined />, color: 'bg-violet-500', permission: 'vacation:record:view' },
  'attendance-shift': { label: '班次设置', icon: <SettingOutlined />, color: 'bg-zinc-500', permission: 'attendance:config:manage' },
  'attendance-schedule': { label: '排班管理', icon: <CalendarOutlined />, color: 'bg-sky-600', permission: 'attendance:schedule:manage' },
  'attendance-approval': { label: '考勤审计', icon: <SafetyOutlined />, color: 'bg-slate-800', permission: 'attendance:approval:manage' },
  'quality-score': { label: '会话质检', icon: <SecurityScanOutlined />, color: 'bg-purple-600', permission: 'quality:session:view' },
  'quality-tags': { label: '质检标签', icon: <TagsOutlined />, color: 'bg-pink-600', permission: 'quality:config:manage' },
  'knowledge-articles': { label: '公共知识', icon: <ReadOutlined />, color: 'bg-emerald-500', permission: 'knowledge:article:view' },
  'knowledge-base': { label: '知识库管', icon: <BookOutlined />, color: 'bg-green-700', permission: 'knowledge:article:manage' },
  'reimbursement-apply': { label: '新建报销', icon: <WalletOutlined />, color: 'bg-blue-600', permission: 'reimbursement:apply:submit' },
  'reimbursement-approval': { label: '报销审批', icon: <CheckCircleOutlined />, color: 'bg-amber-600', permission: 'reimbursement:apply:approve' },
  'system-workflow': { label: '资产流程', icon: <SyncOutlined />, color: 'bg-slate-900', permission: 'system:workflow:manage' },
  'approval-workflow-config': { label: '报销定义', icon: <SettingOutlined />, color: 'bg-slate-800', permission: 'system:workflow:manage' },
  'role-workflow-config': { label: '职责授权', icon: <TeamOutlined />, color: 'bg-slate-700', permission: 'system:workflow:manage' },
  'logistics-device-mgmt': { label: '设备管理', icon: <DesktopOutlined />, color: 'bg-zinc-700', permission: 'finance:asset:manage' },
  'logistics-device-list': { label: '实机明细', icon: <FileSearchOutlined />, color: 'bg-slate-500', permission: 'finance:asset:manage' },
  'asset-request-audit': { label: '资产审批', icon: <AuditOutlined />, color: 'bg-indigo-500', permission: 'finance:asset:audit' },
  'my-payslips': { label: '我的工资', icon: <DollarOutlined />, color: 'bg-green-600', permission: 'payroll:payslip:view' },
  'payslip-management': { label: '工资条管', icon: <FileTextOutlined />, color: 'bg-green-700', permission: 'payroll:payslip:manage' },
  'personal-info': { label: '资料设置', icon: <UserOutlined />, color: 'bg-slate-800' },
  'my-todo': { label: '待办中心', icon: <BellOutlined />, color: 'bg-rose-600' }
};

const DEFAULT_SELECTED = [
  'attendance-home', 'messaging-chat', 'my-todo', 'reimbursement-apply', 
  'knowledge-articles', 'personal-info', 'attendance-dept-stats', 'user-employee'
];

const Dashboard = ({ onNavigate }) => {
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedTileIds, setSelectedTileIds] = useState([]);

  const allowedTileIds = useMemo(() => {
    return Object.entries(ALL_TILES)
      .filter(([_, config]) => !config.permission || hasPermission(config.permission))
      .map(([id]) => id);
  }, [hasPermission]);

  useEffect(() => {
    const saved = localStorage.getItem('dashboard_v4_tiles');
    let initialIds = saved ? JSON.parse(saved) : DEFAULT_SELECTED;
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
            {/* 1. 核心任务条 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div onClick={() => onNavigate('attendance-home')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-[#07C160] transition-all group border-2 border-transparent">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110 ${stats?.personalStats?.todayClock?.clock_in ? 'bg-[#07C160] text-white' : 'bg-amber-500 text-white'}`}>
                    <ClockCircleOutlined />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">今日考勤打卡</p>
                    <Text strong className={`text-lg ${stats?.personalStats?.todayClock?.clock_in ? 'text-[#07C160]' : 'text-amber-600'}`}>
                      {stats?.personalStats?.todayClock?.clock_in ? '签到已完成' : '尚未进行签到'}
                    </Text>
                  </div>
                </div>
                <RightOutlined className="text-slate-200 group-hover:text-[#07C160]" />
              </div>

              <div onClick={() => onNavigate('my-todo')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-[#07C160] transition-all group border-2 border-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110">
                    <BellOutlined />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">待办处理中心</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900">{stats?.pendingCount || 0}</span>
                      <span className="text-xs font-bold text-slate-400">项流程待审</span>
                    </div>
                  </div>
                </div>
                <RightOutlined className="text-slate-200 group-hover:text-[#07C160]" />
              </div>

              <div onClick={() => onNavigate('my-notifications')} className="bg-white p-6 rounded-[32px] shadow-sm flex items-center justify-between cursor-pointer hover:shadow-xl hover:ring-2 hover:ring-[#07C160] transition-all group border-2 border-transparent">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110">
                    <InfoCircleOutlined />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">最新系统消息</p>
                    <Text strong className="text-slate-800 text-sm block truncate pr-2 font-bold italic">
                      {latestSignal ? latestSignal.title : '暂无最新通知'}
                    </Text>
                  </div>
                </div>
                {!latestSignal?.is_read && latestSignal && <div className="w-2 h-2 rounded-full bg-[#07C160] animate-pulse shrink-0" />}
              </div>
            </div>

            {/* 2. 启动墙 */}
            <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-4 bg-slate-900 rounded-full" />
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">快速功能启动墙</h2>
                </div>
                <Button 
                  type="text" 
                  icon={<SettingOutlined />} 
                  className="text-slate-400 hover:text-[#07C160] font-bold text-[10px] uppercase"
                  onClick={() => setIsConfigModalOpen(true)}
                >
                  自定义桌面布局
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                {selectedTileIds.map(id => {
                  const tile = ALL_TILES[id];
                  if (!tile) return null;
                  return (
                    <div 
                      key={id}
                      onClick={() => onNavigate(id)}
                      className="group bg-white p-4 rounded-[28px] border border-transparent hover:border-[#07C160] shadow-sm hover:shadow-2xl hover:shadow-emerald-100/50 hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center justify-center aspect-square"
                    >
                      <div className={`w-12 h-12 rounded-[18px] ${tile.color || 'bg-slate-400'} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                        {React.cloneElement(tile.icon, { style: { fontSize: 22, color: '#fff' } })}
                      </div>
                      <Text strong className="text-slate-700 text-[11px] font-bold">{tile.label}</Text>
                    </div>
                  );
                })}
                
                <div 
                  onClick={() => setIsConfigModalOpen(true)}
                  className="group bg-slate-100/50 border-2 border-dashed border-slate-200 p-4 rounded-[28px] hover:border-[#07C160] hover:bg-white hover:shadow-2xl hover:shadow-emerald-100/50 transition-all cursor-pointer flex flex-col items-center justify-center aspect-square"
                >
                  <PlusOutlined className="text-slate-300 text-xl mb-1 group-hover:text-[#07C160]" />
                  <Text className="text-slate-300 text-[9px] font-black uppercase group-hover:text-[#07C160]">配置桌面</Text>
                </div>
              </div>
            </div>
          </>
        )}

        <Modal
          title={<div className="font-black text-slate-800">桌面功能自定义</div>}
          open={isConfigModalOpen}
          onCancel={() => setIsConfigModalOpen(false)}
          onOk={handleSaveConfig}
          centered width={850}
          okText="应用此布局" cancelText="放弃"
          styles={{ body: { padding: '24px' } }}
        >
          <div className="space-y-6 text-left">
            <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-slate-100">
              <div>
                <Text className="text-[10px] text-slate-400 font-black block mb-1 uppercase">当前已选</Text>
                <Text strong className="text-[#07C160]">{selectedTileIds.length} 项功能</Text>
              </div>
              <Button type="link" size="small" className="font-bold text-slate-400 hover:text-[#07C160]" onClick={() => setSelectedTileIds(DEFAULT_SELECTED.filter(id => allowedTileIds.includes(id)))}>重置为系统默认</Button>
            </div>
            
            <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              <Checkbox.Group className="w-full" value={selectedTileIds} onChange={(vals) => setSelectedTileIds(vals)}>
                <div className="space-y-8">
                  {[
                    { label: '人事行政管理', ids: ['user-employee', 'user-changes', 'user-approval', 'org-department', 'org-position', 'user-permission', 'user-role-management', 'user-reset-password'] },
                    { label: '协作办公通知', ids: ['messaging-chat', 'messaging-broadcast', 'broadcast-management', 'employee-memos', 'messaging-group-management'] },
                    { label: '考勤假务中心', ids: ['attendance-home', 'attendance-records', 'attendance-dept-stats', 'attendance-leave-apply', 'attendance-overtime-apply', 'compensatory-apply', 'attendance-shift', 'attendance-schedule', 'attendance-approval'] },
                    { label: '财务后勤架构', ids: ['reimbursement-apply', 'reimbursement-approval', 'system-workflow', 'approval-workflow-config', 'role-workflow-config', 'logistics-device-mgmt', 'logistics-device-list', 'asset-request-audit', 'my-payslips', 'payslip-management'] },
                    { label: '质检知识个人', ids: ['quality-score', 'quality-tags', 'knowledge-articles', 'knowledge-base', 'personal-info', 'my-todo'] }
                  ].map((group, gIdx) => {
                    const filteredIds = group.ids.filter(id => allowedTileIds.includes(id));
                    if (filteredIds.length === 0) return null;
                    return (
                      <div key={gIdx}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-3 bg-[#07C160] rounded-full" />
                          <Text className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{group.label}</Text>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {filteredIds.map(id => {
                            const tile = ALL_TILES[id];
                            return (
                              <div key={id} className={`p-3 rounded-2xl border transition-all ${selectedTileIds.includes(id) ? 'bg-emerald-50 border-[#07C160]' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
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
