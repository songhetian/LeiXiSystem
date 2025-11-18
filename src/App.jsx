import React, { useState, useEffect } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import { io } from 'socket.io-client';
import { showNotificationToast } from './utils/notificationUtils';
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
import Win11KnowledgeBase from './components/Win11KnowledgeBase'
import Win11MyKnowledgeBase from './components/Win11MyKnowledgeBase'
import Win11KnowledgeFolderView from './components/Win11KnowledgeFolderView'
import AssessmentManagement from './components/AssessmentManagement'
import MyExamList from './components/MyExamList'
import ExamTaking from './components/ExamTaking'
import ExamResult from './components/ExamResult'
import Statistics from './components/Statistics'
import ComingSoon from './components/ComingSoon'
import PersonalInfo from './components/PersonalInfo'
import NotificationCenter from './components/NotificationCenter'
import NotificationSender from './components/NotificationSender'
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

  useEffect(() => {
    let socket;
    if (isLoggedIn && user) {
      socket = io(getApiUrl('/')); // Connect to the root namespace

      socket.on('connect', () => {
        console.log('Socket.IO connected:', socket.id);
        socket.emit('user:online', user.id); // Notify server user is online
      });

      socket.on('notification:new', (notification) => {
        console.log('New notification received:', notification);
        showNotificationToast(notification); // Display the notification
      });

      socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
      });

      socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err);
      });
    }

    return () => {
      if (socket) {
        console.log('Disconnecting Socket.IO');
        socket.disconnect();
      }
    };
  }, [isLoggedIn, user]);

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

      // 聊天通讯
      case 'chat-message':
        return <ComingSoon title="即时通讯" />
      case 'chat-group':
        return <ComingSoon title="群组管理" />

      // 考勤管理
      case 'attendance-home':
        return <AttendanceHome onNavigate={handleSetActiveTab} />
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
      case 'knowledge-articles-win11':
        return <Win11KnowledgeFolderView />
      case 'knowledge-base':
        return <KnowledgeBase />
      case 'knowledge-base-win11':
        return <Win11KnowledgeBase />
      case 'my-knowledge':
        return <MyKnowledgeBase />
      case 'my-knowledge-win11':
        return <Win11MyKnowledgeBase />

      // 考核系统
      case 'my-exams':
        return <MyExamList onStartExam={(examId, planId) => handleSetActiveTab('exam-taking', { examId, planId })} />
      case 'exam-taking':
        return <ExamTaking
          examId={activeTab.params.examId}
          planId={activeTab.params.planId}
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

      // 个人中心
      case 'personal-info':
        return <PersonalInfo />

      // 消息通知
      case 'notification-center':
        return <NotificationCenter />
      case 'notification-sender':
        return <NotificationSender />

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
        activeTab={activeTab.name}
        setActiveTab={handleSetActiveTab}
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
