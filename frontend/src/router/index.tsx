import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/layouts'
import { RouteGuard } from '@/components/AccessControl'
import styles from './index.module.css'
const Dashboard = lazy(() => import('@/pages/dashboard'))
const Employee = lazy(() => import('@/pages/personnel/employee'))
const Changes = lazy(() => import('@/pages/personnel/changes'))
const Lifecycle = lazy(() => import('@/pages/personnel/lifecycle'))
const OnboardingFlow = lazy(() => import('@/pages/personnel/onboarding-flow'))
const Onboarding = lazy(() => import('@/pages/personnel/onboarding'))
const Department = lazy(() => import('@/pages/organization/department'))
const Position = lazy(() => import('@/pages/organization/position'))
const Role = lazy(() => import('@/pages/rbac/role'))
const Permission = lazy(() => import('@/pages/rbac/permission'))
const UserRole = lazy(() => import('@/pages/rbac/user-role'))
const ShiftList = lazy(() => import('@/pages/shift/list'))
const ShiftRule = lazy(() => import('@/pages/shift/rule'))
const ScheduleCalendar = lazy(() => import('@/pages/schedule/calendar'))
const ScheduleWeekly = lazy(() => import('@/pages/schedule/weekly'))
const ScheduleAssign = lazy(() => import('@/pages/schedule/assign'))
const ScheduleRules = lazy(() => import('@/pages/schedule/rules'))
const ScheduleRecommend = lazy(() => import('@/pages/schedule/recommend'))
const ScheduleSwaps = lazy(() => import('@/pages/schedule/swaps'))
const ScheduleSecondments = lazy(() => import('@/pages/schedule/secondments'))
const ScheduleTemplates = lazy(() => import('@/pages/schedule/templates'))
const SchedulePublish = lazy(() => import('@/pages/schedule/publish'))
const MySchedule = lazy(() => import('@/pages/schedule/my'))
const AttendanceClockIn = lazy(() => import('@/pages/attendance/clock-in'))
const AttendanceRecords = lazy(() => import('@/pages/attendance/records'))
const AttendanceCalculation = lazy(() => import('@/pages/attendance/calculation'))
const AttendanceExceptions = lazy(() => import('@/pages/attendance/exceptions'))
const AttendanceExceptionRules = lazy(() => import('@/pages/attendance/exception-rules'))
const AttendanceExceptionStats = lazy(() => import('@/pages/attendance/exception-stats'))
const AttendanceLocations = lazy(() => import('@/pages/attendance/locations'))
const AttendanceOvertimeTypes = lazy(() => import('@/pages/attendance/overtime-types'))
const AttendanceCorrections = lazy(() => import('@/pages/attendance/corrections'))
const AttendanceStats = lazy(() => import('@/pages/attendance/stats'))
const AttendanceReport = lazy(() => import('@/pages/attendance/report'))
const LeaveOvertimeReport = lazy(() => import('@/pages/attendance/leave-overtime-report'))
const AttendanceDetail = lazy(() => import('@/pages/attendance/attendance-detail'))
const DepartmentRanking = lazy(() => import('@/pages/attendance/department-ranking'))
const TrendAnalysis = lazy(() => import('@/pages/attendance/trend-analysis'))
const ScheduleReport = lazy(() => import('@/pages/schedule/report'))
const FinanceReport = lazy(() => import('@/pages/finance/report'))
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
const FinancialBudgets = lazy(() => import('@/pages/financial/budgets'))
const ExpenseStandards = lazy(() => import('@/pages/financial/expense-standards'))
const ApprovalHistory = lazy(() => import('@/pages/approval/history'))
const ApprovalFlow = lazy(() => import('@/pages/approval/flow'))
const Visualization = lazy(() => import('@/pages/visualization'))
const SsoConfig = lazy(() => import('@/pages/sso/config'))
const SsoApps = lazy(() => import('@/pages/sso/apps'))
const DataImport = lazy(() => import('@/pages/data/import'))
const DataExport = lazy(() => import('@/pages/data/export'))
const DataTemplate = lazy(() => import('@/pages/data/template'))
const ExportTasks = lazy(() => import('@/pages/data/export-tasks'))
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
const AnnouncementManage = lazy(() => import('@/pages/system/announcement'))
const EmployeeTagManage = lazy(() => import('@/pages/personnel/employee-tag'))
const ConfigExportImport = lazy(() => import('@/pages/system/config'))
const ReportTemplate = lazy(() => import('@/pages/system/report-template'))
const MessageCenter = lazy(() => import('@/pages/message-center'))
const MessageSend = lazy(() => import('@/pages/message-manage/send'))
const MessageTemplates = lazy(() => import('@/pages/message-manage/templates'))
const MessageRecords = lazy(() => import('@/pages/message-manage/records'))
const MessageStats = lazy(() => import('@/pages/message-manage/stats'))
const MessagePreferences = lazy(() => import('@/pages/message-manage/preferences'))

// P0 新增页面
const DeductionRules = lazy(() => import('@/pages/attendance/deduction-rules'))
const VacationCarryover = lazy(() => import('@/pages/vacation/carryover'))
const StructureVersions = lazy(() => import('@/pages/payroll/structure-versions'))
const MyCertificate = lazy(() => import('@/pages/employee/certificate'))
const CertificateManage = lazy(() => import('@/pages/employee/certificate-manage'))

// P1 新增页面
const AttendanceMonthly = lazy(() => import('@/pages/attendance/monthly'))
const MyInfoChange = lazy(() => import('@/pages/personnel/my-info-change'))
const InfoChangeApproval = lazy(() => import('@/pages/personnel/change-approval'))
const Settings = lazy(() => import('@/pages/settings'))
const Holidays = lazy(() => import('@/pages/settings/holidays'))
const KbPage = lazy(() => import('@/pages/kb'))
const SlaConfig = lazy(() => import('@/pages/helpdesk/sla'))
const CustomersPage = lazy(() => import('@/pages/helpdesk/customers'))
const CannedResponsesPage = lazy(() => import('@/pages/helpdesk/canned'))
const QueueMonitorPage = lazy(() => import('@/pages/helpdesk/queue'))
const OvertimeCalcPage = lazy(() => import('@/pages/attendance/overtime-calculation'))
const OperationsDashboardPage = lazy(() => import('@/pages/dashboard/operations'))
const EmployeePortalPage = lazy(() => import('@/pages/employee/portal'))
const OkrPage = lazy(() => import('@/pages/okr'))
const RotationsPage = lazy(() => import('@/pages/schedule/rotations'))
const ScheduleComparisonPage = lazy(() => import('@/pages/schedule/comparison'))
const LeavePoliciesPage = lazy(() => import('@/pages/vacation/policies'))
const PayrollSettlementPage = lazy(() => import('@/pages/payroll/pending-settlements'))
const AssetComponentsPage = lazy(() => import('@/pages/asset/components'))
const DataPermissionsPage = lazy(() => import('@/pages/settings/permissions'))

function protect(element: JSX.Element, permission?: string) {
  return <RouteGuard permission={permission}>{element}</RouteGuard>
}

function AppRoutes() {
  return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={protect(<Dashboard />, 'dashboard:view')} />
          <Route path="dashboard/operations" element={protect(<OperationsDashboardPage />, 'dashboard:view')} />

          {/* 人员管理 */}
          <Route path="personnel">
            <Route path="employee" element={protect(<Employee />, 'personnel:view')} />
            <Route path="changes" element={protect(<Changes />, 'personnel:view')} />
            <Route path="lifecycle" element={protect(<Lifecycle />, 'lifecycle:view')} />
            <Route path="onboarding" element={protect(<Onboarding />, 'lifecycle:manage')} />
            <Route path="onboarding-flow" element={protect(<OnboardingFlow />, 'lifecycle:manage')} />
            <Route path="employee-tag" element={protect(<EmployeeTagManage />, 'personnel:manage')} />
            <Route path="certificate" element={protect(<CertificateManage />, 'personnel:manage')} />
            <Route path="info-change-approval" element={protect(<InfoChangeApproval />, 'personnel:edit')} />
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
            <Route path="weekly" element={protect(<ScheduleWeekly />, 'schedule:assign')} />
            <Route path="assign" element={protect(<ScheduleAssign />, 'schedule:assign')} />
            <Route path="rules" element={protect(<ScheduleRules />, 'schedule:manage')} />
            <Route path="recommend" element={protect(<ScheduleRecommend />, 'schedule:assign')} />
            <Route path="swaps" element={protect(<ScheduleSwaps />, 'schedule:view')} />
            <Route path="secondments" element={protect(<ScheduleSecondments />, 'schedule:manage')} />
            <Route path="templates" element={protect(<ScheduleTemplates />, 'schedule:manage')} />
            <Route path="publish" element={protect(<SchedulePublish />, 'schedule:assign')} />
            <Route path="report" element={protect(<ScheduleReport />, 'schedule:view')} />
            <Route path="rotations" element={protect(<RotationsPage />, 'schedule:manage')} />
            <Route path="comparison" element={protect(<ScheduleComparisonPage />, 'schedule:view')} />
          </Route>
          <Route path="/my" element={<MySchedule />} />

          {/* 考勤打卡核算 */}
          <Route path="attendance">
            <Route path="records" element={protect(<AttendanceRecords />, 'attendance:view')} />
            <Route path="calculation" element={protect(<AttendanceCalculation />, 'attendance:calculate')} />
            <Route path="exceptions" element={protect(<AttendanceExceptions />, 'attendance:view')} />
            <Route path="exception-rules" element={protect(<AttendanceExceptionRules />, 'attendance:manage')} />
            <Route path="exception-stats" element={protect(<AttendanceExceptionStats />, 'attendance:view')} />
            <Route path="locations" element={protect(<AttendanceLocations />, 'attendance:manage')} />
            <Route path="overtime-types" element={protect(<AttendanceOvertimeTypes />, 'attendance:manage')} />
            <Route path="overtime-calculation" element={protect(<OvertimeCalcPage />, 'attendance:calculate')} />
            <Route path="corrections" element={protect(<AttendanceCorrections />, 'attendance:view')} />
            <Route path="stats" element={protect(<AttendanceStats />, 'attendance:view')} />
            <Route path="report" element={protect(<AttendanceReport />, 'attendance:view')} />
            <Route path="leave-overtime-report" element={protect(<LeaveOvertimeReport />, 'attendance:view')} />
            <Route path="attendance-detail" element={protect(<AttendanceDetail />, 'attendance:view')} />
            <Route path="department-ranking" element={protect(<DepartmentRanking />, 'attendance:view')} />
            <Route path="trend-analysis" element={protect(<TrendAnalysis />, 'attendance:view')} />
            <Route path="deduction-rules" element={protect(<DeductionRules />, 'attendance:manage')} />
            <Route path="monthly" element={protect(<AttendanceMonthly />, 'attendance:calculate')} />
          </Route>

          {/* 薪资中心 */}
          <Route path="payroll">
            <Route path="components" element={protect(<PayrollComponents />, 'payroll:manage')} />
            <Route path="structures" element={protect(<PayrollStructures />, 'payroll:manage')} />
            <Route path="structure-versions" element={protect(<StructureVersions />, 'payroll:manage')} />
            <Route path="assignments" element={protect(<PayrollAssignments />, 'payroll:manage')} />
            <Route path="runs" element={protect(<PayrollRuns />, 'payroll:manage')} />
            <Route path="payslips" element={protect(<PayrollPayslips />, 'payroll:payslip:view-all')} />
            <Route path="adjustments" element={protect(<PayrollAdjustments />, 'payroll:manage')} />
            <Route path="disputes" element={protect(<PayrollDisputes />, 'payroll:manage')} />
            <Route path="my-payslips" element={protect(<MyPayslips />, 'payroll:payslip:view-self')} />
            <Route path="pending-settlements" element={protect(<PayrollSettlementPage />, 'payroll:manage')} />
          </Route>

          {/* 安全中心 */}
          <Route path="security">
            <Route path="audit-logs" element={protect(<AuditLogs />, 'security:audit:view')} />
          </Route>

          {/* 系统管理 */}
          <Route path="system">
            <Route path="announcement" element={protect(<AnnouncementManage />, 'system:announcement:manage')} />
            <Route path="config" element={protect(<ConfigExportImport />, 'system:config')} />
            <Route path="report-template" element={protect(<ReportTemplate />, 'report:manage')} />
          </Route>

          {/* 资产管理 */}
          <Route path="asset">
            <Route path="items" element={protect(<AssetItems />, 'asset:view')} />
            <Route path="components" element={protect(<AssetComponentsPage />, 'asset:manage')} />
          </Route>

          {/* HR Help Desk */}
          <Route path="helpdesk">
            <Route path="tickets" element={protect(<HelpdeskTickets />, 'helpdesk:view')} />
            <Route path="sla" element={protect(<SlaConfig />, 'helpdesk:manage')} />
            <Route path="customers" element={protect(<CustomersPage />, 'helpdesk:view')} />
            <Route path="canned" element={protect(<CannedResponsesPage />, 'helpdesk:manage')} />
            <Route path="queue" element={protect(<QueueMonitorPage />, 'helpdesk:view')} />
          </Route>

          {/* 知识库 */}
          <Route path="kb" element={<KbPage />} />

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
            <Route path="carryover" element={protect(<VacationCarryover />, 'vacation:manage')} />
            <Route path="policies" element={protect(<LeavePoliciesPage />, 'vacation:manage')} />
          </Route>

          {/* 报销管理 */}
          <Route path="reimbursement">
            <Route path="apply" element={protect(<ReimbursementApply />, 'reimbursement:view')} />
            <Route path="list" element={protect(<ReimbursementList />, 'reimbursement:view')} />
            <Route path="approval" element={protect(<ReimbursementApproval />, 'reimbursement:view')} />
          </Route>

          {/* 财务管理 */}
          <Route path="financial">
            <Route path="budgets" element={protect(<FinancialBudgets />, 'reimbursement:approve')} />
            <Route path="expense-standards" element={protect(<ExpenseStandards />, 'reimbursement:approve')} />
            <Route path="report" element={protect(<FinanceReport />, 'finance:view')} />
          </Route>

          {/* 调班/加班申请 */}
          <Route path="adjustment">
            <Route path="shift-change" element={protect(<ShiftChange />, 'attendance:view')} />
            <Route path="overtime" element={protect(<Overtime />, 'attendance:view')} />
            <Route path="leave" element={protect(<Leave />, 'vacation:view')} />
          </Route>

          {/* 员工自助 */}
          <Route path="employee/dashboard" element={<EmployeePortalPage />} />

          {/* OKR */}
          <Route path="okr/dashboard" element={protect(<OkrPage />, 'performance:view')} />

          {/* 个人中心 */}
          <Route path="profile">
            <Route path="info" element={<ProfileInfo />} />
            <Route path="password" element={<ProfilePassword />} />
            <Route path="attendance" element={<ProfileAttendance />} />
            <Route path="certificate" element={<MyCertificate />} />
            <Route path="info-change" element={<MyInfoChange />} />
          </Route>

          {/* 系统设置 */}
          <Route path="settings" element={<Settings />} />
          <Route path="settings/holidays" element={<Holidays />} />
          <Route path="settings/permissions" element={protect(<DataPermissionsPage />, 'rbac:view')} />

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
            <Route path="export-tasks" element={protect(<ExportTasks />, 'data:export')} />
            <Route path="template" element={protect(<DataTemplate />, 'data:import')} />
          </Route>

          {/* 实时消息通知 */}
          <Route path="notification">
            <Route path="list" element={<NotificationList />} />
            <Route path="config" element={protect(<NotificationConfig />, 'rbac:view')} />
          </Route>

          {/* 消息中心 */}
          <Route path="message-center" element={<MessageCenter />} />
          <Route path="message-manage">
            <Route path="send" element={protect(<MessageSend />, 'system:announcement:manage')} />
            <Route path="templates" element={protect(<MessageTemplates />, 'system:announcement:manage')} />
            <Route path="records" element={protect(<MessageRecords />, 'system:announcement:manage')} />
            <Route path="stats" element={protect(<MessageStats />, 'system:announcement:manage')} />
            <Route path="preferences" element={<MessagePreferences />} />
          </Route>

          <Route path="*" element={<div className={styles['router-not-found']}><h3>404 页面不存在</h3></div>} />
        </Route>
      </Routes>
  )
}

export default AppRoutes
