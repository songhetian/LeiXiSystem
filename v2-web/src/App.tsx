import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import { ErrorPage } from './pages/ErrorPage';
import { MainLayout } from './layouts/MainLayout';
import { PersonalInfo } from './features/personal';
import { EmployeeManagement } from './features/hr';
import { ChangeRecords } from './features/hr/components/ChangeRecords';
import { ChatFeature } from './features/chat';
import { RBACSystem } from './features/rbac';
import { SystemLogs } from './features/admin/logs';
import { WorkflowArchitecture } from './features/finance/workflow';
import { KnowledgeBase } from './features/knowledge';
import { DeviceList } from './features/assets';
import { AttendanceSystem } from './features/attendance';
import { BroadcastSystem } from './features/broadcast';
import { ReimbursementList, ReimbursementApply, ReimbursementApproval } from './features/finance';
import { AdminDashboard, PersonalDashboard } from './features/dashboard';
import { ExamCenter, ExamEditor, ExamPlayer } from './features/exams';
import { VacationCenter } from './features/vacation';
import { SchedulingCenter } from './features/scheduling';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* 全屏应用级页面 (考试进行中) */}
        <Route path="/app/exam-player/:planId" element={<ExamPlayer />} />

        <Route path="/app" element={<MainLayout />}>
          {/* 决策中心 */}
          <Route path="dashboard" element={<PersonalDashboard />} />
          <Route path="admin-dashboard" element={<AdminDashboard />} />
          
          {/* 人事与考核 */}
          <Route path="user-employee" element={<EmployeeManagement />} />
          <Route path="user-changes" element={<ChangeRecords />} />
          <Route path="hr-exam-management" element={<ExamCenter />} />
          <Route path="hr-exam-editor/:id" element={<ExamEditor />} />
          
          {/* 协作模块 */}
          <Route path="messaging-chat" element={<ChatFeature />} />
          <Route path="messaging-broadcast" element={<BroadcastSystem />} />
          
          {/* 管理与知识 */}
          <Route path="user-permission" element={<RBACSystem />} />
          <Route path="system-logs" element={<SystemLogs />} />
          <Route path="approval-workflow-config" element={<WorkflowArchitecture />} />
          <Route path="knowledge-articles" element={<KnowledgeBase />} />
          
          {/* 业务与后勤 */}
          <Route path="logistics-device-list" element={<DeviceList />} />
          <Route path="quality-rules" element={<KnowledgeBase />} /> 
          <Route path="attendance-home" element={<AttendanceSystem />} />
          <Route path="attendance-schedule" element={<SchedulingCenter />} />
          <Route path="vacation-details" element={<VacationCenter />} />
          
          {/* 财务模块 */}
          <Route path="reimbursement-list" element={<ReimbursementList />} />
          <Route path="reimbursement-apply" element={<ReimbursementApply />} />
          <Route path="reimbursement-approval" element={<ReimbursementApproval />} />
          
          {/* 个人中心 */}
          <Route path="personal-info" element={<PersonalInfo />} />

          <Route path="*" element={<ErrorPage code={404} />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/401" element={<ErrorPage code={401} />} />
        <Route path="/500" element={<ErrorPage code={500} />} />
        <Route path="*" element={<ErrorPage code={404} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
