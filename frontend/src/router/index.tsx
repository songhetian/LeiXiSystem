import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/layouts'
import { RouteGuard } from '@/components/AccessControl'

const Dashboard = lazy(() => import('@/pages/dashboard'))
const Employee = lazy(() => import('@/pages/personnel/employee'))
const Changes = lazy(() => import('@/pages/personnel/changes'))
const Lifecycle = lazy(() => import('@/pages/personnel/lifecycle'))
const Department = lazy(() => import('@/pages/organization/department'))
const Position = lazy(() => import('@/pages/organization/position'))
const Role = lazy(() => import('@/pages/rbac/role'))
const Permission = lazy(() => import('@/pages/rbac/permission'))
const UserRole = lazy(() => import('@/pages/rbac/user-role'))
const ShiftList = lazy(() => import('@/pages/shift/list'))
const ShiftRule = lazy(() => import('@/pages/shift/rule'))
const ScheduleCalendar = lazy(() => import('@/pages/schedule/calendar'))
const ScheduleAssign = lazy(() => import('@/pages/schedule/assign'))
const AttendanceRecords = lazy(() => import('@/pages/attendance/records'))
const AttendanceCalculation = lazy(() => import('@/pages/attendance/calculation'))
const AttendanceExceptions = lazy(() => import('@/pages/attendance/exceptions'))
const AttendanceCorrections = lazy(() => import('@/pages/attendance/corrections'))
const AttendanceStats = lazy(() => import('@/pages/attendance/stats'))
const VacationTypes = lazy(() => import('@/pages/vacation/types'))
const VacationQuota = lazy(() => import('@/pages/vacation/quota'))
const VacationBalance = lazy(() => import('@/pages/vacation/balance'))
const ReimbursementApply = lazy(() => import('@/pages/reimbursement/apply'))
const ReimbursementList = lazy(() => import('@/pages/reimbursement/list'))
const ReimbursementApproval = lazy(() => import('@/pages/reimbursement/approval'))
const ShiftChange = lazy(() => import('@/pages/adjustment/shift-change'))
const Overtime = lazy(() => import('@/pages/adjustment/overtime'))
const Leave = lazy(() => import('@/pages/adjustment/leave'))
const ProfileInfo = lazy(() => import('@/pages/profile/info'))
const ProfilePassword = lazy(() => import('@/pages/profile/password'))
const ProfileAttendance = lazy(() => import('@/pages/profile/attendance'))
const ApprovalPending = lazy(() => import('@/pages/approval/pending'))
const ApprovalHistory = lazy(() => import('@/pages/approval/history'))
const ApprovalFlow = lazy(() => import('@/pages/approval/flow'))
const Visualization = lazy(() => import('@/pages/visualization'))
const SsoConfig = lazy(() => import('@/pages/sso/config'))
const SsoApps = lazy(() => import('@/pages/sso/apps'))
const DataImport = lazy(() => import('@/pages/data/import'))
const DataExport = lazy(() => import('@/pages/data/export'))
const DataTemplate = lazy(() => import('@/pages/data/template'))
const NotificationList = lazy(() => import('@/pages/notification/list'))
const NotificationConfig = lazy(() => import('@/pages/notification/config'))
const PayrollComponents = lazy(() => import('@/pages/payroll/components'))
const PayrollStructures = lazy(() => import('@/pages/payroll/structures'))
const PayrollAssignments = lazy(() => import('@/pages/payroll/assignments'))
const PayrollRuns = lazy(() => import('@/pages/payroll/runs'))
const PayrollPayslips = lazy(() => import('@/pages/payroll/payslips'))
const PayrollAdjustments = lazy(() => import('@/pages/payroll/adjustments'))
const PayrollDisputes = lazy(() => import('@/pages/payroll/disputes'))
const MyPayslips = lazy(() => import('@/pages/payroll/my-payslips'))
const AuditLogs = lazy(() => import('@/pages/security/audit-logs'))
const AssetItems = lazy(() => import('@/pages/asset/items'))
const HelpdeskTickets = lazy(() => import('@/pages/helpdesk/tickets'))
const RecruitmentOverview = lazy(() => import('@/pages/recruitment/overview'))
const PerformanceOverview = lazy(() => import('@/pages/performance/overview'))
const TrainingOverview = lazy(() => import('@/pages/training/overview'))

function Loading() {
  return <div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>
}

function protect(element: JSX.Element, permission?: string) {
  return <RouteGuard permission={permission}>{element}</RouteGuard>
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={protect(<Dashboard />, 'dashboard:view')} />

          {/* 人员管理 */}
          <Route path="personnel">
            <Route path="employee" element={protect(<Employee />, 'personnel:view')} />
            <Route path="changes" element={protect(<Changes />, 'personnel:view')} />
            <Route path="lifecycle" element={protect(<Lifecycle />, 'lifecycle:view')} />
          </Route>

          {/* 公司架构 */}
          <Route path="organization">
            <Route path="department" element={protect(<Department />, 'organization:view')} />
            <Route path="position" element={protect(<Position />, 'organization:view')} />
          </Route>

          {/* RBAC权限 */}
          <Route path="rbac">
            <Route path="role" element={protect(<Role />, 'rbac:view')} />
            <Route path="permission" element={protect(<Permission />, 'rbac:view')} />
            <Route path="user-role" element={protect(<UserRole />, 'rbac:view')} />
          </Route>

          {/* 班次管理 */}
          <Route path="shift">
            <Route path="list" element={protect(<ShiftList />, 'shift:view')} />
            <Route path="rule" element={protect(<ShiftRule />, 'shift:view')} />
          </Route>

          {/* 排班管理 */}
          <Route path="schedule">
            <Route path="calendar" element={protect(<ScheduleCalendar />, 'schedule:view')} />
            <Route path="assign" element={protect(<ScheduleAssign />, 'schedule:assign')} />
          </Route>

          {/* 考勤打卡核算 */}
          <Route path="attendance">
            <Route path="records" element={protect(<AttendanceRecords />, 'attendance:view')} />
            <Route path="calculation" element={protect(<AttendanceCalculation />, 'attendance:calculate')} />
            <Route path="exceptions" element={protect(<AttendanceExceptions />, 'attendance:view')} />
            <Route path="corrections" element={protect(<AttendanceCorrections />, 'attendance:view')} />
            <Route path="stats" element={protect(<AttendanceStats />, 'attendance:view')} />
          </Route>

          {/* 薪资中心 */}
          <Route path="payroll">
            <Route path="components" element={protect(<PayrollComponents />, 'payroll:manage')} />
            <Route path="structures" element={protect(<PayrollStructures />, 'payroll:manage')} />
            <Route path="assignments" element={protect(<PayrollAssignments />, 'payroll:manage')} />
            <Route path="runs" element={protect(<PayrollRuns />, 'payroll:manage')} />
            <Route path="payslips" element={protect(<PayrollPayslips />, 'payroll:payslip:view-all')} />
            <Route path="adjustments" element={protect(<PayrollAdjustments />, 'payroll:manage')} />
            <Route path="disputes" element={protect(<PayrollDisputes />, 'payroll:manage')} />
            <Route path="my-payslips" element={protect(<MyPayslips />, 'payroll:payslip:view-self')} />
          </Route>

          {/* 安全中心 */}
          <Route path="security">
            <Route path="audit-logs" element={protect(<AuditLogs />, 'security:audit:view')} />
          </Route>

          {/* 资产管理 */}
          <Route path="asset">
            <Route path="items" element={protect(<AssetItems />, 'asset:view')} />
          </Route>

          {/* HR Help Desk */}
          <Route path="helpdesk">
            <Route path="tickets" element={protect(<HelpdeskTickets />, 'helpdesk:view')} />
          </Route>

          {/* 招聘管理 */}
          <Route path="recruitment">
            <Route path="overview" element={protect(<RecruitmentOverview />, 'recruitment:view')} />
          </Route>

          {/* 绩效管理 */}
          <Route path="performance">
            <Route path="overview" element={protect(<PerformanceOverview />, 'performance:view')} />
          </Route>

          {/* 培训管理 */}
          <Route path="training">
            <Route path="overview" element={protect(<TrainingOverview />, 'training:view')} />
          </Route>

          {/* 假期管理 */}
          <Route path="vacation">
            <Route path="types" element={protect(<VacationTypes />, 'vacation:view')} />
            <Route path="quota" element={protect(<VacationQuota />, 'vacation:view')} />
            <Route path="balance" element={protect(<VacationBalance />, 'vacation:view')} />
          </Route>

          {/* 报销管理 */}
          <Route path="reimbursement">
            <Route path="apply" element={protect(<ReimbursementApply />, 'reimbursement:view')} />
            <Route path="list" element={protect(<ReimbursementList />, 'reimbursement:view')} />
            <Route path="approval" element={protect(<ReimbursementApproval />, 'reimbursement:view')} />
          </Route>

          {/* 调班/加班申请 */}
          <Route path="adjustment">
            <Route path="shift-change" element={protect(<ShiftChange />, 'attendance:view')} />
            <Route path="overtime" element={protect(<Overtime />, 'attendance:view')} />
            <Route path="leave" element={protect(<Leave />, 'vacation:view')} />
          </Route>

          {/* 个人中心 */}
          <Route path="profile">
            <Route path="info" element={<ProfileInfo />} />
            <Route path="password" element={<ProfilePassword />} />
            <Route path="attendance" element={<ProfileAttendance />} />
          </Route>

          {/* 审批流转 */}
          <Route path="approval">
            <Route path="pending" element={protect(<ApprovalPending />, 'approval:view')} />
            <Route path="history" element={protect(<ApprovalHistory />, 'approval:view')} />
            <Route path="flow" element={protect(<ApprovalFlow />, 'approval:view')} />
          </Route>

          {/* 数据可视化大屏 */}
          <Route path="visualization" element={protect(<Visualization />, 'dashboard:view')} />

          {/* 单点登录 */}
          <Route path="sso">
            <Route path="config" element={protect(<SsoConfig />, 'sso:manage')} />
            <Route path="apps" element={protect(<SsoApps />, 'sso:manage')} />
          </Route>

          {/* Excel批量导入导出 */}
          <Route path="data">
            <Route path="import" element={protect(<DataImport />, 'data:import')} />
            <Route path="export" element={protect(<DataExport />, 'data:export')} />
            <Route path="template" element={protect(<DataTemplate />, 'data:import')} />
          </Route>

          {/* 实时消息通知 */}
          <Route path="notification">
            <Route path="list" element={<NotificationList />} />
            <Route path="config" element={protect(<NotificationConfig />, 'rbac:view')} />
          </Route>

          <Route path="*" element={<div style={{ padding: 40, textAlign: 'center' }}><h3>404 页面不存在</h3></div>} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
