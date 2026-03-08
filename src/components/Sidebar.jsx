import React, { useState, useMemo, useEffect } from 'react';
import { matchPinyin } from '../utils/searchUtils';
import { usePermission } from '../contexts/PermissionContext';

import {
  UserOutlined,
  TeamOutlined,
  ApartmentOutlined,
  MessageOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  FileTextOutlined,
  FormOutlined,
  KeyOutlined,
  SafetyOutlined,
  BarChartOutlined,
  LineChartOutlined,
  SyncOutlined,
  CalendarOutlined,
  BellOutlined,
  SearchOutlined,
  FolderOpenOutlined,
  DatabaseOutlined,
  StarOutlined,
  IdcardOutlined,
  BookOutlined,
  EyeOutlined,
  FileSearchOutlined,
  ThunderboltOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  RightOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  CloseCircleOutlined,
  TagsOutlined,
  SoundOutlined,
  DesktopOutlined,
  LogoutOutlined,
  ThunderboltFilled,
  WalletOutlined,
} from '@ant-design/icons';

import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useChatStore } from '../hooks/useChatStore';

// --- Component Definition ---

const Sidebar = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  theme = { background: '#F3F4F6' }
}) => {
  const { totalUnreadCount, notificationEnabled } = useChatStore();
  const [expandedMenus, setExpandedMenus] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { hasPermission } = usePermission();

  // --- 自动展开逻辑修正 ---
  useEffect(() => {
    if (!activeTab?.name) return;

    const findParentIds = (items, targetId, parents = []) => {
      for (const item of items) {
        if (item.id === targetId) return parents;
        if (item.children) {
          const result = findParentIds(item.children, targetId, [...parents, item.id]);
          if (result) return result;
        }
      }
      return null;
    };

    const parentIds = findParentIds(allMenuItems, activeTab.name);
    if (parentIds && parentIds.length > 0) {
      setExpandedMenus(prev => Array.from(new Set([...prev, ...parentIds])));
    }
  }, [activeTab?.name]);

  const filterChildren = (children) => {
    return children
      .filter(child => child.permission ? hasPermission(child.permission) : !child.admin)
      .map(child => {
        if (!child.children) return child;
        const filteredGrandChildren = filterChildren(child.children);
        if (filteredGrandChildren.length === 0 && child.children.length > 0) return null;
        return { ...child, children: filteredGrandChildren };
      })
      .filter(Boolean);
  };

  const menuItems = useMemo(() => filterChildren(allMenuItems), [user, hasPermission]);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;
    const query = searchQuery.toLowerCase();
    const filterRecursive = (items) => {
      return items.map(item => {
        const labelMatch = matchPinyin(item.label, query);
        if (!item.children) return labelMatch ? item : null;
        if (labelMatch) return item;
        const filteredChildren = filterRecursive(item.children).filter(Boolean);
        return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
      }).filter(Boolean);
    };
    const filtered = filterRecursive(menuItems);
    if (searchQuery.trim()) {
      const allIds = [];
      const collectIds = (items) => items.forEach(item => { if (item.children) { allIds.push(item.id); collectIds(item.children); }});
      collectIds(filtered);
      setExpandedMenus(allIds);
    }
    return filtered;
  }, [searchQuery, menuItems]);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => {
      // 如果点击的是已经展开的菜单，则关闭它
      if (prev.includes(menuId)) {
        return prev.filter(id => id !== menuId);
      } 
      
      // 手风琴逻辑：
      // 1. 找到点击菜单的所有父级
      const findPath = (items, targetId, path = []) => {
        for (const item of items) {
          if (item.id === targetId) return path;
          if (item.children) {
            const result = findPath(item.children, targetId, [...path, item.id]);
            if (result) return result;
          }
        }
        return null;
      };

      const parents = findPath(allMenuItems, menuId) || [];
      
      // 2. 只保留父级路径中的 ID 和当前点击的 ID
      // 这样点击同一个父级下的另一个子菜单时，会自动切换
      return [...parents, menuId];
    });
  };

  const handleMenuClick = (tabId) => {
    if (setActiveTab) setActiveTab(tabId);
  };

  return (
    <aside className="w-80 border-r border-gray-200 flex flex-col" style={{ backgroundColor: theme.background }}>
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <SidebarHeader />
        <div className="mb-4">
          <div className="relative">
            <SearchOutlined className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
            <input type="text" placeholder="搜索功能..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-8 py-2 border border-gray-300 text-sm rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"><CloseCircleOutlined className="text-sm" /></button>}
          </div>
        </div>

        <nav className="space-y-1.5">
          {filteredMenuItems.map(item => (
            <MenuItem key={item.id} item={item} level={1} activeTab={activeTab} setActiveTab={handleMenuClick} expandedMenus={expandedMenus} toggleMenu={toggleMenu} searchQuery={searchQuery} chatUnreadCount={totalUnreadCount} showChatBadge={notificationEnabled} />
          ))}
        </nav>
      </div>
      <SidebarFooter user={user} onLogout={onLogout} />
    </aside>
  );
};

const SidebarHeader = () => (
  <div className="mb-6 pb-4 border-b border-gray-200 flex items-center gap-3 px-2">
    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
      <ThunderboltFilled className="text-xl" />
    </div>
    <div>
      <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">雷犀旗舰版</h1>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Management System</p>
    </div>
  </div>
);

const MenuItem = ({ item, level, activeTab, setActiveTab, expandedMenus, toggleMenu, searchQuery, chatUnreadCount, showChatBadge }) => {
  const isExpanded = expandedMenus.includes(item.id);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = activeTab?.name === item.id;

  const getLevelStyles = () => {
    switch (level) {
      case 1:
        return {
          container: 'mb-1',
          button: `px-4 py-2.5 rounded-xl transition-all duration-200 group ${
            isActive 
              ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700' 
              : 'text-slate-700 hover:bg-indigo-50/50'
          }`,
          icon: `text-lg ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`,
          text: `text-sm font-black tracking-tight`,
        };
      case 2:
        return {
          container: 'ml-4 border-l-2 border-slate-100 my-0.5',
          button: `pl-4 pr-4 py-2 rounded-lg transition-all duration-200 group ${
            isActive ? 'bg-indigo-500/10 text-indigo-700 border-l-4 border-indigo-600 font-black' : 'text-slate-500 hover:bg-indigo-50/50 hover:text-indigo-600 font-bold'
          }`,
          icon: 'hidden',
          text: 'text-sm',
        };
      case 3:
        return {
          container: 'ml-8 border-l-2 border-slate-50',
          button: `pl-4 pr-4 py-1.5 rounded-lg transition-all duration-200 group ${
            isActive ? 'bg-indigo-500/10 text-indigo-700 border-l-4 border-indigo-500 font-black' : 'text-slate-400 hover:bg-indigo-50/50 hover:text-indigo-600 font-semibold'
          }`,
          icon: 'hidden',
          text: 'text-xs',
        };
      default: return {};
    }
  };

  const styles = getLevelStyles();
  const highlightText = (text) => {
    if (!searchQuery.trim()) return text;
    const index = text.toLowerCase().indexOf(searchQuery.toLowerCase());
    if (index === -1) return text;
    return <>{text.substring(0, index)}<span className="bg-yellow-200 text-slate-900 px-0.5 rounded">{text.substring(index, index + searchQuery.length)}</span>{text.substring(index + searchQuery.length)}</>;
  };

  return (
    <div className={styles.container}>
      <button onClick={() => hasChildren ? toggleMenu(item.id) : setActiveTab(item.id)} className={`w-full flex items-center justify-between ${styles.button}`}>
        <div className="flex-1 flex items-center justify-between min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`${styles.icon} transition-transform group-hover:scale-110`}>{item.icon}</span>
            <span className={`${styles.text} truncate`}>{highlightText(item.label)}</span>
          </div>
          {item.id === 'messaging-chat' && showChatBadge && chatUnreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full leading-none min-w-[18px] text-center shadow-lg shadow-rose-200">
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </div>
        {hasChildren && <RightOutlined className={`text-[10px] transition-transform duration-300 ml-2 ${isExpanded ? 'rotate-90' : ''} ${isActive ? 'text-white' : 'text-slate-300'}`} />}
      </button>
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-0.5 animate-in slide-in-from-top-1 duration-200">
          {item.children.map(child => (
            <MenuItem key={child.id} item={child} level={level + 1} activeTab={activeTab} setActiveTab={setActiveTab} expandedMenus={expandedMenus} toggleMenu={toggleMenu} searchQuery={searchQuery} chatUnreadCount={chatUnreadCount} showChatBadge={showChatBadge} />
          ))}
        </div>
      )}
    </div>
  );
};

const SidebarFooter = ({ user, onLogout }) => {
  const handleLogoutClick = () => { Modal.confirm({ title: '确认退出', icon: <ExclamationCircleOutlined />, content: '确定要退出登录吗？', okText: '确认', cancelText: '取消', onOk: onLogout, centered: true }); };
  return (
    <div className="p-4 border-t border-gray-200 bg-white">
      <div className="flex items-center gap-3 mb-4 px-2">
         <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm font-black text-indigo-600 rounded-xl shadow-sm">
            {user?.real_name?.charAt(0) || <UserOutlined />}
         </div>
         <div className="flex-1 min-w-0">
           <div className="text-sm font-black text-slate-800 truncate">{user?.real_name || '未登录'}</div>
           <div className="text-[10px] text-slate-400 font-bold truncate tracking-wider">@{user?.username || 'guest'}</div>
         </div>
      </div>
      <button onClick={handleLogoutClick} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-100 transition-all text-xs font-black rounded-xl uppercase tracking-widest">
        <LogoutOutlined />
        <span>退出登录</span>
      </button>
    </div>
  );
};

// --- Menu Item Definitions ---
const allMenuItems = [
  { id: 'dashboard', label: '控制面板', icon: <HomeOutlined />, permission: 'system:dashboard:view' },
  { id: 'admin-dashboard', label: '企业看板', icon: <BarChartOutlined />, permission: 'system:dashboard:admin' },
  { id: 'hr', label: '人事管理', icon: <TeamOutlined />, children: [
    { id: 'hr-employee', label: '员工管理', icon: <UserOutlined />, permission: 'user:employee:view', children: [
      { id: 'user-employee', label: '员工管理', icon: <UserOutlined />, permission: 'user:employee:view' },
      { id: 'user-changes', label: '变动记录', icon: <FileTextOutlined />, permission: 'user:employee:view' },
      { id: 'user-approval', label: '员工审核', icon: <CheckCircleOutlined />, permission: 'user:audit:manage' },
    ]},
    { id: 'hr-org', label: '组织架构', icon: <ApartmentOutlined />, permission: 'org:department:view', children: [
      { id: 'org-department', label: '部门管理', icon: <ApartmentOutlined />, permission: 'org:department:view' },
      { id: 'org-position', label: '职位管理', icon: <IdcardOutlined />, permission: 'org:position:view' },
    ]}
  ]},
  { id: 'permission', label: '权限管理', icon: <SafetyOutlined />, children: [
    { id: 'user-permission', label: '权限管理', icon: <SafetyOutlined />, permission: 'system:role:view' },
    { id: 'user-role-management', label: '角色分配', icon: <TeamOutlined />, permission: 'system:role:manage' },
    { id: 'user-reset-password', label: '重置密码', icon: <KeyOutlined />, permission: 'user:security:reset_password' },
    { id: 'system-logs', label: '操作日志', icon: <FileTextOutlined />, permission: 'system:log:view' },
  ]},
  { id: 'collaboration', label: '办公协作', icon: <MessageOutlined />, children: [
    { id: 'information', label: '信息发布', icon: <SoundOutlined />, children: [
      { id: 'messaging-broadcast', label: '系统广播', icon: <SoundOutlined />, permission: 'messaging:broadcast:view' },
      { id: 'broadcast-management', label: '发布广播', icon: <SendOutlined />, permission: 'messaging:broadcast:manage' },
      { id: 'notification-settings', label: '通知设置', icon: <BellOutlined />, permission: 'messaging:config:manage' },
    ]},
    { id: 'messaging-chat', label: '即时通讯', icon: <MessageOutlined />, permission: 'messaging:chat:use' },
    { id: 'messaging-group-management', label: '群组管理', icon: <TeamOutlined />, permission: 'messaging:chat:manage' },
    { id: 'employee-memos', label: '部门备忘录', icon: <BellOutlined />, permission: 'user:memo:manage' },
  ]},
  { id: 'attendance', label: '考勤管理', icon: <ClockCircleOutlined />, permission: 'attendance:record:view', children: [
    { id: 'attendance-home', label: '考勤打卡', icon: <UserOutlined />, permission: 'attendance:record:view' },
    { id: 'attendance-dept-stats', label: '部门考勤报表', icon: <BarChartOutlined />, permission: 'attendance:record:view' },

    { id: 'attendance-shift', label: '班次管理', icon: <SyncOutlined />, permission: 'attendance:config:manage' },
    { id: 'attendance-schedule', label: '智能调度中心', icon: <CalendarOutlined />, permission: 'attendance:schedule:manage' },
    { id: 'attendance-approval', label: '考勤审计配置', icon: <SafetyOutlined />, permission: 'attendance:approval:manage' },
  ]},
  { id: 'knowledge', label: '知识中枢', icon: <BookOutlined />, children: [
    { id: 'knowledge-articles', label: '公共知识库', icon: <EyeOutlined />, permission: 'knowledge:article:view' },
    { id: 'knowledge-base', label: '知识库管理', icon: <SettingOutlined />, permission: 'knowledge:article:manage' },
    { id: 'my-knowledge', label: '我的知识库', icon: <StarOutlined /> },
  ]},
  { id: 'vacation', label: '假期管理', icon: <CalendarOutlined />, permission: 'vacation:record:view', children: [
    { id: 'vacation-details', label: '假期自助中心', icon: <UserOutlined />, permission: 'vacation:record:view' },
    { id: 'compensatory-approval', label: '假期审计管理', icon: <SafetyOutlined />, permission: 'vacation:approval:manage' },
  ]},
  { id: 'finance', label: '财务管理', icon: <DatabaseOutlined />, permission: 'reimbursement:record:view', children: [
    { id: 'finance-reimbursement', label: '报销管理', icon: <WalletOutlined />, children: [
      { id: 'reimbursement-apply', label: '新建报销', icon: <FormOutlined />, permission: 'reimbursement:apply:submit' },
      { id: 'reimbursement-list', label: '我的报销', icon: <FileTextOutlined />, permission: 'reimbursement:record:view' },
      { id: 'reimbursement-approval', label: '报销审批', icon: <CheckCircleOutlined />, permission: 'reimbursement:apply:approve' },
      { id: 'approver-management', label: '审批人管理', icon: <TeamOutlined />, permission: 'reimbursement:config:settings' },
      { id: 'reimbursement-settings', label: '报销配置', icon: <SettingOutlined />, permission: 'reimbursement:config:settings' },
    ]},
    { id: 'finance-payroll', label: '薪资管理', icon: <TeamOutlined />, permission: 'payroll:payslip:manage', children: [
      { id: 'payslip-management', label: '工资条管理', icon: <FileTextOutlined />, permission: 'payroll:payslip:manage' },
    ]},
    { id: 'finance-config', label: '审批架构', icon: <SyncOutlined />, permission: 'system:workflow:manage', children: [
      { id: 'system-workflow', label: '资产流程定义', icon: <SyncOutlined /> },
      { id: 'approval-workflow-config', label: '报销流程定义', icon: <SettingOutlined /> },
      { id: 'role-workflow-config', label: '审批职责授权', icon: <TeamOutlined /> },
    ]}
  ]},
  { id: 'logistics', label: '后勤管理', icon: <ShopOutlined />, permission: 'finance:asset:view', children: [
    { id: 'logistics-devices', label: '设备管理', icon: <DesktopOutlined />, children: [
      { id: 'logistics-device-mgmt', label: '设备管理', icon: <DesktopOutlined />, permission: 'finance:asset:manage' },
      { id: 'logistics-device-list', label: '实机明细', icon: <FileSearchOutlined />, permission: 'finance:asset:manage' },
      { id: 'asset-request-audit', label: '申请审批', icon: <CheckCircleOutlined />, permission: 'finance:asset:audit' },
      { id: 'inventory-management', label: '库存管理', icon: <ShoppingCartOutlined />, permission: 'finance:procurement:manage' },
    ]}
  ]},
  { id: 'personal', label: '个人中心', icon: <UserOutlined />, children: [
    { id: 'personal-office', label: '个人办公', icon: <DesktopOutlined />, children: [
      { id: 'personal-info', label: '个人信息', icon: <IdcardOutlined /> },
      { id: 'my-todo', label: '待办中心', icon: <CheckCircleOutlined /> },
      { id: 'my-schedule', label: '我的排班', icon: <CalendarOutlined /> },
      { id: 'my-notifications', label: '我的通知', icon: <BellOutlined /> },
      { id: 'my-payslips', label: '我的薪资', icon: <WalletOutlined />, permission: 'payroll:payslip:view' },
      { id: 'my-assets', label: '个人资产', icon: <DesktopOutlined />, permission: 'personal:asset:view' },
      { id: 'my-memos', label: '我的备忘录', icon: <FileTextOutlined /> },
    ]}
  ]},
];

export default Sidebar;
