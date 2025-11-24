import React, { useState, useEffect, lazy, Suspense } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import { showNotificationToast } from './utils/notificationUtils';
import 'react-toastify/dist/ReactToastify.css'
import { useTokenVerification } from './hooks/useTokenVerification'
import { getApiUrl } from './utils/apiConfig'
import { tokenManager, apiPost } from './utils/apiClient'
import { Spin } from 'antd'; // Import Spin for fallback

// Lazy-loaded components
const Login = lazy(() => import('./pages/Login'));
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
const PermissionManagement = lazy(() => import('./components/PermissionManagement'));
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
const Statistics = lazy(() => import('./components/Statistics'));
const ComingSoon = lazy(() => import('./components/ComingSoon'));
const PersonalInfo = lazy(() => import('./components/PersonalInfo'));

const CaseLibraryPage = lazy(() => import('./pages/CaseLibraryPage'));
const QualityRuleManagementPage = lazy(() => import('./pages/QualityRuleManagementPage'));
const QualityStatisticsPage = lazy(() => import('./pages/QualityStatisticsPage'));
const QualityReportPage = lazy(() => import('./pages/QualityReportPage'));
const CaseRecommendationPage = lazy(() => import('./pages/CaseRecommendationPage'));
const ViewingStatistics = lazy(() => import('./pages/ViewingStatistics'));
const Diagnostics = lazy(() => import('./components/Diagnostics'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
const NotificationSender = lazy(() => import('./components/NotificationSender'));
const NotificationSettings = lazy(() => import('./components/NotificationSettings'));

const LeaveRecords = lazy(() => import('./pages/Attendance').then(module => ({ default: module.LeaveRecords })));
const OvertimeApply = lazy(() => import('./pages/Attendance').then(module => ({ default: module.OvertimeApply })));
const OvertimeRecords = lazy(() => import('./pages/Attendance').then(module => ({ default: module.OvertimeRecords })));
const MakeupApply = lazy(() => import('./pages/Attendance').then(module => ({ default: module.MakeupApply })));
const AttendanceStats = lazy(() => import('./pages/Attendance').then(module => ({ default: module.AttendanceStats })));
const DepartmentStats = lazy(() => import('./pages/Attendance').then(module => ({ default: module.DepartmentStats })));

const ShiftManagement = lazy(() => import('./pages/Attendance').then(module => ({ default: module.ShiftManagement })));
const ScheduleManagement = lazy(() => import('./pages/Attendance').then(module => ({ default: module.ScheduleManagement })));
const Notifications = lazy(() => import('./pages/Attendance').then(module => ({ default: module.Notifications })));
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
const WeChatPage = lazy(() => import('./pages/Messaging').then(module => ({ default: module.WeChatPage })));
const CreateGroupPage = lazy(() => import('./pages/Messaging').then(module => ({ default: module.CreateGroupPage })));
import DatabaseCheck from './components/DatabaseCheck';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState({ name: 'user-employee', params: {} })

  useEffect(() => {
    // 检查本地存储的登录状态
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (token && savedUser) {
      setIsLoggedIn(true)
      setUser(JSON.parse(savedUser))
    }
  }, [])



  const handleLoginSuccess = (userData) => {
    setIsLoggedIn(true)
    setUser(userData)
  }

  const handleLogout = React.useCallback(async () => {
    // 调用后端API清除session
    try {
      await apiPost('/api/auth/logout')
    } catch (error) {
      console.error('退出登录API调用失败:', error)
      // 即使API调用失败，也继续清除本地存储
    }

    // 清除本地存储 - 更彻底的清理
    tokenManager.clearTokens()
    localStorage.removeItem('user')
    localStorage.removeItem('userId')
    localStorage.removeItem('userInfo')
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
    setActiveTab({ name: tabName, params });
  };

  const renderContent = () => {
    switch (activeTab.name) {
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
        return <PermissionManagement />

      // 组织架构
      case 'org-department':
        return <DepartmentManagement />
      case 'org-position':
        return <PositionManagement />

      // 信息系统
      case 'messaging-chat':
        return <WeChatPage />
      case 'messaging-create-group':
        return <CreateGroupPage />

      // 考勤管理
      case 'attendance-home':
        return <AttendanceHome />
      case 'attendance-records':
        return <AttendanceRecords />
      case 'attendance-makeup':
        return <MakeupApply />
      case 'attendance-leave-apply':
        return <LeaveApply />
      case 'attendance-leave-records':
        return <LeaveRecords />
      case 'attendance-overtime-apply':
        return <OvertimeApply />
      case 'attendance-overtime-records':
        return <OvertimeRecords />
      case 'attendance-stats':
        return <AttendanceStats />
      case 'attendance-department':
        return <DepartmentStats />

      case 'attendance-shift':
        return <ShiftManagement />
      case 'attendance-schedule':
        return <ScheduleManagement />
      case 'attendance-notifications':
        return <Notifications />
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


      // 质检管理
      case 'quality-session':
        return <SessionManagement />
      case 'quality-rule':
        return <QualityRuleManagementPage />
      case 'quality-score':
        return <QualityInspection />
      case 'quality-platform-shop':
        return <PlatformShopManagement />
      case 'quality-report':
        return <QualityStatisticsPage />
      case 'quality-report-summary': // New case for QualityReportPage
        return <QualityReportPage />
      case 'quality-case-library': // New case for CaseLibraryPage
        return <CaseLibraryPage />
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
      case 'assessment-results':
        return <ExamResultsManagement />
      // 已移除拖拽组卷功能，创建试卷在试卷管理中进行
      case 'exam-taking':
        return <ExamTaking
          resultId={activeTab.params.resultId}
          onExamEnd={(resultId) => handleSetActiveTab('exam-result', { resultId })}
        />
      case 'exam-result':
        return <ExamResult
          resultId={activeTab.params.resultId}
          onBackToMyExams={() => handleSetActiveTab('my-exams')}
        />
      case 'assessment-management':
        return <AssessmentManagement />

      // 统计分析
      case 'statistics-overview':
        return <Statistics />
      case 'statistics-employee':
        return <ComingSoon title="员工统计" />
      case 'statistics-department':
        return <ComingSoon title="部门统计" />
      case 'statistics-viewing':
        return <ViewingStatistics />

      // 系统诊断
      case 'diagnostics-info':
        return <Diagnostics />

      // 消息通知
      case 'notification-center':
        return <NotificationCenter />
      case 'notification-sender':
        return <NotificationSender />
      case 'notification-settings': // New case for NotificationSettings
        return <NotificationSettings />

      // 个人中心
      case 'personal-info':
        return <PersonalInfo />

      default:
        return <EmployeeManagement />
    }
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <DatabaseCheck>
      <div className="flex h-screen bg-gray-50">
        <Sidebar
          activeTab={activeTab.name}
          setActiveTab={handleSetActiveTab}
          user={user}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-auto bg-gray-50">
          <Suspense fallback={<div className="flex justify-center items-center h-full"><Spin size="large" /></div>}>
            {renderContent()}
          </Suspense>
        </main>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
          limit={3}
        />
      </div>
    </DatabaseCheck>
  )
}

export default App
