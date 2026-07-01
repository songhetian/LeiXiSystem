const preloadedModules = new Set<string>()

const pageImports: Record<string, () => Promise<any>> = {
  '/dashboard': () => import('@/pages/dashboard'),
  '/personnel/employee': () => import('@/pages/personnel/employee'),
  '/personnel/changes': () => import('@/pages/personnel/changes'),
  '/personnel/lifecycle': () => import('@/pages/personnel/lifecycle'),
  '/personnel/onboarding': () => import('@/pages/personnel/onboarding'),
  '/personnel/onboarding-flow': () => import('@/pages/personnel/onboarding-flow'),
  '/organization/department': () => import('@/pages/organization/department'),
  '/organization/position': () => import('@/pages/organization/position'),
  '/rbac/role': () => import('@/pages/rbac/role'),
  '/rbac/permission': () => import('@/pages/rbac/permission'),
  '/rbac/user-role': () => import('@/pages/rbac/user-role'),
  '/shift/list': () => import('@/pages/shift/list'),
  '/shift/rule': () => import('@/pages/shift/rule'),
  '/schedule/calendar': () => import('@/pages/schedule/calendar'),
  '/schedule/assign': () => import('@/pages/schedule/assign'),
  '/schedule/rules': () => import('@/pages/schedule/rules'),
  '/schedule/recommend': () => import('@/pages/schedule/recommend'),
  '/schedule/swaps': () => import('@/pages/schedule/swaps'),
  '/schedule/secondments': () => import('@/pages/schedule/secondments'),
  '/schedule/templates': () => import('@/pages/schedule/templates'),
  '/schedule/publish': () => import('@/pages/schedule/publish'),
  '/schedule/my': () => import('@/pages/schedule/my'),
  '/attendance/records': () => import('@/pages/attendance/records'),
  '/attendance/calculation': () => import('@/pages/attendance/calculation'),
  '/attendance/exceptions': () => import('@/pages/attendance/exceptions'),
  '/attendance/exception-rules': () => import('@/pages/attendance/exception-rules'),
  '/attendance/exception-stats': () => import('@/pages/attendance/exception-stats'),
  '/attendance/locations': () => import('@/pages/attendance/locations'),
  '/attendance/overtime-types': () => import('@/pages/attendance/overtime-types'),
  '/attendance/corrections': () => import('@/pages/attendance/corrections'),
  '/attendance/stats': () => import('@/pages/attendance/stats'),
  '/attendance/report': () => import('@/pages/attendance/report'),
  '/attendance/leave-overtime-report': () => import('@/pages/attendance/leave-overtime-report'),
  '/attendance/attendance-detail': () => import('@/pages/attendance/attendance-detail'),
  '/attendance/department-ranking': () => import('@/pages/attendance/department-ranking'),
  '/attendance/trend-analysis': () => import('@/pages/attendance/trend-analysis'),
  '/schedule/report': () => import('@/pages/schedule/report'),
  '/finance/report': () => import('@/pages/finance/report'),
  '/vacation/types': () => import('@/pages/vacation/types'),
  '/vacation/quota': () => import('@/pages/vacation/quota'),
  '/vacation/balance': () => import('@/pages/vacation/balance'),
  '/reimbursement/apply': () => import('@/pages/reimbursement/apply'),
  '/reimbursement/list': () => import('@/pages/reimbursement/list'),
  '/reimbursement/approval': () => import('@/pages/reimbursement/approval'),
  '/adjustment/shift-change': () => import('@/pages/adjustment/shift-change'),
  '/adjustment/overtime': () => import('@/pages/adjustment/overtime'),
  '/adjustment/leave': () => import('@/pages/adjustment/leave'),
  '/profile/info': () => import('@/pages/profile/info'),
  '/profile/password': () => import('@/pages/profile/password'),
  '/profile/attendance': () => import('@/pages/profile/attendance'),
  '/approval/pending': () => import('@/pages/approval/pending'),
  '/financial/budgets': () => import('@/pages/financial/budgets'),
  '/financial/expense-standards': () => import('@/pages/financial/expense-standards'),
  '/approval/history': () => import('@/pages/approval/history'),
  '/approval/flow': () => import('@/pages/approval/flow'),
  '/visualization': () => import('@/pages/visualization'),
  '/sso/config': () => import('@/pages/sso/config'),
  '/sso/apps': () => import('@/pages/sso/apps'),
  '/data/import': () => import('@/pages/data/import'),
  '/data/export': () => import('@/pages/data/export'),
  '/data/template': () => import('@/pages/data/template'),
  '/data/export-tasks': () => import('@/pages/data/export-tasks'),
  '/notification/list': () => import('@/pages/notification/list'),
  '/notification/config': () => import('@/pages/notification/config'),
  '/payroll/components': () => import('@/pages/payroll/components'),
  '/payroll/structures': () => import('@/pages/payroll/structures'),
  '/payroll/assignments': () => import('@/pages/payroll/assignments'),
  '/payroll/runs': () => import('@/pages/payroll/runs'),
  '/payroll/payslips': () => import('@/pages/payroll/payslips'),
  '/payroll/adjustments': () => import('@/pages/payroll/adjustments'),
  '/payroll/disputes': () => import('@/pages/payroll/disputes'),
  '/payroll/my-payslips': () => import('@/pages/payroll/my-payslips'),
  '/security/audit-logs': () => import('@/pages/security/audit-logs'),
  '/asset/items': () => import('@/pages/asset/items'),
  '/helpdesk/tickets': () => import('@/pages/helpdesk/tickets'),
  '/recruitment/overview': () => import('@/pages/recruitment/overview'),
  '/performance/overview': () => import('@/pages/performance/overview'),
  '/training/overview': () => import('@/pages/training/overview'),
  '/system/announcement': () => import('@/pages/system/announcement'),
  '/personnel/employee-tag': () => import('@/pages/personnel/employee-tag'),
}

export function preloadRoute(path: string): void {
  if (preloadedModules.has(path)) return

  const importFn = pageImports[path]
  if (!importFn) return

  preloadedModules.add(path)

  importFn().catch(() => {
    preloadedModules.delete(path)
  })
}

export function preloadRoutes(paths: string[]): void {
  paths.forEach(preloadRoute)
}

export function isPreloaded(path: string): boolean {
  return preloadedModules.has(path)
}

export default preloadRoute
