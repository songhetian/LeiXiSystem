import logger from '@/utils/logger';
import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster, toast } from 'sonner'
import { showNotificationToast } from './utils/notificationUtils';
import './styles/sonner-toast.css'
import { useTokenVerification } from './hooks/useTokenVerification'
import { tokenManager, apiGet, apiPost } from './utils/apiClient'
import { getApiUrl } from './utils/apiConfig'
import Sidebar from './components/Sidebar'
import TopNavbar from './components/TopNavbar'
import ErrorBoundary from './components/ErrorBoundary'
import DatabaseCheck from './components/DatabaseCheck'
import { PermissionProvider } from './contexts/PermissionContext'
import { wsManager } from './services/websocket'
import { soundManager } from './utils/soundManager'
import { useChatStore } from './hooks/useChatStore'

// 路由懒加载
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'))
const AdminDashboard = lazy(() => import('./pages/Dashboard/AdminDashboard'))
const PersonnelManagement = lazy(() => import('./components/EmployeeManagement'))
const PositionManagement = lazy(() => import('./components/PositionManagement'))
const DepartmentManagement = lazy(() => import('./components/DepartmentManagement'))
const AttendanceHome = lazy(() => import('./pages/Attendance/AttendanceHome'))
const AttendanceSettings = lazy(() => import('./pages/Attendance/AttendanceSettings'))
const AttendanceStats = lazy(() => import('./pages/Attendance/AttendanceStats'))
const AttendanceAuditHub = lazy(() => import('./pages/Attendance/AttendanceAuditHub'))
const SchedulingHub = lazy(() => import('./pages/Attendance/SchedulingHub'))
const MyAttendanceHub = lazy(() => import('./pages/Attendance/MyAttendanceHub'))
const SmartSchedule = lazy(() => import('./pages/Attendance/SmartSchedule'))
const VacationManagementHub = lazy(() => import('./pages/Personal/VacationManagementHub'))
const VacationSelfServiceHub = lazy(() => import('./pages/Personal/VacationSelfServiceHub'))
const AssetManagement = lazy(() => import('./pages/Finance/Assets/AssetManagement'))
const InventoryManagement = lazy(() => import('./pages/Finance/Inventory/InventoryManagement'))
const MyAssets = lazy(() => import('./pages/Personal/MyAssets'))
const ReimbursementApply = lazy(() => import('./components/ReimbursementApply'))
const ReimbursementList = lazy(() => import('./components/ReimbursementList'))
const ReimbursementApproval = lazy(() => import('./components/ReimbursementApproval'))
const ReimbursementSettings = lazy(() => import('./components/ReimbursementSettings'))
const WeChatPage = lazy(() => import('./pages/Messaging/WeChatPage'))
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase'))
const MyKnowledgeBase = lazy(() => import('./components/MyKnowledgeBase'))
const KnowledgeManagement = lazy(() => import('./components/KnowledgeManagement'))
const ExamManagement = lazy(() => import('./components/ExamManagement'))
const MyExams = lazy(() => import('./components/MyExams'))
const MyExamResults = lazy(() => import('./components/MyExamResults'))
const ExamTaking = lazy(() => import('./components/ExamTaking'))
const AssessmentPlanManagement = lazy(() => import('./components/AssessmentPlanManagement'))
const ExamResultsManagement = lazy(() => import('./components/ExamResultsManagement'))
const MyMemos = lazy(() => import('./pages/Personal/MyMemos'))
const TodoCenter = lazy(() => import('./pages/Personal/TodoCenter'))
const MyPayslips = lazy(() => import('./pages/Payroll/MyPayslips'))
const PayslipManagement = lazy(() => import('./pages/Payroll/PayslipManagement'))
const UserRoleManagement = lazy(() => import('./pages/System/UserRoleManagement'))
const RoleManagement = lazy(() => import('./pages/System/RoleManagement'))
const WorkflowSettings = lazy(() => import('./pages/System/WorkflowSettings'))
const OperationLogs = lazy(() => import('./pages/System/OperationLogs'))
const QualityInspection = lazy(() => import('./components/QualityInspection'))
const QualityReportPage = lazy(() => import('./pages/QualityReportPage'))
const CaseLibraryPage = lazy(() => import('./pages/CaseLibraryPage'))
const CaseRecommendationPage = lazy(() => import('./pages/CaseRecommendationPage'))
const QualityStatisticsPage = lazy(() => import('./pages/QualityStatisticsPage'))
const QualityRuleManagementPage = lazy(() => import('./pages/QualityRuleManagementPage'))
const ExamResult = lazy(() => import('./pages/Assessment/ExamResult'))
const UnreadMemoPopup = lazy(() => import('./components/UnreadMemoPopup'))

// 员工与个人信息相关
const EmployeeChanges = lazy(() => import('./components/EmployeeChanges'))
const EmployeeApproval = lazy(() => import('./components/EmployeeApproval'))
const PersonalInfo = lazy(() => import('./components/PersonalInfo'))
const ResetPassword = lazy(() => import('./components/ResetPassword'))

// 管理与审批相关
const BroadcastManagement = lazy(() => import('./pages/Admin/BroadcastManagement'))
const AssetRequestAudit = lazy(() => import('./pages/Finance/Assets/AssetRequestAudit'))
const GroupManagement = lazy(() => import('./pages/Messaging/GroupManagement'))
const DeviceList = lazy(() => import('./pages/Logistics/DeviceList'))

// 新增缺失组件的懒加载
const MyNotifications = lazy(() => import('./pages/Personal/MyNotifications'))
const NotificationSettings = lazy(() => import('./components/NotificationSettings'))
const EmployeeMemos = lazy(() => import('./pages/Employee/EmployeeMemos'))
const CompensatoryApproval = lazy(() => import('./components/CompensatoryApproval'))
const ApproverManagement = lazy(() => import('./components/ApproverManagement'))
const ApprovalWorkflowConfig = lazy(() => import('./components/ApprovalWorkflowConfig'))
const RoleWorkflowConfig = lazy(() => import('./components/RoleWorkflowConfig'))
const MySchedule = lazy(() => import('./pages/Personal/MySchedule'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState({ name: 'dashboard', label: '仪表盘' })
  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [systemNotificationEnabled, setSystemNotificationEnabled] = useState(true)
  const [totalUnreadCount, setTotalUnreadCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showMemoPopup, setShowMemoPopup] = useState(false)

  // 0. 从 ChatStore 获取消息处理方法
  const handleNewMessage = useChatStore(state => state.handleNewMessage)

  // 1. handleLogout 必须定义在最前面 (由于其他函数和 Effect 会依赖它)
  const handleLogout = React.useCallback(async (reason = 'manual') => {
    logger.warn(`🛑 [App] handleLogout 被调用！原因: ${reason}`);

    // 如果是被踢下线，不需要调用后端 logout (因为后端 Session 已经由踢人者清理或更新)
    if (reason !== 'kicked_out' && reason !== 'kicked_out_timeout' && reason !== 'kicked_out_heartbeat') {
      try {
        await apiPost('/api/auth/logout', {});
      } catch (error) {
        logger.warn('退出登录API调用失败(可能由于Token已失效):', error.message);
      }
    }

    tokenManager.clearTokens();
    localStorage.removeItem('user');
    localStorage.removeItem('activeTab');
    
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('attendance_') || key.startsWith('exam_') || key.startsWith('cache_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    setIsLoggedIn(false);
    setUser(null);
    wsManager.disconnect();
    
    if (reason !== 'kicked_out' && reason !== 'kicked_out_timeout' && reason !== 'kicked_out_heartbeat') {
      toast.info('已安全退出登录');
    }
  }, []);

  const handleSetActiveTab = React.useCallback((tab) => {
    // 统一处理逻辑：支持传对象 {name, label} 或 直接传字符串 id
    if (typeof tab === 'string') {
      const tabMap = {
        'dashboard': '仪表盘',
        'admin-dashboard': '企业看板',
        'user-employee': '员工管理',
        'user-changes': '变动记录',
        'user-approval': '员工审核',
        'org-department': '部门管理',
        'org-position': '职位管理',
        'user-permission': '权限管理',
        'user-role-management': '角色分配',
        'user-reset-password': '重置密码',
        'system-logs': '操作日志',
        'messaging-broadcast': '系统广播',
        'broadcast-management': '发布广播',
        'notification-settings': '通知设置',
        'messaging-chat': '即时通讯',
        'messaging-group-management': '群组管理',
        'employee-memos': '部门备忘录',
        'attendance-home': '考勤中心',
        'attendance-dept-stats': '考勤报表',
        'attendance-shift': '班次管理',
        'attendance-schedule': '调度中心',
        'attendance-approval': '审计配置',
        'knowledge-articles': '公共知识库',
        'knowledge-base': '知识库管理',
        'my-knowledge': '我的知识库',
        'vacation-details': '假期中心',
        'compensatory-approval': '假期审计',
        'reimbursement-apply': '新建报销',
        'reimbursement-list': '我的报销',
        'reimbursement-approval': '报销审批',
        'approver-management': '审批人管理',
        'reimbursement-settings': '报销配置',
        'payslip-management': '工资条管理',
        'system-workflow': '资产流程',
        'approval-workflow-config': '报销流程',
        'role-workflow-config': '职责授权',
        'logistics-device-mgmt': '设备管理',
        'logistics-device-list': '实机明细',
        'asset-request-audit': '申请审批',
        'inventory-management': '库存管理',
        'personal-info': '个人信息',
        'my-todo': '待办中心',
        'my-schedule': '我的排班',
        'my-notifications': '我的通知',
        'my-payslips': '我的薪资',
        'my-assets': '个人资产',
        'my-memos': '我的备忘录',
        'quality-inspection': '质量检查',
        'quality-report': '质检报表',
        'case-library': '案例库',
        'case-recommendation': '案例推荐',
        'quality-statistics': '质检统计',
        'quality-rules': '质检规则',
        'my-exams': '我的考试',
        'my-results': '我的成绩',
        'exam-management': '考试管理',
        'assessment-plans': '考核计划',
        'exam-results-management': '成绩管理',
        'exam-taking': '答题中',
        'exam-result': '考试结果'
      };
      setActiveTab({ name: tab, label: tabMap[tab] || tab });
    } else if (tab && tab.name) {
      setActiveTab(tab);
    }
  }, []);

  const checkUnreadMemos = async () => {
    try {
      const response = await fetch(getApiUrl('/api/memos/unread-count'), {
        headers: { 'Authorization': `Bearer ${tokenManager.getToken()}` }
      });
      const data = await response.json();
      if (data.success && data.count > 0) {
        setTimeout(() => setShowMemoPopup(true), 1000);
      }
    } catch (e) {}
  };

  const checkUnreadNotifications = async () => {
    try {
      const u = localStorage.getItem('user');
      if (!u) return;
      const userId = JSON.parse(u).id;
      const response = await fetch(getApiUrl(`/api/notifications/unread-count?userId=${userId}`), {
        headers: { 'Authorization': `Bearer ${tokenManager.getToken()}` }
      });
      const data = await response.json();
      if (data.success) setUnreadCount(data.count || 0);
    } catch (e) {}
  };

  // WebSocket 与心跳逻辑
  useEffect(() => {
    if (!isLoggedIn || !user) return;

    // A. 定时心跳校验
    const sessionHeartbeat = setInterval(async () => {
      try {
        await apiGet('/api/auth/permissions');
      } catch (error) {
        if (error.response?.status === 401 || error.status === 401) {
          logger.error('🚨 [Auth] 心跳校验发现 Token 已失效');
          handleLogout('kicked_out_heartbeat');
          toast.error('登录已失效', { description: '您的账号已在其他设备登录', duration: 10000 });
        }
      }
    }, 60000);

    // B. 事件处理器
    const handleNotification = (notification) => {
      logger.debug('🔔 收到新通知:', notification)
      soundManager.playNotification()
      showNotificationToast(notification, {
        onClick: () => {
          if (notification.related_id || notification.related_type) {
            if (['leave_apply', 'overtime_apply', 'makeup_apply'].includes(notification.type) || 
                ['leave_approval', 'leave_rejection', 'overtime_approval', 'overtime_rejection', 'makeup_approval', 'makeup_rejection'].includes(notification.type)) {
              handleSetActiveTab('attendance-approval');
            } else if (notification.type === 'system_broadcast') {
              handleSetActiveTab('messaging-broadcast');
            } else if (notification.type === 'new_assessment_plan') {
              handleSetActiveTab('my-exams');
            } else if (notification.type === 'payslip') {
              handleSetActiveTab('my-payslips');
            }
          }
        }
      })
      setUnreadCount(prev => prev + 1)
    };

    const handleKickedOut = (data) => {
      logger.warn('🚨 [Auth] 收到下线指令:', data.message);
      wsManager.disconnect();
      toast.error('登录失效', {
        description: data.message || '您的账号已在另一台设备登录，当前连接已断开',
        duration: 10000,
        action: { label: '立即重新登录', onClick: () => handleLogout('kicked_out') },
        onAutoClose: () => handleLogout('kicked_out')
      });
      setTimeout(() => handleLogout('kicked_out_timeout'), 5000);
    };

    const handleGlobalChatMessage = (msg) => {
      handleNewMessage(msg, user?.id);
      if (activeTab.name !== 'messaging-chat' && String(msg.sender_id) !== String(user?.id)) {
        if (notificationEnabled) {
          toast(msg.sender_name || '新消息', {
            description: msg.msg_type === 'text' ? msg.content : '[图片/文件]',
            action: { label: '查看', onClick: () => handleSetActiveTab('messaging-chat') },
            duration: 5000
          });
        }
      }
    };

    wsManager.on('notification', handleNotification)
    wsManager.on('memo', (m) => { soundManager.playSuccess(); toast.success('新备忘录', { description: m.title }); checkUnreadMemos(); })
    wsManager.on('broadcast', (b) => { soundManager.playNotification(); setUnreadCount(prev => prev + 1); })
    wsManager.on('kicked_out', handleKickedOut)
    wsManager.on('chat_message', handleGlobalChatMessage)
    wsManager.on('unread_count', (data) => setUnreadCount(data.count))

    checkUnreadMemos()
    checkUnreadNotifications()

    return () => {
      clearInterval(sessionHeartbeat);
      wsManager.off('chat_message', handleGlobalChatMessage);
      wsManager.removeAllListeners('notification');
      wsManager.removeAllListeners('memo');
      wsManager.removeAllListeners('broadcast');
      wsManager.removeAllListeners('unread_count');
      wsManager.removeAllListeners('kicked_out');
    };
  }, [isLoggedIn, user?.id, handleLogout, activeTab.name]);

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setIsLoggedIn(true)
        setUser(userData)
        setTimeout(() => {
          wsManager.connect({ avatar: userData?.avatar });
          soundManager.init();
        }, 0);
      } catch (e) { handleLogout('invalid_storage'); }
    }
  }, [handleLogout]);

  const handleLoginSuccess = (userData, token) => {
    logger.debug('🎉 handleLoginSuccess 触发，准备初始化...');
    
    // 1. 立即同步状态
    setIsLoggedIn(true);
    setUser(userData);
    
    // 2. 如果传了 Token (来自 Login.jsx)，确保立即写入，防止后续请求 401
    if (token) {
      localStorage.setItem('token', token);
    }

    // 3. 异步启动 Socket，显式传递最新 Token
    setTimeout(() => {
      wsManager.connect({ 
        avatar: userData?.avatar,
        token: token || localStorage.getItem('token')
      });
      soundManager.init();
      
      // 4. 初始化业务数据
      checkUnreadMemos();
      checkUnreadNotifications();
    }, 100);
  }

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <DatabaseCheck>
          <Suspense fallback={null}>
            <Login onLoginSuccess={handleLoginSuccess} />
          </Suspense>
        </DatabaseCheck>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <DatabaseCheck>
        <PermissionProvider>
          <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} />
            <div className="flex-1 flex flex-col min-w-0 relative">
              <TopNavbar 
                user={user} 
                onLogout={() => handleLogout('manual')} 
                activeTab={activeTab}
                unreadCount={unreadCount}
              />
              <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <Suspense fallback={<div className="flex items-center justify-center h-full">资源加载中...</div>}>
                  {activeTab.name === 'dashboard' && (user?.role === '超级管理员' || user?.role === 'admin' ? <AdminDashboard onNavigate={handleSetActiveTab} /> : <Dashboard onNavigate={handleSetActiveTab} />)}
                  {activeTab.name === 'admin-dashboard' && <AdminDashboard onNavigate={handleSetActiveTab} />}
                  
                  {/* 人事管理 */}
                  {activeTab.name === 'user-employee' && <PersonnelManagement />}
                  {activeTab.name === 'user-changes' && <EmployeeChanges />}
                  {activeTab.name === 'user-approval' && <EmployeeApproval />}
                  {activeTab.name === 'org-department' && <DepartmentManagement />}
                  {activeTab.name === 'org-position' && <PositionManagement />}
                  
                  {/* 权限管理 */}
                  {activeTab.name === 'user-permission' && <RoleManagement />}
                  {activeTab.name === 'user-role-management' && <UserRoleManagement />}
                  {activeTab.name === 'user-reset-password' && <ResetPassword />}
                  {activeTab.name === 'system-logs' && <OperationLogs />}
                  
                  {/* 协作/消息 */}
                  {activeTab.name === 'messaging-broadcast' && <MyNotifications />}
                  {activeTab.name === 'broadcast-management' && <BroadcastManagement />}
                  {activeTab.name === 'notification-settings' && <NotificationSettings />}
                  {activeTab.name === 'messaging-chat' && <WeChatPage />}
                  {activeTab.name === 'messaging-group-management' && <GroupManagement />}
                  {activeTab.name === 'employee-memos' && <EmployeeMemos />}
                  
                  {/* 考勤管理 */}
                  {activeTab.name === 'attendance-home' && <AttendanceHome onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'attendance-dept-stats' && <AttendanceStats />}
                  {activeTab.name === 'attendance-shift' && <AttendanceSettings />}
                  {activeTab.name === 'attendance-schedule' && <SchedulingHub />}
                  {activeTab.name === 'attendance-approval' && <AttendanceAuditHub />}
                  
                  {/* 知识库 */}
                  {activeTab.name === 'knowledge-articles' && <KnowledgeBase />}
                  {activeTab.name === 'knowledge-base' && <KnowledgeManagement />}
                  {activeTab.name === 'my-knowledge' && <MyKnowledgeBase />}
                  
                  {/* 假期管理 */}
                  {activeTab.name === 'vacation-details' && <VacationManagementHub />}
                  {activeTab.name === 'compensatory-approval' && <CompensatoryApproval />}
                  
                  {/* 财务管理 */}
                  {activeTab.name === 'reimbursement-apply' && <ReimbursementApply />}
                  {activeTab.name === 'reimbursement-list' && <ReimbursementList />}
                  {activeTab.name === 'reimbursement-approval' && <ReimbursementApproval />}
                  {activeTab.name === 'approver-management' && <ApproverManagement />}
                  {activeTab.name === 'reimbursement-settings' && <ReimbursementSettings />}
                  {activeTab.name === 'payslip-management' && <PayslipManagement />}
                  {activeTab.name === 'system-workflow' && <WorkflowSettings />}
                  {activeTab.name === 'approval-workflow-config' && <ApprovalWorkflowConfig />}
                  {activeTab.name === 'role-workflow-config' && <RoleWorkflowConfig />}
                  
                  {/* 后勤管理 */}
                  {activeTab.name === 'logistics-device-mgmt' && <AssetManagement />}
                  {activeTab.name === 'logistics-device-list' && <DeviceList />}
                  {activeTab.name === 'asset-request-audit' && <AssetRequestAudit />}
                  {activeTab.name === 'inventory-management' && <InventoryManagement />}
                  
                  {/* 个人中心 */}
                  {activeTab.name === 'personal-info' && <PersonalInfo />}
                  {activeTab.name === 'my-todo' && <TodoCenter />}
                  {activeTab.name === 'my-schedule' && <MySchedule />}
                  {activeTab.name === 'my-notifications' && <MyNotifications />}
                  {activeTab.name === 'my-payslips' && <MyPayslips />}
                  {activeTab.name === 'my-assets' && <MyAssets />}
                  {activeTab.name === 'my-memos' && <MyMemos />}
                  
                  {/* 质检 (兼容旧 ID) */}
                  {activeTab.name === 'quality-inspection' && <QualityInspection />}
                  {activeTab.name === 'quality-report' && <QualityReportPage />}
                  {activeTab.name === 'case-library' && <CaseLibraryPage />}
                  {activeTab.name === 'case-recommendation' && <CaseRecommendationPage />}
                  {activeTab.name === 'quality-statistics' && <QualityStatisticsPage />}
                  {activeTab.name === 'quality-rules' && <QualityRuleManagementPage />}
                  
                  {/* 考试 (兼容旧 ID) */}
                  {activeTab.name === 'my-exams' && <MyExams />}
                  {activeTab.name === 'my-results' && <MyExamResults />}
                  {activeTab.name === 'exam-management' && <ExamManagement />}
                  {activeTab.name === 'assessment-plans' && <AssessmentPlanManagement />}
                  {activeTab.name === 'exam-results-management' && <ExamResultsManagement />}
                  {activeTab.name === 'exam-taking' && <ExamTaking onBack={() => setActiveTab({ name: 'my-exams', label: '我的考试' })} />}
                  {activeTab.name === 'exam-result' && <ExamResult />}

                  {/* 404 兜底：如果以上所有 ID 均未匹配，则显示 NotFound 页面 */}
                  {!['dashboard', 'admin-dashboard', 'user-employee', 'user-changes', 'user-approval', 'org-department', 'org-position', 
                    'user-permission', 'user-role-management', 'user-reset-password', 'system-logs', 
                    'messaging-broadcast', 'broadcast-management', 'notification-settings', 'messaging-chat', 'messaging-group-management', 'employee-memos',
                    'attendance-home', 'attendance-dept-stats', 'attendance-shift', 'attendance-schedule', 'attendance-approval',
                    'knowledge-articles', 'knowledge-base', 'my-knowledge',
                    'vacation-details', 'compensatory-approval',
                    'reimbursement-apply', 'reimbursement-list', 'reimbursement-approval', 'approver-management', 'reimbursement-settings', 'payslip-management', 
                    'system-workflow', 'approval-workflow-config', 'role-workflow-config',
                    'logistics-device-mgmt', 'logistics-device-list', 'asset-request-audit', 'inventory-management',
                    'personal-info', 'my-todo', 'my-schedule', 'my-notifications', 'my-payslips', 'my-assets', 'my-memos',
                    'quality-inspection', 'quality-report', 'case-library', 'case-recommendation', 'quality-statistics', 'quality-rules',
                    'my-exams', 'my-results', 'exam-management', 'assessment-plans', 'exam-results-management', 'exam-taking', 'exam-result'
                  ].includes(activeTab.name) && <NotFound onBack={handleSetActiveTab} />}
                </Suspense>
              </main>
            </div>
            {showMemoPopup && (
              <Suspense fallback={null}>
                <UnreadMemoPopup onClose={() => setShowMemoPopup(false)} />
              </Suspense>
            )}
          </div>
        </PermissionProvider>
      </DatabaseCheck>
      <Toaster position="top-center" richColors closeButton />
    </ErrorBoundary>
  )
}

export default App
