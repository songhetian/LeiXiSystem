import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/layouts'

const Dashboard = lazy(() => import('@/pages/dashboard'))
const Employee = lazy(() => import('@/pages/personnel/employee'))
const Changes = lazy(() => import('@/pages/personnel/changes'))
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
const AttendanceStats = lazy(() => import('@/pages/attendance/stats'))
const VacationQuota = lazy(() => import('@/pages/vacation/quota'))
const ReimbursementList = lazy(() => import('@/pages/reimbursement/list'))
const Overtime = lazy(() => import('@/pages/adjustment/overtime'))
const Leave = lazy(() => import('@/pages/adjustment/leave'))
const ProfileInfo = lazy(() => import('@/pages/profile/info'))
const ProfilePassword = lazy(() => import('@/pages/profile/password'))
const ApprovalPending = lazy(() => import('@/pages/approval/pending'))
const ApprovalHistory = lazy(() => import('@/pages/approval/history'))
const ApprovalFlow = lazy(() => import('@/pages/approval/flow'))

function Loading() {
  return <div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>
}

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <h3>{title}</h3>
      <p style={{ color: '#86909C' }}>功能开发中...</p>
    </div>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* 人员管理 */}
          <Route path="personnel">
            <Route path="employee" element={<Employee />} />
            <Route path="changes" element={<Changes />} />
          </Route>

          {/* 公司架构 */}
          <Route path="organization">
            <Route path="department" element={<Department />} />
            <Route path="position" element={<Position />} />
          </Route>

          {/* RBAC权限 */}
          <Route path="rbac">
            <Route path="role" element={<Role />} />
            <Route path="permission" element={<Permission />} />
            <Route path="user-role" element={<UserRole />} />
          </Route>

          {/* 班次管理 */}
          <Route path="shift">
            <Route path="list" element={<ShiftList />} />
            <Route path="rule" element={<ShiftRule />} />
          </Route>

          {/* 排班管理 */}
          <Route path="schedule">
            <Route path="calendar" element={<ScheduleCalendar />} />
            <Route path="assign" element={<ScheduleAssign />} />
          </Route>

          {/* 考勤打卡核算 */}
          <Route path="attendance">
            <Route path="records" element={<AttendanceRecords />} />
            <Route path="calculation" element={<Placeholder title="考勤核算" />} />
            <Route path="stats" element={<AttendanceStats />} />
          </Route>

          {/* 假期管理 */}
          <Route path="vacation">
            <Route path="types" element={<Placeholder title="假期类型" />} />
            <Route path="quota" element={<VacationQuota />} />
            <Route path="balance" element={<Placeholder title="余额查询" />} />
          </Route>

          {/* 报销管理 */}
          <Route path="reimbursement">
            <Route path="apply" element={<Placeholder title="申请报销" />} />
            <Route path="list" element={<ReimbursementList />} />
            <Route path="approval" element={<Placeholder title="报销审批" />} />
          </Route>

          {/* 调班/加班申请 */}
          <Route path="adjustment">
            <Route path="shift-change" element={<Placeholder title="调班申请" />} />
            <Route path="overtime" element={<Overtime />} />
            <Route path="leave" element={<Leave />} />
          </Route>

          {/* 个人中心 */}
          <Route path="profile">
            <Route path="info" element={<ProfileInfo />} />
            <Route path="password" element={<ProfilePassword />} />
            <Route path="attendance" element={<Placeholder title="我的考勤" />} />
          </Route>

          {/* 审批流转 */}
          <Route path="approval">
            <Route path="pending" element={<ApprovalPending />} />
            <Route path="history" element={<ApprovalHistory />} />
            <Route path="flow" element={<ApprovalFlow />} />
          </Route>

          {/* 数据可视化大屏 */}
          <Route path="visualization" element={<Placeholder title="数据可视化大屏" />} />

          {/* 单点登录 */}
          <Route path="sso">
            <Route path="config" element={<Placeholder title="SSO配置" />} />
            <Route path="apps" element={<Placeholder title="应用管理" />} />
          </Route>

          {/* Excel批量导入导出 */}
          <Route path="data">
            <Route path="import" element={<Placeholder title="数据导入" />} />
            <Route path="export" element={<Placeholder title="数据导出" />} />
            <Route path="template" element={<Placeholder title="模板管理" />} />
          </Route>

          {/* 实时消息通知 */}
          <Route path="notification">
            <Route path="list" element={<Placeholder title="消息列表" />} />
            <Route path="config" element={<Placeholder title="通知配置" />} />
          </Route>

          <Route path="*" element={<Placeholder title="404 页面不存在" />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
