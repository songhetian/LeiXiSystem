import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Toaster, toast } from 'sonner'
import { showNotificationToast } from './utils/notificationUtils';
import './styles/sonner-toast.css'
import { useTokenVerification } from './hooks/useTokenVerification'
import { getApiUrl } from './utils/apiConfig'
import { tokenManager, apiPost } from './utils/apiClient'
import { clearPermissions } from './utils/permission'
import { Spin } from 'antd'; // Import Spin for fallback
import ErrorBoundary from './components/ErrorBoundary'
import NotFound from './pages/NotFound'
import { wsManager } from './services/websocket'
import { soundManager } from './utils/soundManager'
import { PermissionProvider, usePermission } from './contexts/PermissionContext'

// Lazy-loaded components
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/Dashboard/AdminDashboard'));
const Sidebar = lazy(() => import('./components/Sidebar'));
const CustomerList = lazy(() => import('./components/CustomerList'));
const SessionManagement = lazy(() => import('./components/SessionManagement'));
const QualityInspection = lazy(() => import('./components/QualityInspection'));
const DepartmentManagement = lazy(() => import('./components/DepartmentManagement'));
const PositionManagement = lazy(() => import('./components/PositionManagement'));
const EmployeeManagement = lazy(() => import('./components/EmployeeManagement'));
const EmployeeChanges = lazy(() => import('./components/EmployeeChanges'));
const EmployeeApproval = lazy(() => import('./components/EmployeeApproval'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const RoleManagement = lazy(() => import('./pages/System/RoleManagement'));
const UserRoleManagement = lazy(() => import('./pages/System/UserRoleManagement'));
const OperationLogs = lazy(() => import('./pages/System/OperationLogs'));
const KnowledgeManagement = lazy(() => import('./components/KnowledgeManagement'));
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase'));
const KnowledgeFolderView = lazy(() => import('./components/KnowledgeFolderView'));
const MyKnowledgeBase = lazy(() => import('./components/MyKnowledgeBase'));
const Win11KnowledgeBase = lazy(() => import('./components/Win11KnowledgeBase'));
const Win11MyKnowledgeBase = lazy(() => import('./components/Win11MyKnowledgeBase'));
const Win11KnowledgeFolderView = lazy(() => import('./components/Win11KnowledgeFolderView'));
const AssessmentManagement = lazy(() => import('./components/AssessmentManagement'));
const ExamManagement = lazy(() => import('./components/ExamManagement'));
const AssessmentPlanManagement = lazy(() => import('./components/AssessmentPlanManagement'));
const CategoryManagement = lazy(() => import('./components/CategoryManagement'));
const ExamResultsManagement = lazy(() => import('./components/ExamResultsManagement'));
const MyExamList = lazy(() => import('./components/MyExamList'));
const ExamTaking = lazy(() => import('./components/ExamTaking'));
const ExamResult = lazy(() => import('./components/ExamResult'));
const MyExams = lazy(() => import('./components/MyExams'));
const MyExamResults = lazy(() => import('./components/MyExamResults'));
const PersonalInfo = lazy(() => import('./components/PersonalInfo'));
const TodoCenter = lazy(() => import('./pages/Personal/TodoCenter'));
const MySchedule = lazy(() => import('./pages/Personal/MySchedule'));
const MyNotifications = lazy(() => import('./pages/Personal/MyNotifications'));
const MyMemos = lazy(() => import('./pages/Personal/MyMemos'));
const MyAssets = lazy(() => import('./pages/Personal/MyAssets'));
const EmployeeMemos = lazy(() => import('./pages/Employee/EmployeeMemos'));
const UnreadMemoPopup = lazy(() => import('./components/UnreadMemoPopup'));

const CaseLibraryPage = lazy(() => import('./pages/CaseLibraryPage'));
const CaseCategoryManagementPage = lazy(() => import('./pages/CaseCategoryManagementPage'));
const QualityRuleManagementPage = lazy(() => import('./pages/QualityRuleManagementPage'));
const QualityStatisticsPage = lazy(() => import('./pages/QualityStatisticsPage'));
const QualityReportPage = lazy(() => import('./pages/QualityReportPage'));
const CaseRecommendationPage = lazy(() => import('./pages/CaseRecommendationPage'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
const NotificationSender = lazy(() => import('./components/NotificationSender'));
const NotificationSettings = lazy(() => import('./components/NotificationSettings'));
const BroadcastManagement = lazy(() => import('./pages/Admin/BroadcastManagement'));
const WeChatPage = lazy(() => import('./pages/Messaging/WeChatPage'));
const GroupManagement = lazy(() => import('./pages/Messaging/GroupManagement'));
const WorkflowSettings = lazy(() => import('./pages/System/WorkflowSettings'));


const LeaveRecords = lazy(() => import('./pages/Attendance').then(module => ({ default: module.LeaveRecords })));
const OvertimeApply = lazy(() => import('./pages/Attendance').then(module => ({ default: module.OvertimeApply })));
const OvertimeRecords = lazy(() => import('./pages/Attendance').then(module => ({ default: module.OvertimeRecords })));
const MakeupApply = lazy(() => import('./pages/Attendance').then(module => ({ default: module.MakeupApply })));
const AttendanceStats = lazy(() => import('./pages/Attendance').then(module => ({ default: module.AttendanceStats })));
const DepartmentStats = lazy(() => import('./pages/Attendance').then(module => ({ default: module.DepartmentStats })));

const ShiftManagement = lazy(() => import('./pages/Attendance').then(module => ({ default: module.ShiftManagement })));
const ScheduleManagement = lazy(() => import('./pages/Attendance').then(module => ({ default: module.ScheduleManagement })));
const SmartSchedule = lazy(() => import('./pages/Attendance').then(module => ({ default: module.SmartSchedule })));
const ApprovalManagement = lazy(() => import('./pages/Attendance').then(module => ({ default: module.ApprovalManagement })));
const AttendanceSettings = lazy(() => import('./pages/Attendance').then(module => ({ default: module.AttendanceSettings })));
const CompensatoryApply = lazy(() => import('./components/CompensatoryApply'));
const VacationDetails = lazy(() => import('./components/VacationDetails'));
const VacationDetailsNew = lazy(() => import('./components/VacationDetailsNew'));
const VacationSummary = lazy(() => import('./components/VacationSummary'));
const CompensatoryApproval = lazy(() => import('./components/CompensatoryApproval'));
const VacationQuotaSettings = lazy(() => import('./components/VacationQuotaSettings'));
const VacationManagement = lazy(() => import('./components/VacationManagement'));
const QuotaConfigLayout = lazy(() => import('./components/QuotaConfigLayout'));
const VacationPermissions = lazy(() => import('./components/VacationPermissions'));
const AttendanceHome = lazy(() => import('./pages/Attendance').then(module => ({ default: module.AttendanceHome })));
const AttendanceRecords = lazy(() => import('./pages/Attendance').then(module => ({ default: module.AttendanceRecords })));
const LeaveApply = lazy(() => import('./pages/Attendance').then(module => ({ default: module.LeaveApply })));
const PlatformShopManagement = lazy(() => import('./components/PlatformShopManagement'));
const QualityTagManagement = lazy(() => import('./components/QualityTagManagement'));
const BroadcastList = lazy(() => import('./pages/Messaging').then(module => ({ default: module.BroadcastList })));

const MyPayslips = lazy(() => import('./pages/Payroll/MyPayslips'));
const PayslipManagement = lazy(() => import('./pages/Payroll/PayslipManagement'));

// Reimbursement components
const ReimbursementApply = lazy(() => import('./components/ReimbursementApply'));
const ReimbursementList = lazy(() => import('./components/ReimbursementList'));
const ReimbursementApproval = lazy(() => import('./components/ReimbursementApproval'));
const ReimbursementSettings = lazy(() => import('./components/ReimbursementSettings'));
const ReimbursementDetail = lazy(() => import('./components/ReimbursementDetail'));
const ApprovalWorkflowConfig = lazy(() => import('./components/ApprovalWorkflowConfig'));
const ApproverManagement = lazy(() => import('./components/ApproverManagement'));
const RoleWorkflowConfig = lazy(() => import('./components/RoleWorkflowConfig'));
const DeviceManagement = lazy(() => import('./pages/Finance/Assets/AssetManagement'));
const DeviceList = lazy(() => import('./pages/Logistics/DeviceList'));
const AssetRequestAudit = lazy(() => import('./pages/Finance/Assets/AssetRequestAudit'));
const InventoryManagement = lazy(() => import('./pages/Finance/Inventory/InventoryManagement'));

import DatabaseCheck from './components/DatabaseCheck';
import TopNavbar from './components/TopNavbar';

const originalToastSuccess = toast.success
toast.success = (message, options) => {
  const next = { ...(options || {}) }
  if (!next.position) next.position = 'top-center'
  return originalToastSuccess(message, next)
}

function App() {

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('activeTab');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return { name: 'dashboard', params: {} };
      }
    }
    return { name: 'dashboard', params: {} };
  });
  const [showMemoPopup, setShowMemoPopup] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0) // 未读通知数

  const [contentZoom, setContentZoom] = useState(() => {
    const saved = localStorage.getItem('contentZoom');
    return saved ? parseInt(saved) : 90;
  });

  const handleZoomChange = (value) => {
    setContentZoom(value);
    localStorage.setItem('contentZoom', value);
  };

  useEffect(() => {

    console.log('Current Active Tab:', activeTab);
  }, []);

  useEffect(() => {

  }, [activeTab]);

  useEffect(() => {
    // 检查本地存储的登录状态
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (token && savedUser) {
      setIsLoggedIn(true)
      setUser(JSON.parse(savedUser))
      // 登录后检查未读备忘录
      checkUnreadMemos()
      // 获取未读通知数
      checkUnreadNotifications()
      // 连接WebSocket
      connectWebSocket()
    }

    // 清理函数 - 不再断开WebSocket连接
    // return () => {
    //   wsManager.disconnect()
    // }
  }, [])

  // 连接WebSocket
  const connectWebSocket = () => {
    console.log('🔌 正在连接WebSocket...')
    // 使用setTimeout确保WebSocket连接不会阻塞主流程
    setTimeout(() => {
      wsManager.connect()
    }, 0)

    // 初始化声音管理器（需要用户交互后才能初始化AudioContext）
    soundManager.init()

    // 监听新通知
    const handleNotification = (notification) => {
      console.log('📨 收到新通知:', notification)
      // Debug: ensuring CSS updates are applied

      // 避免重复提醒：如果通知类型是 'memo' 或已由其他监听器处理，则忽略
      if (notification.type === 'memo' || notification.type === 'new_memo' ||
          notification.type === 'system_broadcast' || notification.type === 'broadcast') {
        return
      }

      // 🔔 播放提示音
      soundManager.playNotification()

      // 显示Toast提示
      toast.info(notification.title, {
        description: notification.content,
        duration: 5000,
        position: 'bottom-right',
        action: {
          label: '查看',
          onClick: () => {
            console.log('🔔 点击通知:', notification);
            // 根据通知类型跳转到相应页面
            if (['leave', 'overtime', 'makeup'].includes(notification.related_type) ||
                ['leave_approval', 'leave_rejection', 'overtime_approval', 'overtime_rejection', 'makeup_approval', 'makeup_rejection'].includes(notification.type)) {
              handleSetActiveTab('attendance-approval');
            } else if (notification.related_type === 'compensatory_leave' ||
                       ['compensatory_apply', 'compensatory_approval', 'compensatory_rejection'].includes(notification.type)) {
              // 跳转到调休申请审批页面
              handleSetActiveTab('compensatory-approval');
            } else if (notification.type === 'system_broadcast') {
              handleSetActiveTab('messaging-broadcast');
            } else if (notification.type === 'schedule_update' || notification.related_type === 'schedule') {
              handleSetActiveTab('my-schedule');
            } else if (notification.type === 'role_assignment' || notification.related_type === 'user_role') {
              handleSetActiveTab('user-role-management');
            } else if (notification.type === 'new_assessment_plan' || notification.type === 'assessment_plan' || notification.title?.includes('考核计划') || notification.content?.includes('考核计划')) {
              handleSetActiveTab('my-exams');
            } else if (notification.type === 'payslip' || notification.related_type === 'payslip' || notification.title?.includes('工资条') || notification.content?.includes('工资条')) {
              // 跳转到我的工资条页面
              handleSetActiveTab('my-payslips');
            } else if (notification.type?.startsWith('reimbursement') || notification.related_type === 'reimbursement') {
              // 跳转到报销审批页面
              handleSetActiveTab('reimbursement-approval');
            } else if (notification.type?.startsWith('asset') || notification.related_type === 'asset_request') {
              // 跳转到资产审批页面 (根据用户角色)
              const savedUser = localStorage.getItem('user');
              const role = savedUser ? JSON.parse(savedUser).role : '';
              if (role === '超级管理员' || role === 'admin') {
                  handleSetActiveTab('asset-request-audit');
              } else {
                  handleSetActiveTab('my-assets');
              }
            }
          }
        }
      })
      // 📊 更新未读数
      setUnreadCount(prev => prev + 1)
    }

    // 监听新备忘录
    const handleMemo = (memo) => {
      console.log('📝 收到新备忘录:', memo)

      // 🔔 播放成功提示音
      soundManager.playSuccess()

      toast.success('新备忘录', {
        description: memo.title,
        duration: 5000,
        position: 'bottom-right'
      })
      // 刷新备忘录未读数
      checkUnreadMemos()
    }

    // 监听系统广播
    const handleBroadcast = (broadcast) => {
      console.log('📣 [App.jsx] 收到系统广播事件:', broadcast)
      if (!broadcast) return;

      try {
        // 🔔 根据类型播放不同声音
        if (broadcast.type === 'warning' || broadcast.type === 'error') {
          soundManager.playWarning()
        } else {
          soundManager.playNotification()
        }
      } catch (e) {
        console.warn('播放声音失败:', e)
      }

      const typeConfig = {
        info: toast.info,
        warning: toast.warning,
        success: toast.success,
        error: toast.error,
        announcement: toast.info
      }
      
      const toastMethod = typeConfig[broadcast.type] || toast.info
      
      console.log('📣 准备显示广播Toast:', broadcast.title);
      
      toastMethod(broadcast.title || '系统广播', {
        description: broadcast.content,
        duration: 10000, // 广播停留时间长一点
        position: 'bottom-right',
        className: 'broadcast-toast',
        action: {
          label: '查看',
          onClick: () => handleSetActiveTab('messaging-broadcast')
        }
      })
    }

    // 监听下线指令
    const handleKickedOut = (data) => {
      console.log('🚨 账号被强制下线:', data.message)
      toast.error('登录失效', {
        description: data.message || '您的账号已被管理员强制下线',
        duration: null, // 永久显示直到用户点击
        action: {
          label: '确定',
          onClick: () => handleLogout()
        }
      })
      // 3秒后自动执行退出
      setTimeout(() => {
        handleLogout()
      }, 3000)
    }

    // 清除旧的监听器，防止重复注册
    wsManager.removeAllListeners('notification')
    wsManager.removeAllListeners('memo')
    wsManager.removeAllListeners('broadcast')
    wsManager.removeAllListeners('unread_count')
    wsManager.removeAllListeners('kicked_out')

    // 注册事件监听器
    wsManager.on('notification', handleNotification)
    wsManager.on('memo', handleMemo)
    wsManager.on('broadcast', handleBroadcast)
    wsManager.on('kicked_out', handleKickedOut)

    // 监听未读数更新
    wsManager.on('unread_count', (data) => {
      console.log('📊 收到未读数更新:', data.count)
      setUnreadCount(data.count)
    })
  }

  // 检查未读备忘录
  const checkUnreadMemos = async () => {
    try {
      const response = await fetch(getApiUrl('/api/memos/unread-count'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const data = await response.json()
      if (data.success && data.count > 0) {
        // 延迟1秒显示弹窗，避免与其他初始化冲突
        setTimeout(() => {
          setShowMemoPopup(true)
        }, 1000)
      }
    } catch (error) {
      console.error('检查未读备忘录失败:', error)
    }
  }

  // 检查未读通知数
  const checkUnreadNotifications = async () => {
    try {
      const savedUser = localStorage.getItem('user');
      const userId = savedUser ? JSON.parse(savedUser).id : null;
      if (!userId) return;

      const response = await fetch(getApiUrl(`/api/notifications/unread-count?userId=${userId}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setUnreadCount(data.count || 0)
        console.log('📊 初始未读通知数:', data.count)
      }
    } catch (error) {
      console.error('获取未读通知数失败:', error)
    }
  }


  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true)
    setUser(userData)
    // 登录成功后清除旧的权限缓存
    clearPermissions()
    // 登录成功后连接WebSocket，但不阻塞主流程
    Promise.resolve().then(() => {
      connectWebSocket()
      checkUnreadMemos()
      checkUnreadNotifications()
    })
  }

  const handleLogout = React.useCallback(async () => {
    // 调用后端API清除session
    try {
      await apiPost('/api/auth/logout', {})
    } catch (error) {
      console.error('退出登录API调用失败:', error)
      // 即使API调用失败，也继续清除本地存储
    }

    // 清除本地存储 - 更彻底的清理
    tokenManager.clearTokens()
    localStorage.removeItem('user')
    localStorage.removeItem('userId')
    localStorage.removeItem('userInfo')
    localStorage.removeItem('activeTab') // Clear persisted tab on logout
    // 清除所有可能的会话数据
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('attendance_') || key.startsWith('exam_') || key.startsWith('cache_'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    setIsLoggedIn(false)
    setUser(null)
    toast.info('已退出登录')
  }, [])

  // 使用token验证hook，实现单设备登录
  useTokenVerification(handleLogout, user?.id)

  const handleSetActiveTab = (tabName, params = {}) => {
    console.trace('Trace for handleSetActiveTab');
    const newTab = { name: tabName, params };
    setActiveTab(newTab);
    localStorage.setItem('activeTab', JSON.stringify(newTab));
  };

  const renderContent = () => {
    switch (activeTab.name) {
      case 'dashboard':
        return <Dashboard onNavigate={handleSetActiveTab} />
      case 'admin-dashboard':
        return <AdminDashboard />
      // 员工管理
      case 'user-employee':
        return <EmployeeManagement />
      case 'user-changes':
        return <EmployeeChanges />
      case 'user-approval':
        return <EmployeeApproval />
      case 'user-reset-password':
        return <ResetPassword />
      case 'user-permission':
        return <RoleManagement />
      case 'user-role-management':
        return <UserRoleManagement />
      case 'system-logs':
        return <OperationLogs />
      // 组织架构
      case 'org-department':
        return <DepartmentManagement />
      case 'org-position':
        return <PositionManagement />

      // 信息系统
      case 'messaging-broadcast':
        return <BroadcastList />
      case 'broadcast-management':
        return <BroadcastManagement />
      case 'notification-settings': // New case for NotificationSettings
        return <NotificationSettings />
      case 'messaging-chat':
        return <WeChatPage />
      case 'messaging-group-management':
        return <GroupManagement />

      // 考勤管理
      case 'attendance-home':
        return <AttendanceHome onNavigate={handleSetActiveTab} />
      case 'attendance-records':
        return <AttendanceRecords />
      case 'attendance-makeup':
        return <MakeupApply />
      case 'attendance-leave-apply':
        return <LeaveApply />
      case 'attendance-leave-records':
        return <LeaveRecords onNavigate={handleSetActiveTab} />
      case 'attendance-overtime-apply':
        return <OvertimeApply />
      case 'attendance-overtime-records':
        return <OvertimeRecords onNavigate={handleSetActiveTab} />
      case 'attendance-stats':
        return <AttendanceStats />
      case 'attendance-department':
        return <DepartmentStats />


      case 'attendance-shift':
        return <ShiftManagement />
      case 'attendance-schedule':
        return <ScheduleManagement />
      case 'attendance-smart-schedule':
        return <SmartSchedule />
      case 'attendance-approval':
        return <ApprovalManagement />
      case 'attendance-settings':
        return <AttendanceSettings />

      // 假期管理
      case 'compensatory-apply':
        return <CompensatoryApply />
      case 'vacation-details':
        return <VacationDetailsNew />
      case 'quota-config':
        return <QuotaConfigLayout />
      case 'vacation-summary':
        return <VacationSummary />
      case 'compensatory-approval':
        return <CompensatoryApproval />
      case 'vacation-permissions':
        return <VacationPermissions />

      // 工资管理
      case 'my-payslips':
        return <MyPayslips />
      case 'payslip-management':
        return <PayslipManagement />

      // 报销管理
      case 'reimbursement-apply':
        return <ReimbursementApply user={user} onSuccess={() => handleSetActiveTab('reimbursement-list')} />
      case 'reimbursement-list':
        return <ReimbursementList
          user={user}
          onViewDetail={(record) => handleSetActiveTab('reimbursement-detail', { id: record.id, from: 'reimbursement-list' })}
        />
      case 'reimbursement-approval':
        return <ReimbursementApproval
          user={user}
          onViewDetail={(record) => handleSetActiveTab('reimbursement-detail', { id: record.id, from: 'reimbursement-approval' })}
        />
      case 'reimbursement-detail':
        return <ReimbursementDetail
          reimbursementId={activeTab.params?.id}
          onBack={() => handleSetActiveTab(activeTab.params?.from || 'reimbursement-list')}
        />
      case 'approval-workflow-config':
        return <ApprovalWorkflowConfig />
      case 'approver-management':
        return <ApproverManagement />
      case 'reimbursement-settings':
        return <ReimbursementSettings />
      case 'role-workflow-config':
        return <RoleWorkflowConfig />

      // 后勤设备管理
      case 'logistics-device-mgmt':
        return <DeviceManagement />
      case 'logistics-device-list':
        return <DeviceList />
      case 'asset-request-audit':
        return <AssetRequestAudit />
      case 'inventory-management':
        return <InventoryManagement />

      // 质检管理
      case 'quality-score':
        return <QualityInspection />
      case 'quality-tags':
        return <QualityTagManagement />
      case 'quality-platform-shop':
        return <PlatformShopManagement />
      case 'quality-case-library':
        return <CaseLibraryPage />
      case 'quality-case-categories':
        return <CaseCategoryManagementPage />
      case 'quality-recommendation': // New case for CaseRecommendationPage
        return <CaseRecommendationPage />

      // 知识库
      case 'knowledge-articles':
        return <Win11KnowledgeBase />
      case 'knowledge-articles-win11':
        return <Win11KnowledgeFolderView />
      case 'knowledge-base':
        return <Win11KnowledgeFolderView />
      case 'knowledge-base-win11':
        return <Win11KnowledgeBase />
      case 'my-knowledge':
        return <Win11MyKnowledgeBase />
      case 'my-knowledge-win11':
        return <Win11MyKnowledgeBase />

      // 考核系统
      case 'assessment-exams':
        return <ExamManagement />
      case 'assessment-plans':
        return <AssessmentPlanManagement />
      case 'assessment-categories':
        return <CategoryManagement />
      case 'exam-plans':
        // 统一使用 assessment-plans
        return <AssessmentPlanManagement />
      case 'my-exams':
        return <MyExams onNavigate={handleSetActiveTab} />
      case 'my-exam-results':
        return <MyExamResults onNavigate={handleSetActiveTab} />;
      case 'exam-results':
        return <ExamResultsManagement onNavigate={handleSetActiveTab} />;
      // 已移除拖拽组卷功能，创建试卷在试卷管理中进行
      case 'exam-taking':
        return <ExamTaking
          resultId={activeTab.params.resultId}
          sourceType={activeTab.params.sourceType}
          onExamEnd={(resultId) => handleSetActiveTab('exam-result', { resultId })}
        />;
      case 'exam-result':
        return <ExamResult
          resultId={activeTab.params.resultId}
          sourceType={activeTab.params.sourceType}
          onBackToMyExams={() => handleSetActiveTab('my-exams')}
        />;
      case 'assessment-management':
        return <AssessmentManagement />;

      // 消息通知
      case 'notification-center':
        return <NotificationCenter />;
      case 'notification-sender':
        return <NotificationSender />;

      // 个人中心
      case 'personal-info':
        return <PersonalInfo />;
      case 'my-todo':
        return <TodoCenter onNavigate={handleSetActiveTab} />;
      case 'my-schedule':
        return <MySchedule />;
      case 'my-notifications':
        return <MyNotifications />;
      case 'my-assets':
        return <MyAssets />;
      case 'my-memos':
        return <MyMemos />;
      case 'employee-memos':
        return <EmployeeMemos />;

      // 系统管理
      case 'system-workflow':
        return <WorkflowSettings />

      default:
        return <NotFound />    }
  }

  // 加载主题
  const [appTheme, setAppTheme] = useState({
    background: '#F3F4F6'
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('personalInfoTheme');
    if (savedTheme) {
      try {
        setAppTheme(JSON.parse(savedTheme));
      } catch (e) {
        console.error('Theme parse error', e);
        setAppTheme({ background: '#F3F4F6' });
      }
    }
  }, []);

  // 监听localStorage变化，确保主题更新能及时反映到侧边栏
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'personalInfoTheme') {
        try {
          const newTheme = JSON.parse(e.newValue);
          setAppTheme(newTheme);
        } catch (error) {
          console.error('Failed to parse theme from storage event', error);
          setAppTheme({ background: '#F3F4F6' });
        }
      }
    };

    // 监听自定义主题变化事件
    const handleThemeChange = (e) => {
      setAppTheme(e.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('themeChange', handleThemeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themeChange', handleThemeChange);
    };
  }, []);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <ErrorBoundary>
      <DatabaseCheck>
        <PermissionProvider>
          <div className="flex h-screen bg-gray-50">
            <Sidebar
              activeTab={activeTab.name}
              setActiveTab={handleSetActiveTab}
              user={user}
              onLogout={handleLogout}
              theme={appTheme}  // 传递主题信息
            />
            <main
              className="flex-1 flex flex-col"
              style={{ backgroundColor: appTheme.background }}
            >
              <TopNavbar
                activeTab={activeTab.name}
                user={user}
                onLogout={handleLogout}
                unreadCount={unreadCount}
                onUpdateUnread={setUnreadCount}
                onNavigate={handleSetActiveTab}
                zoomLevel={contentZoom}
                onZoomChange={handleZoomChange}
              />
              <div className="flex-1 overflow-auto" style={{ zoom: contentZoom / 100 }}>
                <Suspense fallback={<div className="flex justify-center items-center h-full"><Spin size="large" /></div>}>
                  {renderContent()}
                </Suspense>
              </div>
            </main>
            <Toaster
              position="bottom-right"
              expand={false}
              richColors={false}
              closeButton
              duration={5000}
              visibleToasts={3}
            />

            {/* 未读备忘录弹窗 */}
            {showMemoPopup && (
              <Suspense fallback={null}>
                <UnreadMemoPopup onClose={() => setShowMemoPopup(false)} />
              </Suspense>
            )}
          </div>
        </PermissionProvider>
      </DatabaseCheck>
    </ErrorBoundary>
  )
}

export default App
