import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { useAuthStore } from './features/auth/store';
import { RequirePermission } from './features/auth/permission';
import { AdminLayout } from './features/layout/AdminLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { UsersPage } from './features/user/UsersPage';
import { RolesPage } from './features/rbac/RolesPage';
import { UserRolesPage } from './features/rbac/UserRolesPage';
import { LeavePage } from './features/leave/LeavePage';
import { ReimbursementsPage } from './features/reimburse/ReimbursementsPage';
import { AttendancesPage } from './features/attendance/AttendancesPage';
import { OvertimesPage } from './features/overtime/OvertimesPage';
import { MakeupsPage } from './features/makeup/MakeupsPage';
import { SalariesPage } from './features/salary/SalariesPage';
import { DepartmentsPage } from './features/dept/DepartmentsPage';
import { ShiftsPage } from './features/shift/ShiftsPage';
import { ScheduleBoardPage } from './features/shift/ScheduleBoardPage';
import { MySchedulePage } from './features/shift/MySchedulePage';
import { ScheduleTemplatesPage } from './features/shift/ScheduleTemplatesPage';
import { AttSettingPage } from './features/attSetting/AttSettingPage';
import { HolidayPage } from './features/holiday/HolidayPage';
import { LeaveTypePage } from './features/vacation/LeaveTypePage';
import { QuotaPage } from './features/vacation/QuotaPage';
import { TrendPage } from './features/vacation/TrendPage';
import { CategoriesPage } from './features/reimburse-category/CategoriesPage';
import { ExceptionsPage } from './features/exception/ExceptionsPage';
import { Forbidden } from './components/Forbidden';

/** 路由守卫：未登录访问受保护页时重定向到登录页 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        {/* 页面级 guard：权限码不满足时渲染 Forbidden */}
        <Route
          path="dashboard"
          element={
            <RequirePermission code="dashboard_view" fallback={<Forbidden />}>
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission code="user_view" fallback={<Forbidden />}>
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="roles"
          element={
            <RequirePermission code="role_view" fallback={<Forbidden />}>
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="role-assign"
          element={
            <RequirePermission code="role_assign" fallback={<Forbidden />}>
              <UserRolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="leaves"
          element={
            <RequirePermission code="leave_view" fallback={<Forbidden />}>
              <LeavePage />
            </RequirePermission>
          }
        />
        <Route
          path="reimburses"
          element={
            <RequirePermission code="reimburse_view" fallback={<Forbidden />}>
              <ReimbursementsPage />
            </RequirePermission>
          }
        />
        <Route
          path="attendance"
          element={
            <RequirePermission code="attendance_view" fallback={<Forbidden />}>
              <AttendancesPage />
            </RequirePermission>
          }
        />
        <Route
          path="overtimes"
          element={
            <RequirePermission code="overtime_view" fallback={<Forbidden />}>
              <OvertimesPage />
            </RequirePermission>
          }
        />
        <Route
          path="makeups"
          element={
            <RequirePermission code="makeup_view" fallback={<Forbidden />}>
              <MakeupsPage />
            </RequirePermission>
          }
        />
        <Route
          path="salaries"
          element={
            <RequirePermission code="salary_view" fallback={<Forbidden />}>
              <SalariesPage />
            </RequirePermission>
          }
        />
        <Route
          path="departments"
          element={
            <RequirePermission code="dept_view" fallback={<Forbidden />}>
              <DepartmentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="shifts"
          element={
            <RequirePermission code="shift_view" fallback={<Forbidden />}>
              <ShiftsPage />
            </RequirePermission>
          }
        />
        <Route
          path="schedules"
          element={
            <RequirePermission code="shift_view" fallback={<Forbidden />}>
              <ScheduleBoardPage />
            </RequirePermission>
          }
        />
        <Route
          path="my-schedule"
          element={
            <RequirePermission code="my_schedule_view" fallback={<Forbidden />}>
              <MySchedulePage />
            </RequirePermission>
          }
        />
        <Route
          path="schedule-templates"
          element={
            <RequirePermission code="schedule_template_view" fallback={<Forbidden />}>
              <ScheduleTemplatesPage />
            </RequirePermission>
          }
        />
        <Route
          path="att-setting"
          element={
            <RequirePermission code="att_setting_view" fallback={<Forbidden />}>
              <AttSettingPage />
            </RequirePermission>
          }
        />
        <Route
          path="holidays"
          element={
            <RequirePermission code="holiday_view" fallback={<Forbidden />}>
              <HolidayPage />
            </RequirePermission>
          }
        />
        <Route
          path="leave-types"
          element={
            <RequirePermission code="leave_type_view" fallback={<Forbidden />}>
              <LeaveTypePage />
            </RequirePermission>
          }
        />
        <Route
          path="leave-quotas"
          element={
            <RequirePermission code="quota_view" fallback={<Forbidden />}>
              <QuotaPage />
            </RequirePermission>
          }
        />
        <Route
          path="leave-trend"
          element={
            <RequirePermission code="quota_view" fallback={<Forbidden />}>
              <TrendPage />
            </RequirePermission>
          }
        />
        <Route
          path="reimburse-categories"
          element={
            <RequirePermission code="reimburse_category_view" fallback={<Forbidden />}>
              <CategoriesPage />
            </RequirePermission>
          }
        />
        <Route
          path="att-exceptions"
          element={
            <RequirePermission code="att_exception_view" fallback={<Forbidden />}>
              <ExceptionsPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<Forbidden />} />
      </Route>
    </Routes>
  );
}