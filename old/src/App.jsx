import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { Toaster, toast } from 'sonner'
import { showNotificationToast } from './utils/notificationUtils';
import './styles/sonner-toast.css'
import { useTokenVerification } from './hooks/useTokenVerification'
import { tokenManager } from './utils/apiClient'
import api from './api'
import { wsManager } from './services/websocket'
import { soundManager } from './utils/soundManager'
import { useChatStore } from './hooks/useChatStore'
import Sidebar from './components/Sidebar'
import TopNavbar from './components/TopNavbar'
import DatabaseCheck from './components/DatabaseCheck'
import ErrorBoundary from './components/ErrorBoundary'
import { PermissionProvider } from './contexts/PermissionContext'
import logger from '@/utils/logger';

// 懒加载页面组件 - 修正后的真实物理路径 (Version 2.2)
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'))
const AdminDashboard = lazy(() => import('./pages/Dashboard/AdminDashboard'))
const PersonnelManagement = lazy(() => import('./components/EmployeeManagement'))
const EmployeeChanges = lazy(() => import('./components/EmployeeChanges'))
const EmployeeApproval = lazy(() => import('./components/EmployeeApproval'))
const DepartmentManagement = lazy(() => import('./components/DepartmentManagement'))
const PositionManagement = lazy(() => import('./components/PositionManagement'))
const RoleManagement = lazy(() => import('./pages/System/RoleManagement'))
const UserRoleManagement = lazy(() => import('./pages/System/UserRoleManagement'))
const ResetPassword = lazy(() => import('./components/ResetPassword'))
const OperationLogs = lazy(() => import('./pages/System/OperationLogs'))
const WeChatPage = lazy(() => import('./pages/Messaging/WeChatPage'))
const AttendanceHome = lazy(() => import('./pages/Attendance/AttendanceHome'))
const AttendanceStats = lazy(() => import('./pages/Attendance/AttendanceStats'))
const ShiftManagement = lazy(() => import('./pages/Attendance/ShiftManagement'))
const SchedulingHub = lazy(() => import('./pages/Attendance/SchedulingHub'))
const AttendanceAuditHub = lazy(() => import('./pages/Attendance/AttendanceAuditHub'))
const Win11KnowledgeBase = lazy(() => import('./components/Win11KnowledgeBase'))
const KnowledgeManagement = lazy(() => import('./components/KnowledgeManagement'))
const Win11MyKnowledgeBase = lazy(() => import('./components/Win11MyKnowledgeBase'))
const VacationManagementHub = lazy(() => import('./pages/Personal/VacationManagementHub'))
const ReimbursementApply = lazy(() => import('./components/ReimbursementApply'))
const ReimbursementList = lazy(() => import('./components/ReimbursementList'))
const ReimbursementApproval = lazy(() => import('./components/ReimbursementApproval'))
const ReimbursementSettings = lazy(() => import('./components/ReimbursementSettings'))
const PayslipManagement = lazy(() => import('./pages/Payroll/PayslipManagement'))
const WorkflowSettings = lazy(() => import('./pages/System/WorkflowSettings'))
const AssetManagement = lazy(() => import('./pages/Finance/Assets/AssetManagement'))
const InventoryManagement = lazy(() => import('./pages/Finance/Inventory/InventoryManagement'))
const PersonalInfo = lazy(() => import('./components/PersonalInfo'))
const TodoCenter = lazy(() => import('./pages/Personal/TodoCenter'))
const MyPayslips = lazy(() => import('./pages/Payroll/MyPayslips'))
const MyAssets = lazy(() => import('./pages/Personal/MyAssets'))
const MyMemos = lazy(() => import('./pages/Personal/MyMemos'))
const QualityInspection = lazy(() => import('./components/QualityInspection'))
const QualityReportPage = lazy(() => import('./pages/QualityReportPage'))
const CaseLibraryPage = lazy(() => import('./pages/CaseLibraryPage'))
const CaseRecommendationPage = lazy(() => import('./pages/CaseRecommendationPage'))
const QualityStatisticsPage = lazy(() => import('./pages/QualityStatisticsPage'))
const QualityRuleManagementPage = lazy(() => import('./pages/QualityRuleManagementPage'))
const MyExams = lazy(() => import('./components/MyExams'))
const MyExamResults = lazy(() => import('./components/MyExamResults'))
const ExamManagement = lazy(() => import('./components/ExamManagement'))
const AssessmentPlanManagement = lazy(() => import('./components/AssessmentPlanManagement'))
const ExamResultsManagement = lazy(() => import('./components/ExamResultsManagement'))
const ExamTaking = lazy(() => import('./pages/Assessment/ExamTaking'))
const ExamResult = lazy(() => import('./pages/Assessment/ExamResult'))
const Login = lazy(() => import('./pages/Login'))
const BroadcastManagement = lazy(() => import('./pages/Admin/BroadcastManagement'))
const AssetRequestAudit = lazy(() => import('./pages/Finance/Assets/AssetRequestAudit'))
const GroupManagement = lazy(() => import('./pages/Messaging/GroupManagement'))
const DeviceList = lazy(() => import('./pages/Logistics/DeviceList'))

// 新增/兜底组件的懒加载
const MyNotifications = lazy(() => import('./pages/Personal/MyNotifications'))
const NotificationSettings = lazy(() => import('./components/NotificationSettings'))
const EmployeeMemos = lazy(() => import('./pages/Employee/EmployeeMemos'))
const CompensatoryApproval = lazy(() => import('./components/CompensatoryApproval'))
const ApproverManagement = lazy(() => import('./components/ApproverManagement'))
const ApprovalWorkflowConfig = lazy(() => import('./components/ApprovalWorkflowConfig'))
const RoleWorkflowConfig = lazy(() => import('./components/RoleWorkflowConfig'))
const MySchedule = lazy(() => import('./pages/Personal/MySchedule'))
const NotFound = lazy(() => import('./pages/NotFound'))

// 标签页名称映射表
const tabLabels = {
  'dashboard': '仪表盘',
  'admin-dashboard': '管理概览',
  'user-employee': '员工管理',
  'user-changes': '变动记录',
  'user-approval': '入职审批',
  'org-department': '部门管理',
  'org-position': '岗位管理',
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
  'exam-taking': '正在考试',
  'exam-result': '查看结果'
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  
  // --- 标签页持久化：初始化逻辑 ---
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('active_tab')
    try {
      if (saved) {
        const parsed = JSON.parse(saved);
        if (tabLabels[parsed.name]) return parsed;
      }
      return { name: 'dashboard', label: '仪表盘' };
    } catch (e) {
      return { name: 'dashboard', label: '仪表盘' };
    }
  })

  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [systemNotificationEnabled, setSystemNotificationEnabled] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showMemoPopup, setShowMemoPopup] = useState(false)
  const { handleNewMessage } = useChatStore()

  const handleSetActiveTab = useCallback((tabName) => {
    const label = tabLabels[tabName] || '新标签'
    const newTab = { name: tabName, label }
    setActiveTab(newTab)
    localStorage.setItem('active_tab', JSON.stringify(newTab))
  }, [])

  const handleLogout = useCallback(async (reason = 'manual') => {
    try {
      if (tokenManager.getToken()) {
        await api.post('/auth/logout').catch(() => {})
      }
    } catch (e) {}
    
    tokenManager.clearTokens()
    localStorage.removeItem('user')
    localStorage.removeItem('active_tab')
    setUser(null)
    setIsLoggedIn(false)
    wsManager.disconnect()
    
    if (reason === 'manual') {
      toast.success('已安全退出系统')
    }
  }, [])

  useEffect(() => {
    const onLogout = (e) => handleLogout(e.detail?.reason || 'event');
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [handleLogout]);

  useTokenVerification(handleLogout, user?.id)

  useEffect(() => {
    if (!isLoggedIn || !user?.id) return

    const checkUnreadNotifications = async () => {
      try {
        const res = await api.get(`/notifications/unread-count?userId=${user.id}`);
        if (res.data.success) setUnreadCount(res.data.count);
      } catch (e) {}
    };

    const checkUnreadMemos = async () => {
      try {
        // 后端正确路径为 /memos/unread-list
        const res = await api.get(`/memos/unread-list?userId=${user.id}`);
        if (res.data.success && res.data.data.length > 0) setShowMemoPopup(true);
      } catch (e) {}
    };


    const sessionHeartbeat = setInterval(async () => {
      try {
        await api.get('/auth/permissions');
      } catch (error) {
        if (error.response?.status === 401) {
          handleLogout('kicked_out_heartbeat');
        }
      }
    }, 60000);

    const handleNotification = (notification) => {
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
      // 不再手动 +1，等待服务器推送最新的全量 unread_count
    };

    const handleKickedOut = (data) => {
      wsManager.disconnect();
      toast.error('登录失效', {
        description: data.message || '您的账号已在另一台设备登录',
        duration: 10000,
        action: { label: '重新登录', onClick: () => handleLogout('kicked_out') }
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
    wsManager.on('broadcast', (b) => { 
      soundManager.playNotification(); 
      toast.info(`新广播: ${b.title}`, {
        description: b.content?.substring(0, 50) + (b.content?.length > 50 ? '...' : ''),
        action: { label: '立即查看', onClick: () => handleSetActiveTab('messaging-broadcast') },
        duration: 10000
      });
      // 不再手动 +1，等待服务器推送最新的全量 unread_count
    })
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
  }, [isLoggedIn, user?.id, handleLogout, activeTab.name, notificationEnabled, handleNewMessage, handleSetActiveTab]);

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setIsLoggedIn(true)
        setUser(userData)
        wsManager.connect({ token, avatar: userData.avatar })
      } catch (e) {
        handleLogout('init_error')
      }
    }
  }, [handleLogout])

  if (!isLoggedIn) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="flex items-center justify-center h-screen">系统启动中...</div>}>
          <Login onLoginSuccess={(userData) => {
            setUser(userData)
            setIsLoggedIn(true)
            wsManager.connect({ token: tokenManager.getToken(), avatar: userData.avatar })
          }} />
        </Suspense>
      <Toaster 
        position="bottom-right" 
        richColors 
        closeButton 
        visibleToasts={1} 
        expand={false} 
        duration={2000}
        offset={20}
        toastOptions={{
          style: {
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            padding: '12px 16px',
          }
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        /* 极致物理锁定：彻底解决向上堆叠与留白问题 */
        [data-sonner-toaster] {
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          left: auto !important;
          top: auto !important;
          height: fit-content !important;
          max-height: 80px !important;
          z-index: 9999 !important;
          transform: none !important;
        }
        [data-sonner-toast] {
          --y: 0px !important;
          margin-bottom: 0 !important;
        }
      `}} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <DatabaseCheck>
        <PermissionProvider>
          <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} onLogout={handleLogout} user={user} />
            
            <div className="flex-1 flex flex-col min-w-0 relative">
              <TopNavbar 
                user={user} 
                onLogout={() => handleLogout('manual')} 
                activeTab={activeTab}
                unreadCount={unreadCount}
                onNavigate={handleSetActiveTab}
              />
              <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <Suspense fallback={<div className="flex items-center justify-center h-full">资源加载中...</div>}>
                  {activeTab.name === 'dashboard' && (user?.role === '超级管理员' || user?.role === 'admin' ? <AdminDashboard onNavigate={handleSetActiveTab} /> : <Dashboard onNavigate={handleSetActiveTab} />)}
                  {activeTab.name === 'admin-dashboard' && <AdminDashboard onNavigate={handleSetActiveTab} />}
                  
                  {activeTab.name === 'user-employee' && <PersonnelManagement onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'user-changes' && <EmployeeChanges />}
                  {activeTab.name === 'user-approval' && <EmployeeApproval />}
                  {activeTab.name === 'org-department' && <DepartmentManagement />}
                  {activeTab.name === 'org-position' && <PositionManagement />}
                  {activeTab.name === 'user-permission' && <RoleManagement />}
                  {activeTab.name === 'user-role-management' && <UserRoleManagement />}
                  {activeTab.name === 'user-reset-password' && <ResetPassword />}
                  {activeTab.name === 'system-logs' && <OperationLogs />}
                  {activeTab.name === 'messaging-broadcast' && <MyNotifications onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'broadcast-management' && <BroadcastManagement />}
                  {activeTab.name === 'notification-settings' && <NotificationSettings />}
                  {activeTab.name === 'messaging-chat' && <WeChatPage onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'messaging-group-management' && <GroupManagement />}
                  {activeTab.name === 'employee-memos' && <EmployeeMemos />}
                  {activeTab.name === 'attendance-home' && <AttendanceHome onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'attendance-dept-stats' && <AttendanceStats />}
                  {activeTab.name === 'attendance-shift' && <ShiftManagement />}
                  {activeTab.name === 'attendance-schedule' && <SchedulingHub />}
                  {activeTab.name === 'attendance-approval' && <AttendanceAuditHub />}
                  {activeTab.name === 'knowledge-articles' && <Win11KnowledgeBase />}
                  {activeTab.name === 'knowledge-base' && <KnowledgeManagement />}
                  {activeTab.name === 'my-knowledge' && <Win11MyKnowledgeBase />}

                  {activeTab.name === 'vacation-details' && <VacationManagementHub />}
                  {activeTab.name === 'compensatory-approval' && <CompensatoryApproval />}
                  {activeTab.name === 'reimbursement-apply' && <ReimbursementApply />}
                  {activeTab.name === 'reimbursement-list' && <ReimbursementList />}
                  {activeTab.name === 'reimbursement-approval' && <ReimbursementApproval />}
                  {activeTab.name === 'approver-management' && <ApproverManagement />}
                  {activeTab.name === 'reimbursement-settings' && <ReimbursementSettings />}
                  {activeTab.name === 'payslip-management' && <PayslipManagement />}
                  {activeTab.name === 'system-workflow' && <WorkflowSettings />}
                  {activeTab.name === 'approval-workflow-config' && <ApprovalWorkflowConfig />}
                  {activeTab.name === 'role-workflow-config' && <RoleWorkflowConfig />}
                  {activeTab.name === 'logistics-device-mgmt' && <AssetManagement />}
                  {activeTab.name === 'logistics-device-list' && <DeviceList />}
                  {activeTab.name === 'asset-request-audit' && <AssetRequestAudit />}
                  {activeTab.name === 'inventory-management' && <InventoryManagement />}
                  {activeTab.name === 'personal-info' && <PersonalInfo />}
                  {activeTab.name === 'my-todo' && <TodoCenter onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'my-schedule' && <MySchedule />}
                  {activeTab.name === 'my-notifications' && <MyNotifications onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'my-payslips' && <MyPayslips />}
                  {activeTab.name === 'my-assets' && <MyAssets />}
                  {activeTab.name === 'my-memos' && <MyMemos />}
                  {activeTab.name === 'quality-inspection' && <QualityInspection />}
                  {activeTab.name === 'quality-report' && <QualityReportPage />}
                  {activeTab.name === 'case-library' && <CaseLibraryPage />}
                  {activeTab.name === 'case-recommendation' && <CaseRecommendationPage />}
                  {activeTab.name === 'quality-statistics' && <QualityStatisticsPage />}
                  {activeTab.name === 'quality-rules' && <QualityRuleManagementPage />}
                  {activeTab.name === 'my-exams' && <MyExams onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'my-results' && <MyExamResults onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'exam-management' && <ExamManagement />}
                  {activeTab.name === 'assessment-plans' && <AssessmentPlanManagement />}
                  {activeTab.name === 'exam-results-management' && <ExamResultsManagement onNavigate={handleSetActiveTab} />}
                  {activeTab.name === 'exam-taking' && <ExamTaking />}
                  {activeTab.name === 'exam-result' && <ExamResult />}

                  {!tabLabels[activeTab.name] && <NotFound onBack={handleSetActiveTab} />}
                </Suspense>
              </main>
            </div>
          </div>
        </PermissionProvider>
      </DatabaseCheck>
      <Toaster 
        position="bottom-right" 
        richColors 
        closeButton 
        visibleToasts={1} 
        expand={false} 
        duration={2000}
        offset={20}
        toastOptions={{
          style: {
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            padding: '12px 16px',
          }
        }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        /* 极致物理锁定：彻底解决向上堆叠与留白问题 */
        [data-sonner-toaster] {
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          left: auto !important;
          top: auto !important;
          height: fit-content !important;
          max-height: 80px !important;
          z-index: 9999 !important;
          transform: none !important;
        }
        [data-sonner-toast] {
          --y: 0px !important;
          margin-bottom: 0 !important;
        }
      `}} />
    </ErrorBoundary>
  )
}

export default App
