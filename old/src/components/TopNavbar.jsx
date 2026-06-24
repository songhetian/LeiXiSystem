import api from '@/api';
import React, { useMemo, useState, useEffect } from 'react';
import { Popover, Slider, Modal, Button } from 'antd';
import { getApiUrl } from '../utils/apiConfig';
import {
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  BellOutlined,
  FontSizeOutlined,
  ExclamationCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';
import NotificationDropdown from './NotificationDropdown';
import { wsManager } from '../services/websocket';

const TopNavbar = ({ activeTab, user, onLogout, unreadCount = 0, onUpdateUnread, onNavigate, zoomLevel = 100, onZoomChange }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [latestBroadcast, setLatestBroadcast] = useState(null); // 新增：存储最新的一条广播

  // --- 性能与体验优化：监听系统广播并实时展示 ---
  useEffect(() => {
    const handleNewBroadcast = (broadcast) => {
      setLatestBroadcast(broadcast);
      // 30秒后自动淡出提示
      setTimeout(() => setLatestBroadcast(null), 30000);
    };

    const fetchLatestBroadcast = async () => {
      try {
        const res = await api.get('/broadcasts/my-broadcasts', { 
          params: { limit: 1, isRead: false }
        });
        if (res.data.success && res.data.data.length > 0) {
          setLatestBroadcast(res.data.data[0]);
        }
      } catch (e) {}
    };

    fetchLatestBroadcast();
    
    // 监听 WebSocket 事件 (wsManager 已经在 App.jsx 中初始化并连接)
    wsManager.on('broadcast', handleNewBroadcast);
    wsManager.on('new_broadcast', handleNewBroadcast);

    return () => {
      wsManager.off('broadcast', handleNewBroadcast);
      wsManager.off('new_broadcast', handleNewBroadcast);
    };
  }, []);

  const menuItems = [
    {
      id: 'dashboard',
      label: '控制面板',
    },
    {
      id: 'admin-dashboard',
      label: '企业看板',
    },
    {
      id: 'user',
      label: '员工管理',
      children: [
        { id: 'user-employee', label: '员工管理' },
        { id: 'user-changes', label: '变动记录' },
        { id: 'user-approval', label: '员工审核' },
        { id: 'user-reset-password', label: '重置密码' },
        { id: 'user-permission', label: '权限管理' },
        { id: 'user-role-management', label: '角色分配' },
      ],
    },
    {
      id: 'org',
      label: '组织架构',
      children: [
        { id: 'org-department', label: '部门管理' },
        { id: 'org-position', label: '职位管理' },
      ],
    },
    {
      id: 'permission',
      label: '权限管理',
      children: [
        { id: 'user-permission', label: '权限管理' },
        { id: 'user-role-management', label: '角色分配' },
        { id: 'user-reset-password', label: '重置密码' },
        { id: 'system-logs', label: '操作日志' },
      ],
    },
    {
      id: 'messaging',
      label: '办公协作', // Renamed from '信息系统' to match user perception if needed, or keep '信息系统'
      children: [
        { id: 'messaging-chat', label: '聊天系统' },
        { id: 'messaging-create-group', label: '群组管理' },
        { id: 'messaging-broadcast', label: '系统广播' },
        { id: 'broadcast-management', label: '发布广播' },
        { id: 'notification-settings', label: '通知设置' },
        { id: 'employee-memos', label: '部门备忘录' },
      ],
    },
    {
      id: 'attendance',
      label: '考勤管理',
      children: [
        { id: 'attendance-home', label: '考勤主页' },
        { id: 'attendance-records', label: '考勤记录' },
        { id: 'attendance-makeup', label: '补卡申请' },
        { id: 'attendance-leave-apply', label: '请假申请' },
        { id: 'attendance-leave-records', label: '请假记录' },
        { id: 'attendance-overtime-apply', label: '加班申请' },
        { id: 'attendance-overtime-records', label: '加班记录' },
        { id: 'attendance-stats', label: '考勤统计' },
        { id: 'attendance-department', label: '部门考勤统计' },
        { id: 'attendance-shift', label: '班次管理' },
        { id: 'attendance-schedule', label: '排班管理' },
        { id: 'attendance-smart-schedule', label: '智能排班' },
        { id: 'attendance-approval', label: '审批管理' },
        { id: 'attendance-notifications', label: '考勤通知' },
        { id: 'attendance-settings', label: '考勤设置' },
      ],
    },
    {
      id: 'vacation',
      label: '假期管理',
      children: [
        { id: 'compensatory-apply', label: '申请调休' },
        { id: 'vacation-details', label: '假期明细' },
        { id: 'quota-config', label: '额度配置' },
        { id: 'vacation-summary', label: '假期汇总' },
        { id: 'compensatory-approval', label: '调休审批' },
        { id: 'vacation-permissions', label: '假期权限' },
      ],
    },
    {
      id: 'payroll',
      label: '工资管理',
      children: [
        { id: 'my-payslips', label: '我的工资条' },
        { id: 'payslip-management', label: '工资条管理' },
      ],
    },
    {
      id: 'reimbursement',
      label: '报销管理',
      children: [
        { id: 'reimbursement-apply', label: '新建报销' },
        { id: 'reimbursement-list', label: '我的报销' },
        { id: 'reimbursement-approval', label: '报销审批' },
        { id: 'approval-workflow-config', label: '流程配置' },
        { id: 'approver-management', label: '审批人管理' },
        { id: 'reimbursement-settings', label: '报销设置' },
      ],
    },
    {
      id: 'quality',
      label: '质检管理',
      children: [
        { id: 'quality-platform-shop', label: '平台店铺' },
        { id: 'quality-score', label: '会话质检' },
        { id: 'quality-tags', label: '标签管理' },
        { id: 'quality-case-library', label: '案例库' },
        { id: 'quality-case-categories', label: '案例分类管理' },
        { id: 'quality-recommendation', label: '案例推荐' },
      ],
    },
    {
      id: 'knowledge',
      label: '知识库',
      children: [
        { id: 'knowledge-articles', label: '公共知识库' },
        { id: 'knowledge-base', label: '知识库' },
        { id: 'my-knowledge', label: '我的知识库' },
        { id: 'knowledge-articles-win11', label: '知识库' },
        { id: 'my-knowledge-win11', label: '我的知识库' },
      ],
    },
    {
      id: 'assessment',
      label: '考核系统',
      children: [
        { id: 'assessment-exams', label: '试卷管理' },
        { id: 'exam-plans', label: '考核计划' },
        { id: 'assessment-categories', label: '分类管理' },
        { id: 'exam-results', label: '考试结果' },
        { id: 'my-exams', label: '我的考试' },
        { id: 'my-exam-results', label: '我的考试结果' },
        { id: 'assessment-management', label: '考核管理' },
      ],
    },
    {
      id: 'personal',
      label: '个人中心',
      children: [
        { id: 'personal-info', label: '个人信息' },
        { id: 'my-todo', label: '待办中心' },
        { id: 'my-schedule', label: '我的排班' },
        { id: 'my-notifications', label: '我的通知' },
        { id: 'my-memos', label: '我的备忘录' },
      ],
    },
  ];

  const breadcrumbs = useMemo(() => {
    const tabName = activeTab?.name || activeTab;
    if (!tabName) return [];

    // 递归查找面包屑路径
    const findBreadcrumbsPath = (items, targetId, path = []) => {
      for (const item of items) {
        const currentPath = [...path, { label: item.label, id: item.id }];
        if (item.id === targetId) return currentPath;
        if (item.children) {
          const result = findBreadcrumbsPath(item.children, targetId, currentPath);
          if (result) return result;
        }
      }
      return null;
    };

    // 先从 menuItems 中查找
    const path = findBreadcrumbsPath(menuItems, tabName);
    if (path) return path;

    // 如果 menuItems 没找到，处理特殊页面逻辑
    
    // 特殊页面处理：报销详情
    if (tabName === 'reimbursement-detail') {
      return [
        { label: '报销管理', id: 'reimbursement' },
        { label: '报销详情', id: 'reimbursement-detail' }
      ];
    }

    // 特殊页面处理：资产流程定义 (系统原名为全域流程设置，现已更名)
    if (tabName === 'system-workflow') {
      return [
        { label: '财务管理', id: 'finance' },
        { label: '审批架构', id: 'finance-config' },
        { label: '资产流程定义', id: 'system-workflow' }
      ];
    }

    if (tabName === 'approval-workflow-config') {
        return [
          { label: '财务管理', id: 'finance' },
          { label: '审批架构', id: 'finance-config' },
          { label: '报销流程定义', id: 'approval-workflow-config' }
        ];
    }

    // 特殊页面处理：审批职责授权 (原审批角色映射)
    if (tabName === 'role-workflow-config') {
      return [
        { label: '财务管理', id: 'finance' },
        { label: '审批架构', id: 'finance-config' },
        { label: '审批职责授权', id: 'role-workflow-config' }
      ];
    }

    // 特殊页面处理：设备管理
    if (tabName === 'logistics-device-mgmt') {
      return [
        { label: '后勤管理', id: 'logistics' },
        { label: '设备管理', id: 'logistics-devices' },
        { label: '设备管理', id: 'logistics-device-mgmt' }
      ];
    }

    // 特殊页面处理：实机明细
    if (tabName === 'logistics-device-list') {
      return [
        { label: '后勤管理', id: 'logistics' },
        { label: '设备管理', id: 'logistics-devices' },
        { label: '实机明细', id: 'logistics-device-list' }
      ];
    }

    // 特殊页面处理：资产申请审批
    if (tabName === 'asset-request-audit') {
      return [
        { label: '后勤管理', id: 'logistics' },
        { label: '设备管理', id: 'logistics-devices' },
        { label: '审批中心', id: 'asset-request-audit' }
      ];
    }

    // 特殊页面处理：部门考勤报表
    if (tabName === 'attendance-dept-stats') {
      return [
        { label: '考勤管理', id: 'attendance' },
        { label: '部门考勤报表', id: 'attendance-dept-stats' }
      ];
    }

    return [];
  }, [activeTab]);

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
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-[1000] shadow-sm">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <HomeOutlined className="text-gray-400" />
          <span className="text-gray-400">/</span>
        </div>
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.id}>
            <span className={`mx-2 ${index === breadcrumbs.length - 1 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
              {item.label}
            </span>
            {index < breadcrumbs.length - 1 && (
              <span className="text-gray-400">/</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Center: Live Broadcast Ticker (性能与交互优化) */}
      <div className="flex-1 max-w-2xl mx-8">
        {latestBroadcast && (
          <div 
            onClick={() => {
              onNavigate('messaging-broadcast');
              setLatestBroadcast(null); // 点击后立即消失
            }}
            className={`flex items-center gap-3 px-5 py-2 rounded-xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] animate-in slide-in-from-top-4 duration-500 ${
              latestBroadcast.type === 'warning' || latestBroadcast.priority === 'urgent' 
                ? 'bg-rose-500 text-white border-none shadow-[0_0_20px_rgba(244,63,94,0.4)]' 
                : 'bg-indigo-600 text-white border-none shadow-[0_0_20px_rgba(79,70,229,0.4)]'
            }`}
          >
            <div className="animate-pulse flex items-center">
              <ExclamationCircleOutlined className="text-base shadow-sm" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider truncate flex-1">
              {latestBroadcast.priority === 'urgent' ? '🚨 紧急公告：' : '📢 系统广播：'}
              <span className="font-bold ml-2 normal-case text-sm tracking-normal">{latestBroadcast.title}</span>
            </span>
            <div className="h-4 w-px bg-white/20 mx-1" />
            <CloseOutlined 
              className="text-xs opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded-md" 
              onClick={(e) => {
                e.stopPropagation();
                setLatestBroadcast(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Right: User Info & Logout */}
      <div className="flex items-center gap-6">
        {/* Zoom Control */}
        <div className="flex items-center">
            <Popover
                content={
                    <div className="w-48 p-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>75%</span>
                            <span>{zoomLevel}%</span>
                            <span>100%</span>
                        </div>
                        <Slider
                            min={75}
                            max={100}
                            value={zoomLevel}
                            onChange={(value) => onZoomChange && onZoomChange(value)}
                        />
                    </div>
                }
                title={<span className="text-sm font-medium">界面缩放</span>}
                trigger="click"
                placement="bottom"
            >
                <div
                    className="cursor-pointer text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1"
                    title="调整界面大小"
                >
                    <FontSizeOutlined className="text-lg" />
                    <span className="text-xs font-medium">{zoomLevel}%</span>
                </div>
            </Popover>
        </div>

        <div className="h-8 w-px bg-gray-200"></div>
        {/* 未读通知 */}
        <div className="relative">
          <div
            className="relative cursor-pointer hover:opacity-80 transition-opacity"
            title="通知"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <BellOutlined className="text-gray-600 text-xl" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {showNotifications && (
            <NotificationDropdown
              onClose={() => setShowNotifications(false)}
              onNavigate={onNavigate}
              onUpdateUnread={onUpdateUnread}
            />
          )}
        </div>

        <div className="h-8 w-px bg-gray-200"></div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
            {user?.real_name?.charAt(0) || <UserOutlined />}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-lg font-bold text-gray-900">{user?.real_name || '用户'}</span>
          </div>
        </div>

        <div className="h-8 w-px bg-gray-200"></div>

        <button
          onClick={handleLogoutClick} // 修改为新的处理函数
          className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition-colors text-sm"
          title="退出登录"
        >
          <LogoutOutlined />
          <span>退出</span>
        </button>
      </div>
    </div>
  );
};

export default TopNavbar;
