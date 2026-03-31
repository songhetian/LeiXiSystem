import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { ErrorPage } from './pages/ErrorPage';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const MainLayout = lazy(() => import('./layouts/MainLayout').then((module) => ({ default: module.MainLayout })));
const PersonalCenter = lazy(() => import('./features/personal').then((module) => ({ default: module.PersonalCenter })));
const EmployeeManagement = lazy(() => import('./features/hr').then((module) => ({ default: module.EmployeeManagement })));
const ChangeRecords = lazy(() => import('./features/hr/components/ChangeRecords').then((module) => ({ default: module.ChangeRecords })));
const ChatFeature = lazy(() => import('./features/chat').then((module) => ({ default: module.ChatFeature })));
const RBACSystem = lazy(() => import('./features/rbac').then((module) => ({ default: module.RBACSystem })));
const SystemLogs = lazy(() => import('./features/admin/logs').then((module) => ({ default: module.SystemLogs })));
const WorkflowArchitecture = lazy(() => import('./features/finance/workflow').then((module) => ({ default: module.WorkflowArchitecture })));
const KnowledgeBase = lazy(() => import('./features/knowledge').then((module) => ({ default: module.KnowledgeBase })));
const QualityInspection = lazy(() => import('./features/quality').then((module) => ({ default: module.QualityInspection })));
const DeviceList = lazy(() => import('./features/assets').then((module) => ({ default: module.DeviceList })));
const AttendanceSystem = lazy(() => import('./features/attendance').then((module) => ({ default: module.AttendanceSystem })));
const BroadcastSystem = lazy(() => import('./features/broadcast').then((module) => ({ default: module.BroadcastSystem })));
const ReimbursementList = lazy(() => import('./features/finance').then((module) => ({ default: module.ReimbursementList })));
const ReimbursementApply = lazy(() => import('./features/finance').then((module) => ({ default: module.ReimbursementApply })));
const ReimbursementApproval = lazy(() => import('./features/finance').then((module) => ({ default: module.ReimbursementApproval })));
const AdminDashboard = lazy(() => import('./features/dashboard').then((module) => ({ default: module.AdminDashboard })));
const PersonalDashboard = lazy(() => import('./features/dashboard').then((module) => ({ default: module.PersonalDashboard })));
const ExamCenter = lazy(() => import('./features/exams').then((module) => ({ default: module.ExamCenter })));
const ExamEditor = lazy(() => import('./features/exams').then((module) => ({ default: module.ExamEditor })));
const ExamPlayer = lazy(() => import('./features/exams').then((module) => ({ default: module.ExamPlayer })));
const VacationCenter = lazy(() => import('./features/vacation').then((module) => ({ default: module.VacationCenter })));
const SchedulingCenter = lazy(() => import('./features/scheduling').then((module) => ({ default: module.SchedulingCenter })));

const RouteFallback = () => (
  <Center style={{ minHeight: '50vh' }}>
    <Loader size="lg" color="blue" />
  </Center>
);

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<RouteFallback />}>{element}</Suspense>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={withSuspense(<LoginPage />)} />
        
        {/* 全屏应用级页面 (考试进行中) */}
        <Route path="/app/exam-player/:planId" element={withSuspense(<ExamPlayer />)} />

        <Route path="/app" element={withSuspense(<MainLayout />)}>
          {/* 决策中心 */}
          <Route path="dashboard" element={withSuspense(<PersonalDashboard />)} />
          <Route path="admin-dashboard" element={withSuspense(<AdminDashboard />)} />
          
          {/* 人事与考核 */}
          <Route path="user-employee" element={withSuspense(<EmployeeManagement />)} />
          <Route path="user-changes" element={withSuspense(<ChangeRecords />)} />
          <Route path="hr-exam-management" element={withSuspense(<ExamCenter />)} />
          <Route path="hr-exam-editor/:id" element={withSuspense(<ExamEditor />)} />
          
          {/* 协作模块 */}
          <Route path="messaging-chat" element={withSuspense(<ChatFeature />)} />
          <Route path="messaging-broadcast" element={withSuspense(<BroadcastSystem />)} />
          
          {/* 管理与知识 */}
          <Route path="user-permission" element={withSuspense(<RBACSystem />)} />
          <Route path="system-logs" element={withSuspense(<SystemLogs />)} />
          <Route path="approval-workflow-config" element={withSuspense(<WorkflowArchitecture />)} />
          <Route path="knowledge-articles" element={withSuspense(<KnowledgeBase />)} />
          
          {/* 业务与后勤 */}
          <Route path="logistics-device-list" element={withSuspense(<DeviceList />)} />
          <Route path="quality-rules" element={withSuspense(<QualityInspection />)} /> 
          <Route path="attendance-home" element={withSuspense(<AttendanceSystem />)} />
          <Route path="attendance-schedule" element={withSuspense(<SchedulingCenter />)} />
          <Route path="vacation-details" element={withSuspense(<VacationCenter />)} />
          
          {/* 财务模块 */}
          <Route path="reimbursement-list" element={withSuspense(<ReimbursementList />)} />
          <Route path="reimbursement-apply" element={withSuspense(<ReimbursementApply />)} />
          <Route path="reimbursement-approval" element={withSuspense(<ReimbursementApproval />)} />
          
          {/* 个人中心 */}
          <Route path="personal-info" element={withSuspense(<PersonalCenter />)} />

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
