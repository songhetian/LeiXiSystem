import React, { useState, useMemo } from 'react';
import NotificationBadge from './NotificationBadge';
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
} from '@ant-design/icons';

// --- Component Definition ---

const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  // State to manage which top-level menus are expanded
  const [expandedMenus, setExpandedMenus] = useState(['user', 'org', 'chat']);

  // Memoized and filtered menu items based on user role
  const menuItems = useMemo(() => {
    const isAdmin = user?.username === 'admin' || user?.real_name?.includes('管理员');
    
    // Filter admin-only items immutably (without changing the original allMenuItems array)
    return allMenuItems
      .filter(item => !item.admin || isAdmin)
      .map(item => {
        if (!item.children) {
          return item;
        }
        // Filter children if they have admin restrictions
        const filteredChildren = item.children.filter(child => !child.admin || isAdmin);
        // Return a new item object to ensure immutability
        return { ...item, children: filteredChildren };
      });
  }, [user]);

  // Handler to toggle the expanded/collapsed state of a menu
  const toggleMenu = (menuId) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <SidebarHeader />
        <UserInfo user={user} onNavigate={setActiveTab} />
        <MainMenu
          menuItems={menuItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          expandedMenus={expandedMenus}
          toggleMenu={toggleMenu}
        />
      </div>

      {/* Fixed Footer */}
      <SidebarFooter onLogout={onLogout} />
    </aside>
  );
};

// --- Sub-components for Clarity ---

const SidebarHeader = () => (
  <div className="mb-6 pb-4 border-b border-gray-200">
    <h1 className="text-xl font-bold text-gray-800">雷犀客服系统</h1>
    <p className="text-gray-500 text-xs mt-1">Desktop Edition</p>
  </div>
);

const UserInfo = ({ user, onNavigate }) => (
  <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg text-white font-semibold">
          {user?.real_name?.charAt(0) || '用户'}
        </div>
        <NotificationBadge onNavigate={onNavigate} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-gray-800">{user?.real_name || '用户'}</p>
        <p className="text-xs text-gray-500 truncate">{user?.username}</p>
      </div>
    </div>
  </div>
);

const MainMenu = ({ menuItems, activeTab, setActiveTab, expandedMenus, toggleMenu }) => (
  <nav className="space-y-1">
    {menuItems.map(item => (
      <div key={item.id}>
        {/* Level 1 Menu Item */}
        <button
          onClick={() => (item.children ? toggleMenu(item.id) : setActiveTab(item.id))}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-all text-gray-700"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{item.icon}</span>
            <span className="font-medium text-sm">{item.label}</span>
          </div>
          {item.children && (
            <RightOutlined
              className={`text-xs transition-transform text-gray-400 ${
                expandedMenus.includes(item.id) ? 'rotate-90' : ''
              }`}
            />
          )}
        </button>

        {/* Level 2 Menu Items */}
        {item.children && expandedMenus.includes(item.id) && (
          <div className="ml-4 mt-1 pl-2 border-l border-gray-200 space-y-1">
            {item.children.map(child => (
              <button
                key={child.id}
                onClick={() => setActiveTab(child.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  activeTab === child.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {child.icon}
                <span>{child.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    ))}
  </nav>
);

const SidebarFooter = ({ onLogout }) => (
  <div className="p-4 border-t border-gray-200 space-y-2">
    <button
      onClick={onLogout}
      className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium"
    >
      退出登录
    </button>
    <div className="text-xs text-gray-400 text-center">
      © 2024 雷犀客服系统
    </div>
  </div>
);

// --- Menu Item Definitions ---

const allMenuItems = [
  {
    id: 'user',
    label: '员工管理',
    icon: <TeamOutlined />,
    children: [
      { id: 'user-employee', label: '员工管理', icon: <UserOutlined /> },
      { id: 'user-changes', label: '变动记录', icon: <FileTextOutlined /> },
      { id: 'user-approval', label: '员工审核', icon: <CheckCircleOutlined /> },
      { id: 'user-reset-password', label: '重置密码', icon: <KeyOutlined /> },
      { id: 'user-permission', label: '权限管理', icon: <SafetyOutlined />, admin: true },
    ],
  },
  {
    id: 'org',
    label: '组织架构',
    icon: <ApartmentOutlined />,
    children: [
      { id: 'org-department', label: '部门管理', icon: <ApartmentOutlined /> },
      { id: 'org-position', label: '职位管理', icon: <IdcardOutlined /> },
    ],
  },
  {
    id: 'chat',
    label: '聊天通讯',
    icon: <MessageOutlined />,
    children: [
      { id: 'chat-message', label: '即时通讯', icon: <MessageOutlined /> },
      { id: 'chat-group', label: '群组管理', icon: <TeamOutlined /> },
    ],
  },
  {
    id: 'attendance',
    label: '考勤管理',
    icon: <ClockCircleOutlined />,
    children: [
      { id: 'attendance-home', label: '考勤主页', icon: <HomeOutlined /> },
      { id: 'attendance-records', label: '考勤记录', icon: <FileTextOutlined /> },
      { id: 'attendance-leave-apply', label: '请假申请', icon: <FormOutlined /> },
      { id: 'attendance-leave-records', label: '请假记录', icon: <FileTextOutlined /> },
      { id: 'attendance-overtime-apply', label: '加班申请', icon: <FormOutlined /> },
      { id: 'attendance-overtime-records', label: '加班记录', icon: <FileTextOutlined /> },
      { id: 'attendance-makeup', label: '补卡申请', icon: <FormOutlined /> },
      { id: 'attendance-stats', label: '考勤统计', icon: <BarChartOutlined /> },
      { id: 'attendance-department', label: '部门考勤', icon: <ApartmentOutlined /> },
      { id: 'attendance-department-stats', label: '部门考勤统计', icon: <LineChartOutlined /> },
      { id: 'attendance-shift', label: '班次管理', icon: <SyncOutlined /> },
      { id: 'attendance-schedule', label: '排班管理', icon: <CalendarOutlined /> },
      { id: 'attendance-notifications', label: '考勤通知', icon: <BellOutlined /> },
      { id: 'attendance-smart-schedule', label: '智能排班', icon: <ThunderboltOutlined /> },
      { id: 'attendance-approval', label: '审批管理', icon: <CheckCircleOutlined /> },
      { id: 'attendance-settings', label: '考勤设置', icon: <SettingOutlined /> },
    ],
  },
  {
    id: 'quality',
    label: '质检管理',
    icon: <SearchOutlined />,
    children: [
      { id: 'quality-session', label: '会话管理', icon: <MessageOutlined /> },
      { id: 'quality-platform-shop', label: '平台与店铺管理', icon: <ShopOutlined /> },
      { id: 'quality-rule', label: '规则管理', icon: <FileSearchOutlined /> },
      { id: 'quality-score', label: '质检评分', icon: <StarOutlined /> },
      { id: 'quality-report', label: '质检报告', icon: <BarChartOutlined /> },
      { id: 'quality-report-summary', label: '质检综合报告', icon: <LineChartOutlined /> },
      { id: 'quality-case-library', label: '案例库', icon: <FolderOpenOutlined /> },
      { id: 'quality-recommendation', label: '案例推荐', icon: <StarOutlined /> },
    ],
  },
  {
    id: 'knowledge',
    label: '知识库',
    icon: <BookOutlined />,
    children: [
      { id: 'knowledge-articles', label: '公共知识库', icon: <FileTextOutlined /> },
      { id: 'knowledge-base', label: '知识库', icon: <DatabaseOutlined /> },
      { id: 'my-knowledge', label: '我的知识库', icon: <StarOutlined /> },
    ],
  },
  {
    id: 'assessment',
    label: '考核系统',
    icon: <FormOutlined />,
    children: [
      { id: 'assessment-exams', label: '试卷管理', icon: <FileTextOutlined /> },
      { id: 'assessment-plans', label: '考核计划', icon: <CalendarOutlined /> },
      { id: 'assessment-categories', label: '分类管理', icon: <FolderOpenOutlined /> },
      { id: 'assessment-results', label: '考试结果', icon: <EyeOutlined /> },
      { id: 'assessment-drag-drop-builder', label: '拖拽组卷', icon: <FormOutlined /> },
      { id: 'my-exams', label: '我的考试', icon: <IdcardOutlined /> },
    ],
  },
  {
    id: 'statistics',
    label: '统计分析',
    icon: <BarChartOutlined />,
    children: [
      { id: 'statistics-overview', label: '总览', icon: <LineChartOutlined /> },
      { id: 'statistics-employee', label: '员工统计', icon: <UserOutlined /> },
      { id: 'statistics-department', label: '部门统计', icon: <ApartmentOutlined /> },
      { id: 'statistics-viewing', label: '浏览统计', icon: <EyeOutlined /> },
    ],
  },
  {
    id: 'personal',
    label: '个人中心',
    icon: <UserOutlined />,
    children: [
      { id: 'personal-info', label: '个人信息', icon: <IdcardOutlined /> },
    ],
  },
  {
    id: 'notifications',
    label: '消息通知',
    icon: <BellOutlined />,
    children: [
      { id: 'notification-center', label: '通知中心', icon: <BellOutlined /> },
      { id: 'notification-sender', label: '通知发送', icon: <SendOutlined />, admin: true },
      { id: 'notification-settings', label: '通知设置', icon: <SettingOutlined /> },
    ],
  },
];

export default Sidebar;
