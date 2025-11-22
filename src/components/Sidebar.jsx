import React, { useState, useMemo } from 'react';

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
  CloseCircleOutlined,
} from '@ant-design/icons';

// --- Component Definition ---

const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  // State to manage which menus are expanded
  const [expandedMenus, setExpandedMenus] = useState(['user', 'org']);
  const [searchQuery, setSearchQuery] = useState('');

  // Recursive function to filter children based on admin status
  const filterChildren = (children, isAdmin) => {
    return children
      .filter(child => !child.admin || isAdmin)
      .map(child => {
        if (!child.children) {
          return child;
        }
        const filteredGrandChildren = filterChildren(child.children, isAdmin);
        return { ...child, children: filteredGrandChildren };
      });
  };

  // Memoized and filtered menu items based on user role
  const menuItems = useMemo(() => {
    const isAdmin = user?.username === 'admin' || user?.real_name?.includes('管理员');

    // Filter admin-only items immutably
    return allMenuItems
      .filter(item => !item.admin || isAdmin)
      .map(item => {
        if (!item.children) {
          return item;
        }
        // Recursively filter children
        const filteredChildren = filterChildren(item.children, isAdmin);
        return { ...item, children: filteredChildren };
      });
  }, [user]);

  // Search filter logic
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;

    const query = searchQuery.toLowerCase();

    const filterRecursive = (items) => {
      return items.map(item => {
        const labelMatch = item.label.toLowerCase().includes(query);

        if (!item.children) {
          return labelMatch ? item : null;
        }

        // If parent label matches, include all children
        if (labelMatch) {
          return item;
        }

        // Otherwise, only include children that match
        const filteredChildren = filterRecursive(item.children).filter(Boolean);

        if (filteredChildren.length > 0) {
          return { ...item, children: filteredChildren };
        }

        return null;
      }).filter(Boolean);
    };

    const filtered = filterRecursive(menuItems);

    // Auto-expand all menus when searching
    if (searchQuery.trim()) {
      const allIds = [];
      const collectIds = (items) => {
        items.forEach(item => {
          if (item.children && item.children.length > 0) {
            allIds.push(item.id);
            collectIds(item.children);
          }
        });
      };
      collectIds(filtered);
      setExpandedMenus(allIds);
    }

    return filtered;
  }, [searchQuery, menuItems]);

  // Handler to toggle the expanded/collapsed state of a menu
  const toggleMenu = (menuId) => {
    setExpandedMenus(prev =>
      prev.includes(menuId)
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setExpandedMenus(['user', 'org', 'chat']);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <SidebarHeader />
        <SearchBox
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          clearSearch={clearSearch}
        />
        <UserInfo user={user} onNavigate={setActiveTab} />
        <MainMenu
          menuItems={filteredMenuItems}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          expandedMenus={expandedMenus}
          toggleMenu={toggleMenu}
          searchQuery={searchQuery}
        />
      </div>

      {/* Fixed Footer */}
      <SidebarFooter onLogout={onLogout} />
    </aside>
  );
};

// --- Sub-components for Clarity ---

const SidebarHeader = () => (
  <div className="mb-4 pb-4 border-b border-gray-200">
    <h1 className="text-xl font-bold text-gray-800">雷犀客服系统</h1>
    <p className="text-gray-500 text-xs mt-1">Desktop Edition</p>
  </div>
);

const SearchBox = ({ searchQuery, setSearchQuery, clearSearch }) => (
  <div className="mb-4">
    <div className="relative">
      <SearchOutlined className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
      <input
        type="text"
        placeholder="搜索功能..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
      />
      {searchQuery && (
        <button
          onClick={clearSearch}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <CloseCircleOutlined className="text-sm" />
        </button>
      )}
    </div>
  </div>
);

const UserInfo = ({ user, onNavigate }) => (
  <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg text-white font-semibold">
          {user?.real_name?.charAt(0) || '用户'}
        </div>

      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-gray-800">{user?.real_name || '用户'}</p>
        <p className="text-xs text-gray-500 truncate">{user?.username}</p>
      </div>
    </div>
  </div>
);

const MainMenu = ({ menuItems, activeTab, setActiveTab, expandedMenus, toggleMenu, searchQuery }) => (
  <nav className="space-y-1">
    {menuItems.map(item => (
      <MenuItem
        key={item.id}
        item={item}
        level={1}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        expandedMenus={expandedMenus}
        toggleMenu={toggleMenu}
        searchQuery={searchQuery}
      />
    ))}
  </nav>
);

// Recursive MenuItem component
const MenuItem = ({ item, level, activeTab, setActiveTab, expandedMenus, toggleMenu, searchQuery }) => {
  const isExpanded = expandedMenus.includes(item.id);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = activeTab === item.id;

  // Styling based on level
  const getLevelStyles = () => {
    switch (level) {
      case 1:
        return {
          container: '',
          button: 'px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 font-semibold rounded-xl transition-all duration-200',
          icon: 'text-lg',
          text: 'text-sm',
        };
      case 2:
        return {
          container: 'ml-4 pl-4 border-l-2 border-blue-100',
          button: `px-4 py-2.5 rounded-lg transition-all duration-200 ${
            isActive
              ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-200 font-medium'
              : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
          }`,
          icon: 'text-base',
          text: 'text-sm',
        };
      default:
        return {
          container: '',
          button: 'px-3 py-2',
          icon: 'text-base',
          text: 'text-sm',
        };
    }
  };

  const styles = getLevelStyles();

  // Highlight search matches
  const highlightText = (text) => {
    if (!searchQuery.trim()) return text;

    const query = searchQuery.toLowerCase();
    const index = text.toLowerCase().indexOf(query);

    if (index === -1) return text;

    return (
      <>
        {text.substring(0, index)}
        <span className="bg-yellow-200 text-gray-900">{text.substring(index, index + searchQuery.length)}</span>
        {text.substring(index + searchQuery.length)}
      </>
    );
  };

  return (
    <div>
      {/* Menu Item Button */}
      <button
        onClick={() => (hasChildren ? toggleMenu(item.id) : setActiveTab(item.id))}
        className={`w-full flex items-center justify-between rounded-lg transition-all ${styles.button}`}
      >
        <div className="flex items-center gap-3">
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.text}>{highlightText(item.label)}</span>
        </div>
        {hasChildren && (
          <RightOutlined
            className={`text-xs transition-transform duration-200 text-gray-400 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
        )}
      </button>

      {/* Children Menu Items */}
      {hasChildren && isExpanded && (
        <div className={`mt-1 space-y-1 ${styles.container}`}>
          {item.children.map(child => (
            <MenuItem
              key={child.id}
              item={child}
              level={level + 1}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              expandedMenus={expandedMenus}
              toggleMenu={toggleMenu}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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

// --- Menu Item Definitions with Three-Level Structure ---

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
    id: 'attendance',
    label: '考勤管理',
    icon: <ClockCircleOutlined />,
    children: [
      { id: 'attendance-home', label: '考勤主页', icon: <HomeOutlined /> },
      { id: 'attendance-records', label: '考勤记录', icon: <FileTextOutlined /> },
      { id: 'attendance-makeup', label: '补卡申请', icon: <FormOutlined /> },
      { id: 'attendance-leave-apply', label: '请假申请', icon: <FormOutlined /> },
      { id: 'attendance-leave-records', label: '请假记录', icon: <FileTextOutlined /> },
      { id: 'attendance-overtime-apply', label: '加班申请', icon: <FormOutlined /> },
      { id: 'attendance-overtime-records', label: '加班记录', icon: <FileTextOutlined /> },
      { id: 'attendance-stats', label: '考勤统计', icon: <BarChartOutlined /> },
      { id: 'attendance-department', label: '部门考勤', icon: <ApartmentOutlined /> },
      { id: 'attendance-department-stats', label: '部门统计', icon: <LineChartOutlined /> },
      { id: 'attendance-shift', label: '班次管理', icon: <SyncOutlined /> },
      { id: 'attendance-schedule', label: '排班管理', icon: <CalendarOutlined /> },
      { id: 'attendance-smart-schedule', label: '智能排班', icon: <ThunderboltOutlined /> },
      { id: 'attendance-approval', label: '审批管理', icon: <CheckCircleOutlined /> },
      { id: 'attendance-notifications', label: '考勤通知', icon: <BellOutlined /> },
      { id: 'attendance-settings', label: '考勤设置', icon: <SettingOutlined /> },
    ],
  },
  {
    id: 'vacation',
    label: '假期管理',
    icon: <CalendarOutlined />,
    children: [
      { id: 'compensatory-apply', label: '申请调休', icon: <FormOutlined /> },
      { id: 'vacation-details', label: '假期明细', icon: <FileTextOutlined /> },
      { id: 'quota-config', label: '额度配置', icon: <SettingOutlined /> },
      { id: 'vacation-summary', label: '假期汇总', icon: <BarChartOutlined /> },
      { id: 'compensatory-approval', label: '调休审批', icon: <CheckCircleOutlined /> },
    ],
  },
  {
    id: 'quality',
    label: '质检管理',
    icon: <SearchOutlined />,
    children: [
      { id: 'quality-session', label: '会话管理', icon: <MessageOutlined /> },
      { id: 'quality-platform-shop', label: '平台店铺', icon: <ShopOutlined /> },
      { id: 'quality-rule', label: '规则管理', icon: <FileSearchOutlined /> },
      { id: 'quality-score', label: '质检评分', icon: <StarOutlined /> },
      { id: 'quality-report', label: '质检报告', icon: <BarChartOutlined /> },
      { id: 'quality-report-summary', label: '综合报告', icon: <LineChartOutlined /> },
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
];

export default Sidebar;
