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
} from '@ant-design/icons';

import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useChatStore } from '../hooks/useChatStore';

// --- Component Definition ---

const Sidebar = ({
  activeTab,
  setActiveTab,  // 使用这个prop而不是忽略它
  user,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  permissions = [],
  onNavigate,
  theme = { background: '#F3F4F6' }
}) => {
  const { totalUnreadCount, notificationEnabled } = useChatStore();
  
  // State to manage which menus are expanded
  const [expandedMenus, setExpandedMenus] = useState(['hr', 'hr-employee', 'collaboration', 'information']);
  const [searchQuery, setSearchQuery] = useState('');

  const { hasPermission } = usePermission();

  // ... (allMenuItems definition remains the same internally but will be accessed via props or context if needed)
  
  // Recursive function to filter children based on permissions
  const filterChildren = (children) => {
    return children
      .filter(child => {
        // If permission is defined, check it
        if (child.permission) {
          return hasPermission(child.permission);
        }
        // If no permission but has admin flag, hide it (legacy support, or force permission)
        // For now, if no permission is set, we assume it's visible (like 'personal' items)
        // UNLESS it has admin: true, then we hide it if we want to be strict.
        // But since I added permissions to all admin items, this should be fine.
        if (child.admin) {
           return false;
        }
        return true;
      })
      .map(child => {
        if (!child.children) {
          return child;
        }
        const filteredGrandChildren = filterChildren(child.children);
        // If parent has permission but all children are filtered out, should we show parent?
        // If parent is just a container, maybe not.
        if (filteredGrandChildren.length === 0 && child.children.length > 0) {
          return null;
        }
        return { ...child, children: filteredGrandChildren };
      })
      .filter(Boolean);
  };

  // Memoized and filtered menu items based on user role and permissions
  const menuItems = useMemo(() => {
    return filterChildren(allMenuItems);
  }, [user, hasPermission]);

  // Search filter logic
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery.trim()) return menuItems;

    const query = searchQuery.toLowerCase();

    const filterRecursive = (items) => {
      return items.map(item => {
        const labelMatch = matchPinyin(item.label, query);

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
  const toggleMenu = (menuId, level = 1) => {
    setExpandedMenus(prev => {
      if (prev.includes(menuId)) {
        // 如果当前菜单已展开，则关闭它
        return prev.filter(id => id !== menuId);
      } else {
        // 如果当前菜单未展开，查找该项的同级 ID
        const findSiblings = (items) => {
          if (items.some(item => item.id === menuId)) {
            return items.map(item => item.id);
          }
          for (const item of items) {
            if (item.children) {
              const siblings = findSiblings(item.children);
              if (siblings) return siblings;
            }
          }
          return null;
        };

        const siblingIds = findSiblings(allMenuItems);

        if (siblingIds) {
          // 关闭所有同级已打开的菜单，并打开当前菜单
          const filtered = prev.filter(id => !siblingIds.includes(id));
          return [...filtered, menuId];
        } else {
          // 备退方案：直接展开
          return [...prev, menuId];
        }
      }
    });
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setExpandedMenus(['hr', 'hr-employee', 'collaboration', 'information']);
  };

  // 修改退出按钮的点击处理函数
  const handleLogoutClick = () => {
    Modal.confirm({
      title: '确认退出',
      icon: <ExclamationCircleOutlined />,
      content: '确定要退出登录吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: onLogout,
      centered: true,
    });
  };

  // 处理菜单项点击 - 直接使用从父组件传入的setActiveTab
  const handleMenuClick = (tabId, params = {}) => {
    if (setActiveTab) {
      setActiveTab(tabId, params);
    }
  };

  return (
    <aside
      className="w-80 border-r border-gray-200 flex flex-col"
      style={{ backgroundColor: theme.background }}
    >
      {/* Scrollable Main Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <SidebarHeader />
        <SearchBox
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          clearSearch={clearSearch}
        />

        <MainMenu
          menuItems={filteredMenuItems}
          activeTab={activeTab}
          setActiveTab={handleMenuClick}  // 使用新的handleMenuClick函数
          expandedMenus={expandedMenus}
          toggleMenu={toggleMenu}
          searchQuery={searchQuery}
          chatUnreadCount={totalUnreadCount}
          showChatBadge={notificationEnabled}
        />
      </div>

      {/* Fixed Footer */}
      <SidebarFooter user={user} onLogout={onLogout} />
    </aside>
  );
};

// --- Sub-components for Clarity ---

const SidebarHeader = () => (
  <div className="mb-4 pb-4 border-b border-gray-200 flex items-center gap-3 px-2">
    <img src="/icons/logo.ico" alt="雷犀客服管理系统" className="w-10 h-10 rounded-lg" />
    <div>
      <h1 className="text-lg font-bold text-gray-800">雷犀客服管理系统</h1>
    </div>
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
        className="w-full pl-9 pr-8 py-2 border border-gray-300 text-sm rounded-lg"
      />
      {searchQuery && (
        <button
          onClick={clearSearch}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
        >
          <CloseCircleOutlined className="text-sm" />
        </button>
      )}
    </div>
  </div>
);

const UserInfo = ({ user, onNavigate }) => (
  <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-500 flex items-center justify-center text-lg text-white font-semibold rounded-full">
        {user?.real_name?.charAt(0) || '用户'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-gray-800">{user?.real_name || '用户'}</p>
        <p className="text-xs text-gray-500 truncate">{user?.username}</p>
      </div>
    </div>
  </div>
);

const MainMenu = ({ menuItems, activeTab, setActiveTab, expandedMenus, toggleMenu, searchQuery, chatUnreadCount, showChatBadge }) => (
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
        chatUnreadCount={chatUnreadCount}
        showChatBadge={showChatBadge}
      />
    ))}
  </nav>
);

// Recursive MenuItem component
const MenuItem = ({ item, level, activeTab, setActiveTab, expandedMenus, toggleMenu, searchQuery, chatUnreadCount, showChatBadge }) => {
  const isExpanded = expandedMenus.includes(item.id);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = activeTab === item.id;

  // Styling based on level - simplified and clearer
  const getLevelStyles = () => {
    switch (level) {
      case 1:
        return {
          container: 'mb-1',
          button: `px-4 py-2 text-gray-800 hover:bg-gray-100 font-semibold rounded-lg ${
            isActive ? 'bg-blue-50 text-blue-600' : ''
          }`,
          icon: 'text-base',
          text: 'text-sm',
        };
      case 2:
        return {
          container: 'ml-4 border-l-2 border-gray-200',
          button: `pl-4 pr-4 py-2 rounded-lg ${
            isActive
              ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-500 font-medium'
              : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
          }`,
          icon: 'text-sm',
          text: 'text-sm',
        };
      case 3:
        return {
          container: 'ml-8 border-l-2 border-gray-200',
          button: `pl-4 pr-4 py-1.5 rounded-lg ${
            isActive
              ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-400 font-medium'
              : 'text-gray-600 hover:bg-gray-50 hover:text-blue-500'
          }`,
          icon: 'text-xs',
          text: 'text-xs',
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
        <span className="bg-yellow-200 text-gray-900 font-medium">{text.substring(index, index + searchQuery.length)}</span>
        {text.substring(index + searchQuery.length)}
      </>
    );
  };

  // 处理菜单项点击事件
  const handleMenuClick = () => {
    if (hasChildren) {
      toggleMenu(item.id, level);
    } else {
      // 使用从父组件传入的setActiveTab函数
      setActiveTab(item.id);
    }
  };

  return (
    <div className={styles.container}>
      {/* Menu Item Button */}
      <button
        onClick={handleMenuClick}
        className={`w-full flex items-center justify-between ${styles.button}`}
      >
        <div className="flex-1 flex items-center justify-between min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.text + " truncate"}>{highlightText(item.label)}</span>
          </div>
          
          {/* 未读数徽标 */}
          {item.id === 'messaging-chat' && showChatBadge && chatUnreadCount > 0 && (
            <span className="flex-shrink-0 ml-2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none min-w-[18px] text-center">
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </div>
        
        {hasChildren && (
          <RightOutlined
            className={`text-xs transition-transform duration-200 flex-shrink-0 ml-2 ${
              isExpanded ? 'rotate-90' : ''
            } ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
          />
        )}
      </button>

      {/* Children Menu Items */}
      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-0.5">
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
              chatUnreadCount={chatUnreadCount}
              showChatBadge={showChatBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SidebarFooter = ({ user, onLogout }) => {
  // 修改退出按钮的点击处理函数
  const handleLogoutClick = () => {
    Modal.confirm({
      title: '确认退出',
      icon: <ExclamationCircleOutlined />,
      content: '确定要退出登录吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: onLogout,
      centered: true,
    });
  };

  return (
    <div className="p-4 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center gap-3 mb-3">
         <div className="w-9 h-9 bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 rounded-full">
            {user?.real_name?.charAt(0) || <UserOutlined />}
         </div>
         <div className="flex-1 min-w-0">
           <div className="text-sm font-semibold text-gray-700 truncate">{user?.real_name || '未登录'}</div>
           <div className="text-xs text-gray-400 truncate">@{user?.username || 'guest'}</div>
         </div>
      </div>
      <button
        onClick={handleLogoutClick} // 修改为新的处理函数
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 text-sm font-medium rounded-lg"
      >
        <LogoutOutlined />
        <span>退出登录</span>
      </button>
    </div>
  );
};

// --- Menu Item Definitions with Three-Level Structure ---

const allMenuItems = [
  {
    id: 'dashboard',
    label: '控制面板',
    icon: <HomeOutlined />,
    permission: 'system:dashboard:view',
  },
  {
    id: 'admin-dashboard',
    label: '企业看板',
    icon: <BarChartOutlined />,
    permission: 'system:dashboard:admin',
  },
  {
    id: 'hr',
    label: '人事管理',
    icon: <TeamOutlined />,
    children: [
      {
        id: 'hr-employee',
        label: '员工管理',
        icon: <UserOutlined />,
        permission: 'user:employee:view',
        children: [
          { id: 'user-employee', label: '员工管理', icon: <UserOutlined />, permission: 'user:employee:view' },
          { id: 'user-changes', label: '变动记录', icon: <FileTextOutlined />, permission: 'user:employee:view' },
          { id: 'user-approval', label: '员工审核', icon: <CheckCircleOutlined />, permission: 'user:audit:manage' },
        ]
      },
      {
        id: 'hr-org',
        label: '组织架构',
        icon: <ApartmentOutlined />,
        permission: 'org:department:view',
        children: [
          { id: 'org-department', label: '部门管理', icon: <ApartmentOutlined />, permission: 'org:department:view' },
          { id: 'org-position', label: '职位管理', icon: <IdcardOutlined />, permission: 'org:position:view' },
        ]
      }
    ]
  },
  {
    id: 'permission',
    label: '权限管理',
    icon: <SafetyOutlined />,
    children: [
      { id: 'user-permission', label: '权限管理', icon: <SafetyOutlined />, permission: 'system:role:view' },
      { id: 'user-role-management', label: '角色分配', icon: <TeamOutlined />, permission: 'system:role:manage' },
      { id: 'user-reset-password', label: '重置密码', icon: <KeyOutlined />, permission: 'user:security:reset_password' },
      { id: 'system-logs', label: '操作日志', icon: <FileTextOutlined />, permission: 'system:log:view' },
    ]
  },
  {
    id: 'collaboration',
    label: '办公协作',
    icon: <MessageOutlined />,
    children: [
      {
        id: 'information',
        label: '信息发布',
        icon: <SoundOutlined />,
        children: [
          { id: 'messaging-broadcast', label: '系统广播', icon: <SoundOutlined />, permission: 'messaging:broadcast:view' },
          { id: 'broadcast-management', label: '发布广播', icon: <SendOutlined />, permission: 'messaging:broadcast:manage' },
          { id: 'notification-settings', label: '通知设置', icon: <BellOutlined />, permission: 'messaging:config:manage' },
        ]
      },
      { id: 'messaging-chat', label: '即时通讯', icon: <MessageOutlined />, permission: 'messaging:chat:use' },
      { id: 'messaging-group-management', label: '群组管理', icon: <TeamOutlined />, permission: 'messaging:chat:manage' },
      { id: 'employee-memos', label: '部门备忘录', icon: <BellOutlined />, permission: 'user:memo:manage' },
    ]
  },
  {
    id: 'attendance',
    label: '考勤管理',
    icon: <ClockCircleOutlined />,
    permission: 'attendance:record:view',
    children: [
      {
        id: 'attendance-records-section',
        label: '考勤记录',
        icon: <FileTextOutlined />,
        children: [
          { id: 'attendance-home', label: '考勤主页', icon: <HomeOutlined />, permission: 'attendance:record:view' },
          { id: 'attendance-records', label: '考勤记录', icon: <FileTextOutlined />, permission: 'attendance:record:view' },
        ]
      },
      {
        id: 'leave-section',
        label: '请假管理',
        icon: <FormOutlined />,
        children: [
          { id: 'attendance-leave-apply', label: '请假申请', icon: <FormOutlined />, permission: 'attendance:record:view' },
          { id: 'attendance-leave-records', label: '请假记录', icon: <FileTextOutlined />, permission: 'attendance:record:view' },
        ]
      },
      {
        id: 'overtime-section',
        label: '加班管理',
        icon: <ClockCircleOutlined />,
        children: [
          { id: 'attendance-overtime-apply', label: '加班申请', icon: <FormOutlined />, permission: 'attendance:record:view' },
          { id: 'attendance-overtime-records', label: '加班记录', icon: <FileTextOutlined />, permission: 'attendance:record:view' },
        ]
      },
      {
        id: 'makeup-section',
        label: '补卡管理',
        icon: <FormOutlined />,
        children: [
          { id: 'attendance-makeup', label: '补卡申请', icon: <FormOutlined />, permission: 'attendance:record:view' },
        ]
      },
      {
        id: 'reports-section',
        label: '统计报表',
        icon: <BarChartOutlined />,
        children: [
          { id: 'attendance-stats', label: '考勤统计', icon: <BarChartOutlined />, permission: 'attendance:report:view' },
          { id: 'attendance-department', label: '部门考勤统计', icon: <ApartmentOutlined />, permission: 'attendance:report:view' },
        ]
      },
      {
        id: 'schedule-section',
        label: '排班管理',
        icon: <CalendarOutlined />,
        children: [
          { id: 'attendance-shift', label: '班次管理', icon: <SyncOutlined />, permission: 'attendance:config:manage' },
          { id: 'attendance-schedule', label: '排班管理', icon: <CalendarOutlined />, permission: 'attendance:schedule:manage' },
          { id: 'attendance-smart-schedule', label: '智能排班', icon: <ThunderboltOutlined />, permission: 'attendance:schedule:manage' },
        ]
      },
      {
        id: 'approval-section',
        label: '审批管理',
        icon: <CheckCircleOutlined />,
        children: [
          { id: 'attendance-approval', label: '审批管理', icon: <CheckCircleOutlined />, permission: 'attendance:approval:manage' },
        ]
      },
      {
        id: 'attendance-settings-section',
        label: '系统设置',
        icon: <SettingOutlined />,
        children: [
          { id: 'attendance-settings', label: '考勤设置', icon: <SettingOutlined />, permission: 'attendance:config:manage' },
        ]
      },
    ],
  },
  {
    id: 'vacation',
    label: '假期管理',
    icon: <CalendarOutlined />,
    permission: 'vacation:record:view',
    children: [
      {
        id: 'vacation-application',
        label: '假期申请',
        icon: <FormOutlined />,
        children: [
          { id: 'compensatory-apply', label: '申请调休', icon: <FormOutlined />, permission: 'vacation:record:view' },
        ]
      },
      {
        id: 'vacation-records',
        label: '假期记录',
        icon: <FileTextOutlined />,
        children: [
          { id: 'vacation-details', label: '假期明细', icon: <FileTextOutlined />, permission: 'vacation:record:view' },
          { id: 'vacation-summary', label: '假期汇总', icon: <BarChartOutlined />, permission: 'vacation:record:view' },
        ]
      },
      {
        id: 'vacation-approval',
        label: '审批管理',
        icon: <CheckCircleOutlined />,
        children: [
          { id: 'compensatory-approval', label: '调休审批', icon: <CheckCircleOutlined />, permission: 'vacation:approval:manage' },
        ]
      },
      {
        id: 'vacation-settings',
        label: '系统设置',
        icon: <SettingOutlined />,
        children: [
          { id: 'quota-config', label: '额度配置', icon: <SettingOutlined />, permission: 'vacation:config:manage' },
        ]
      },
    ],
  },
  {
    id: 'payroll',
    label: '工资管理',
    icon: <TeamOutlined />,
    permission: 'payroll:payslip:view',
    children: [
      {
        id: 'payslip-employee',
        label: '我的工资条',
        icon: <FileTextOutlined />,
        children: [
          { id: 'my-payslips', label: '工资条列表', icon: <FileTextOutlined />, permission: 'payroll:payslip:view' },
        ]
      },
      {
        id: 'payslip-admin',
        label: '工资条管理',
        icon: <SettingOutlined />,
        children: [
          { id: 'payslip-management', label: '工资条管理', icon: <FileTextOutlined />, permission: 'payroll:payslip:manage' },
        ]
      },
    ],
  },
  {
    id: 'reimbursement',
    label: '报销管理',
    icon: <FormOutlined />,
    permission: 'reimbursement:record:view',
    children: [
      {
        id: 'reimbursement-apply-section',
        label: '报销申请',
        icon: <FormOutlined />,
        children: [
          { id: 'reimbursement-apply', label: '新建报销', icon: <FormOutlined />, permission: 'reimbursement:apply:submit' },
          { id: 'reimbursement-list', label: '我的报销', icon: <FileTextOutlined />, permission: 'reimbursement:record:view' },
        ]
      },
      {
        id: 'reimbursement-approval-section',
        label: '审批管理',
        icon: <CheckCircleOutlined />,
        children: [
          { id: 'reimbursement-approval', label: '报销审批', icon: <CheckCircleOutlined />, permission: 'reimbursement:apply:approve' },
        ]
      },
      {
        id: 'reimbursement-config-section',
        label: '系统配置',
        icon: <SettingOutlined />,
        children: [
          { id: 'approval-workflow-config', label: '流程配置', icon: <SettingOutlined />, permission: 'reimbursement:config:manage' },
          { id: 'approver-management', label: '审批人管理', icon: <UserOutlined />, permission: 'reimbursement:config:manage' },
          { id: 'reimbursement-settings', label: '报销设置', icon: <SettingOutlined />, permission: 'reimbursement:config:settings' },
          { id: 'role-workflow-config', label: '角色流程配置', icon: <TeamOutlined />, permission: 'reimbursement:config:role_workflow' },
        ]
      },
    ],
  },
  {
    id: 'quality',
    label: '质检管理',
    icon: <SearchOutlined />,
    permission: 'quality:session:view',
    children: [
      {
        id: 'quality-config',
        label: '质检配置',
        icon: <SettingOutlined />,
        children: [
          { id: 'quality-platform-shop', label: '平台店铺', icon: <ShopOutlined />, permission: 'quality:config:manage' },
          { id: 'quality-tags', label: '标签管理', icon: <TagsOutlined />, permission: 'quality:config:manage' },
        ]
      },
      { id: 'quality-score', label: '会话质检', icon: <StarOutlined />, permission: 'quality:session:view' },
      {
        id: 'quality-cases',
        label: '案例管理',
        icon: <FolderOpenOutlined />,
        children: [
          { id: 'quality-case-library', label: '案例库', icon: <FolderOpenOutlined />, permission: 'quality:case:manage' },
          { id: 'quality-case-categories', label: '案例分类管理', icon: <FolderOpenOutlined />, permission: 'quality:case:manage' },
        ]
      },
    ],
  },
  {
    id: 'knowledge',
    label: '知识管理',
    icon: <BookOutlined />,
    permission: 'knowledge:article:view',
    children: [
      { id: 'knowledge-articles', label: '公共知识库', icon: <FileTextOutlined />, permission: 'knowledge:article:view' },
      { id: 'knowledge-base', label: '知识库', icon: <DatabaseOutlined />, permission: 'knowledge:article:manage' },
      { id: 'my-knowledge', label: '我的知识库', icon: <StarOutlined />, permission: 'knowledge:article:view' },
    ],
  },
  {
    id: 'assessment',
    label: '考核系统',
    icon: <FormOutlined />,
    permission: 'assessment:plan:view',
    children: [
      {
        id: 'assessment-questions',
        label: '试题管理',
        icon: <FileTextOutlined />,
        children: [
          { id: 'assessment-exams', label: '试卷管理', icon: <FileTextOutlined />, permission: 'assessment:plan:manage' },
          { id: 'assessment-categories', label: '分类管理', icon: <FolderOpenOutlined />, permission: 'assessment:plan:manage' },
        ]
      },
      {
        id: 'assessment-management',
        label: '考核管理',
        icon: <CalendarOutlined />,
        children: [
          { id: 'exam-plans', label: '考核计划', icon: <CalendarOutlined />, permission: 'assessment:plan:manage' },
        ]
      },
      {
        id: 'assessment-results',
        label: '成绩管理',
        icon: <EyeOutlined />,
        children: [
          { id: 'exam-results', label: '考试结果', icon: <EyeOutlined />, permission: 'assessment:result:view' },
          { id: 'my-exams', label: '我的考试', icon: <IdcardOutlined /> }, // 基础功能
          { id: 'my-exam-results', label: '我的考试结果', icon: <FileTextOutlined /> },
        ]
      },
    ],
  },
  {
    id: 'finance',
    label: '财务管理',
    icon: <DatabaseOutlined />,
    permission: 'reimbursement:record:view',
    children: [
      {
        id: 'finance-reimbursement',
        label: '财务报销',
        icon: <FileTextOutlined />,
        permission: 'reimbursement:apply:approve',
        children: [
            { id: 'reimbursement-approval', label: '报销审批', icon: <CheckCircleOutlined />, permission: 'reimbursement:apply:approve' },
            { id: 'reimbursement-settings', label: '报销设置', icon: <SettingOutlined />, permission: 'reimbursement:config:settings' },
        ]
      },
      { id: 'system-workflow', label: '流程设置', icon: <SyncOutlined />, permission: 'system:workflow:manage' }
    ]
  },
  {
    id: 'logistics',
    label: '后勤管理',
    icon: <ShopOutlined />,
    permission: 'finance:asset:view',
    children: [
      {
        id: 'logistics-devices',
        label: '设备管理',
        icon: <DesktopOutlined />,
        children: [
            { id: 'logistics-device-mgmt', label: '设备管理', icon: <DesktopOutlined />, permission: 'finance:asset:manage' },
            { id: 'logistics-device-list', label: '实机明细', icon: <FileSearchOutlined />, permission: 'finance:asset:manage' },
            { id: 'asset-request-audit', label: '申请审批', icon: <CheckCircleOutlined />, permission: 'finance:asset:audit' },
            { id: 'inventory-management', label: '库存管理', icon: <ShoppingCartOutlined />, permission: 'finance:procurement:manage' },
        ]
      }
    ]
  },
  {
    id: 'personal',
    label: '个人中心',
    icon: <UserOutlined />,
    children: [
      {
        id: 'personal-info-section',
        label: '个人信息',
        icon: <IdcardOutlined />,
        children: [
          { id: 'personal-info', label: '个人信息', icon: <IdcardOutlined /> },
        ]
      },
      {
        id: 'personal-office',
        label: '个人办公',
        icon: <DesktopOutlined />,
        children: [
          { id: 'my-todo', label: '待办中心', icon: <CheckCircleOutlined /> },
          { id: 'my-schedule', label: '我的排班', icon: <CalendarOutlined /> },
          { id: 'my-notifications', label: '我的通知', icon: <BellOutlined /> },
          { id: 'my-assets', label: '个人资产', icon: <DesktopOutlined />, permission: 'personal:asset:view' },
          { id: 'my-memos', label: '我的备忘录', icon: <FileTextOutlined /> },
        ]
      },
    ],
  },
];

export default Sidebar;
