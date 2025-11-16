import React, { useState, useEffect } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import Login from './pages/Login'
import Sidebar from './components/Sidebar'
import { useTokenVerification } from './hooks/useTokenVerification'
import CustomerList from './components/CustomerList'
import SessionManagement from './components/SessionManagement'
import QualityInspection from './components/QualityInspection'
import DepartmentManagement from './components/DepartmentManagement'
import PositionManagement from './components/PositionManagement'
import EmployeeManagement from './components/EmployeeManagement'
import EmployeeChanges from './components/EmployeeChanges'
import EmployeeApproval from './components/EmployeeApproval'
import ResetPassword from './components/ResetPassword'
import PermissionManagement from './components/PermissionManagement'
import KnowledgeManagement from './components/KnowledgeManagement'
import KnowledgeBase from './components/KnowledgeBase'
import KnowledgeFolderView from './components/KnowledgeFolderView'
import MyKnowledgeBase from './components/MyKnowledgeBase'
import ExamManagement from './components/ExamManagement'
import ExamCategoryManagement from './components/ExamCategoryManagement'
import Statistics from './components/Statistics'
import ComingSoon from './components/ComingSoon'
import PersonalInfo from './components/PersonalInfo'
import LearningPlans from './components/LearningPlans'
import LearningPlanDetails from './components/LearningPlanDetails'
import LearningStatistics from './components/LearningStatistics'
import LearningCenter from './components/LearningCenter'
import { getApiUrl } from './utils/apiConfig'

// 考勤管理页面
import {
  AttendanceHome,
  AttendanceRecords,
  LeaveApply,
  LeaveRecords,
  OvertimeApply,
  OvertimeRecords,
  MakeupApply,
  AttendanceStats,
  DepartmentStats,
  DepartmentAttendanceStats,
  ShiftManagement,
  ScheduleManagement,
  Notifications,
  SmartSchedule,
  ApprovalManagement,
  AttendanceSettings
} from './pages/Attendance'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('user-employee')

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

  const handleLogout = async () => {
    const token = localStorage.getItem('token')

    // 如果有token，调用后端API清除session
    if (token) {
      try {
        await fetch(getApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      } catch (error) {
        console.error('退出登录API调用失败:', error)
        // 即使API调用失败，也继续清除本地存储
      }
    }

    // 清除本地存储
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUser(null)
    toast.info('已退出登录')
  }

  // 使用token验证hook，实现单设备登录
  useTokenVerification(handleLogout)

  const renderContent = () => {
    switch (activeTab) {
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

      // 聊天通讯
      case 'chat-message':
        return <ComingSoon title="即时通讯" />
      case 'chat-group':
        return <ComingSoon title="群组管理" />

      // 考勤管理
      case 'attendance-home':
        return <AttendanceHome onNavigate={setActiveTab} />
      case 'attendance-records':
        return <AttendanceRecords />
      case 'attendance-leave-apply':
        return <LeaveApply />
      case 'attendance-leave-records':
        return <LeaveRecords />
      case 'attendance-overtime-apply':
        return <OvertimeApply />
      case 'attendance-overtime-records':
        return <OvertimeRecords />
      case 'attendance-makeup':
        return <MakeupApply />
      case 'attendance-stats':
        return <AttendanceStats />
      case 'attendance-department':
        return <DepartmentStats />
      case 'attendance-department-stats':
        return <DepartmentAttendanceStats />
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

      // 质检管理
      case 'quality-session':
        return <SessionManagement />
      case 'quality-rule':
        return <ComingSoon title="质检规则" />
      case 'quality-score':
        return <QualityInspection />
      case 'quality-report':
        return <ComingSoon title="质检报告" />

      // 知识库
      case 'knowledge-articles':
        return <KnowledgeFolderView />
      case 'knowledge-base':
        return <KnowledgeBase />
      case 'my-knowledge':
        return <MyKnowledgeBase />

      // 考核系统
      case 'exam-papers':
        return <ExamManagement />
      case 'exam-categories':
        return <ExamCategoryManagement />
      case 'exam-plans':
        return <ComingSoon title="考核计划" />
      case 'exam-results':
        return <ComingSoon title="考试结果" />

      // 统计分析
      case 'statistics-overview':
        return <Statistics />
      case 'statistics-employee':
        return <ComingSoon title="员工统计" />
      case 'statistics-department':
        return <ComingSoon title="部门统计" />

      // 学习中心
      case 'learning-center':
        return <LearningCenter />
      case 'learning-plans':
        return <LearningPlans />
      case 'learning-plan-details':
        return <LearningPlanDetails />
      case 'learning-statistics':
        return <LearningStatistics />

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
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto bg-gray-50">
        {renderContent()}
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
      />
    </div>
  )
}

export default App
