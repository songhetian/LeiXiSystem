import { Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import type { ComponentType } from 'react'
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Space, Tooltip } from '@arco-design/web-react'
import {
  IconDashboard,
  IconUserGroup,
  IconCalendar,
  IconFile,
  IconBook,
  IconSafe,
  IconMessage,
  IconSettings,
  IconMenuFold,
  IconMenuUnfold,
  IconQuestionCircle,
  IconUser,
  IconClockCircle,
  IconLink,
  IconDownload,
  IconStorage,
  IconSubscribed,
  IconTrophy,
  IconExperiment,
  IconNotification,
  IconSun,
  IconMoon,
  IconHome,
  IconRight,
  IconPoweroff,
  IconLock,
} from '@arco-design/web-react/icon'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { useAppStore } from '@/store/app'
import { hasClientPermission } from '@/components/AccessControl'
import { NotificationCenter } from '@/components'
import PageSkeleton from '@/components/PageSkeleton'
import styles from './index.module.css'
const { Header, Sider, Content } = Layout
const MenuItem = Menu.Item
const SubMenu = Menu.SubMenu

type MenuConfig = {
  key: string
  icon?: ComponentType<any>
  label: string
  children?: Array<{
    key: string
    label: string
  }>
}

const menuList: MenuConfig[] = [
  {
    key: '/dashboard',
    icon: IconDashboard,
    label: '仪表盘',
  },
  {
    key: '/dashboard/operations',
    icon: IconDashboard,
    label: '运营大屏',
  },
  {
    key: '/message-center',
    icon: IconMessage,
    label: '消息中心',
  },
  {
    key: 'personnel',
    icon: IconUserGroup,
    label: '人员管理',
    children: [
      { key: '/personnel/employee', label: '员工管理' },
      { key: '/personnel/changes', label: '人员变动' },
      { key: '/personnel/lifecycle', label: '员工生命周期' },
      { key: '/personnel/onboarding', label: '入职办理' },
      { key: '/personnel/onboarding-flow', label: '入职流程配置' },
      { key: '/personnel/employee-tag', label: '员工标签' },
      { key: '/personnel/certificate', label: '证明管理' },
    ],
  },
  {
    key: 'organization',
    icon: IconUser,
    label: '公司架构',
    children: [
      { key: '/organization/department', label: '部门管理' },
      { key: '/organization/position', label: '岗位管理' },
    ],
  },
  {
    key: 'rbac',
    icon: IconSafe,
    label: 'RBAC权限',
    children: [
      { key: '/rbac/role', label: '角色管理' },
      { key: '/rbac/permission', label: '权限管理' },
      { key: '/rbac/user-role', label: '用户授权' },
    ],
  },
  {
    key: 'security',
    icon: IconSafe,
    label: '安全中心',
    children: [
      { key: '/security/audit-logs', label: '审计日志' },
    ],
  },
  {
    key: 'system',
    icon: IconSettings,
    label: '系统管理',
    children: [
      { key: '/system/announcement', label: '公告管理' },
      { key: '/system/config', label: '配置导出导入' },
      { key: '/system/report-template', label: '报表模板' },
      { key: '/message-manage/send', label: '发送消息' },
      { key: '/message-manage/templates', label: '消息模板' },
      { key: '/message-manage/records', label: '发送记录' },
      { key: '/message-manage/stats', label: '消息统计' },
      { key: '/settings/holidays', label: '节假日日历' },
      { key: '/settings/permissions', label: '数据权限' },
    ],
  },
  {
    key: 'asset',
    icon: IconStorage,
    label: '资产管理',
    children: [
      { key: '/asset/items', label: '资产台账' },
      { key: '/asset/components', label: '配件管理' },
    ],
  },
  {
    key: 'helpdesk',
    icon: IconQuestionCircle,
    label: 'HR服务台',
    children: [
      { key: '/helpdesk/tickets', label: '服务工单' },
      { key: '/helpdesk/queue', label: '队列监控' },
      { key: '/helpdesk/sla', label: 'SLA策略' },
      { key: '/helpdesk/customers', label: '客户管理' },
      { key: '/helpdesk/canned', label: '快捷回复' },
    ],
  },
  {
    key: '/kb',
    icon: IconBook,
    label: '知识库',
  },
  {
    key: '/okr/dashboard',
    icon: IconTrophy,
    label: 'OKR',
  },
  {
    key: 'employee',
    icon: IconUser,
    label: '员工自助',
    children: [
      { key: '/employee/dashboard', label: '我的首页' },
    ],
  },
  {
    key: 'recruitment',
    icon: IconSubscribed,
    label: '招聘管理',
    children: [
      { key: '/recruitment/overview', label: '招聘总览' },
    ],
  },
  {
    key: 'performance',
    icon: IconTrophy,
    label: '绩效管理',
    children: [
      { key: '/performance/overview', label: '绩效总览' },
    ],
  },
  {
    key: 'training',
    icon: IconExperiment,
    label: '培训管理',
    children: [
      { key: '/training/overview', label: '培训总览' },
    ],
  },
  {
    key: 'shift',
    icon: IconClockCircle,
    label: '班次管理',
    children: [
      { key: '/shift/list', label: '班次列表' },
      { key: '/shift/rule', label: '班次规则' },
    ],
  },
  {
    key: 'schedule',
    icon: IconCalendar,
    label: '排班管理',
    children: [
      { key: '/schedule/calendar', label: '排班日历' },
      { key: '/schedule/weekly', label: '周排班（拖拽）' },
      { key: '/schedule/assign', label: '排班分配' },
      { key: '/schedule/rules', label: '排班规则' },
      { key: '/schedule/recommend', label: '智能排班' },
      { key: '/schedule/swaps', label: '换班申请' },
      { key: '/schedule/secondments', label: '借调管理' },
      { key: '/schedule/templates', label: '排班模板' },
      { key: '/schedule/publish', label: '发布确认' },
      { key: '/schedule/rotations', label: '轮转规则' },
      { key: '/schedule/comparison', label: '版本对比' },
      { key: '/schedule/report', label: '排班报表' },
      { key: '/my/schedule', label: '我的排班' },
    ],
  },
  {
    key: 'attendance',
    icon: IconCalendar,
    label: '考勤打卡核算',
    children: [
      { key: '/attendance/clock-in', label: '打卡' },
      { key: '/attendance/records', label: '打卡记录' },
      { key: '/attendance/calculation', label: '考勤核算' },
      { key: '/attendance/exceptions', label: '考勤异常' },
      { key: '/attendance/exception-rules', label: '异常规则' },
      { key: '/attendance/deduction-rules', label: '扣款规则' },
      { key: '/attendance/exception-stats', label: '异常统计' },
      { key: '/attendance/locations', label: '打卡位置' },
      { key: '/attendance/overtime-types', label: '加班类型' },
      { key: '/attendance/overtime-calculation', label: '加班核算' },
      { key: '/attendance/corrections', label: '补卡申请' },
      { key: '/attendance/stats', label: '考勤统计' },
      { key: '/attendance/report', label: '考勤报表' },
      { key: '/attendance/leave-overtime-report', label: '加班请假报表' },
      { key: '/attendance/attendance-detail', label: '考勤明细报表' },
      { key: '/attendance/department-ranking', label: '部门排名报表' },
      { key: '/attendance/trend-analysis', label: '同比环比分析' },
    ],
  },
  {
    key: 'payroll',
    icon: IconBook,
    label: '薪资中心',
    children: [
      { key: '/payroll/components', label: '薪资组件' },
      { key: '/payroll/structures', label: '薪资结构' },
      { key: '/payroll/structure-versions', label: '结构版本' },
      { key: '/payroll/assignments', label: '薪资分配' },
      { key: '/payroll/runs', label: '薪资批次' },
      { key: '/payroll/payslips', label: '工资条管理' },
      { key: '/payroll/adjustments', label: '薪资调整项' },
      { key: '/payroll/disputes', label: '工资条申诉' },
      { key: '/payroll/pending-settlements', label: '加班结算' },
      { key: '/payroll/my-payslips', label: '我的工资条' },
    ],
  },
  {
    key: 'vacation',
    icon: IconFile,
    label: '假期管理',
    children: [
      { key: '/vacation/types', label: '假期类型' },
      { key: '/vacation/quota', label: '假期额度' },
      { key: '/vacation/balance', label: '余额查询' },
      { key: '/vacation/carryover', label: '结转记录' },
      { key: '/vacation/policies', label: '请假策略' },
    ],
  },
  {
    key: 'reimbursement',
    icon: IconFile,
    label: '报销管理',
    children: [
      { key: '/reimbursement/apply', label: '申请报销' },
      { key: '/reimbursement/list', label: '我的报销' },
      { key: '/reimbursement/approval', label: '报销审批' },
    ],
  },
  {
    key: 'financial',
    icon: IconBook,
    label: '财务管理',
    children: [
      { key: '/financial/budgets', label: '预算管理' },
      { key: '/financial/expense-standards', label: '费用标准' },
      { key: '/financial/report', label: '财务报表' },
    ],
  },
  {
    key: 'adjustment',
    icon: IconClockCircle,
    label: '调班/加班申请',
    children: [
      { key: '/adjustment/shift-change', label: '调班申请' },
      { key: '/adjustment/overtime', label: '加班申请' },
      { key: '/adjustment/leave', label: '请假申请' },
    ],
  },
  {
    key: 'profile',
    icon: IconUser,
    label: '个人中心',
    children: [
      { key: '/profile/info', label: '个人信息' },
      { key: '/profile/password', label: '修改密码' },
      { key: '/profile/attendance', label: '我的考勤' },
      { key: '/profile/certificate', label: '证明申请' },
    ],
  },
  {
    key: 'approval',
    icon: IconFile,
    label: '审批流转',
    children: [
      { key: '/approval/pending', label: '待审批' },
      { key: '/approval/history', label: '审批历史' },
      { key: '/approval/flow', label: '审批流程配置' },
    ],
  },
  {
    key: '/visualization',
    icon: IconDashboard,
    label: '数据可视化大屏',
  },
  {
    key: 'sso',
    icon: IconLink,
    label: '单点登录',
    children: [
      { key: '/sso/config', label: 'SSO配置' },
      { key: '/sso/apps', label: '应用管理' },
    ],
  },
  {
    key: 'data',
    icon: IconDownload,
    label: 'Excel批量导入导出',
    children: [
      { key: '/data/import', label: '数据导入' },
      { key: '/data/export', label: '数据导出' },
      { key: '/data/export-tasks', label: '导出任务' },
      { key: '/data/template', label: '模板管理' },
    ],
  },
  {
    key: 'notification',
    icon: IconNotification,
    label: '实时消息通知',
    children: [
      { key: '/notification/list', label: '消息列表' },
      { key: '/notification/config', label: '通知配置' },
    ],
  },
]

const pathPermissionMap: Record<string, string | undefined> = {
  '/dashboard': 'dashboard:view',
  '/personnel/employee': 'personnel:view',
  '/personnel/changes': 'personnel:view',
  '/personnel/lifecycle': 'lifecycle:view',
  '/personnel/onboarding': 'lifecycle:manage',
  '/personnel/onboarding-flow': 'lifecycle:manage',
  '/organization/department': 'organization:view',
  '/organization/position': 'organization:view',
  '/rbac/role': 'rbac:view',
  '/rbac/permission': 'rbac:view',
  '/rbac/user-role': 'rbac:view',
  '/security/audit-logs': 'security:audit:view',
  '/asset/items': 'asset:view',
  '/helpdesk/tickets': 'helpdesk:view',
  '/recruitment/overview': 'recruitment:view',
  '/performance/overview': 'performance:view',
  '/training/overview': 'training:view',
  '/shift/list': 'shift:view',
  '/shift/rule': 'shift:view',
  '/schedule/calendar': 'schedule:view',
  '/schedule/assign': 'schedule:assign',
  '/schedule/rules': 'schedule:manage',
  '/schedule/recommend': 'schedule:assign',
  '/schedule/swaps': 'schedule:view',
  '/schedule/secondments': 'schedule:manage',
  '/schedule/templates': 'schedule:manage',
  '/schedule/publish': 'schedule:assign',
  '/attendance/records': 'attendance:view',
  '/attendance/calculation': 'attendance:calculate',
  '/attendance/exceptions': 'attendance:view',
  '/attendance/exception-rules': 'attendance:manage',
  '/attendance/exception-stats': 'attendance:view',
  '/attendance/locations': 'attendance:manage',
  '/attendance/overtime-types': 'attendance:manage',
  '/attendance/corrections': 'attendance:view',
  '/attendance/stats': 'attendance:view',
  '/attendance/report': 'attendance:view',
  '/attendance/leave-overtime-report': 'attendance:view',
  '/attendance/attendance-detail': 'attendance:view',
  '/attendance/department-ranking': 'attendance:view',
  '/attendance/trend-analysis': 'attendance:view',
  '/schedule/report': 'schedule:view',
  '/financial/report': 'finance:view',
  '/payroll/components': 'payroll:manage',
  '/payroll/structures': 'payroll:manage',
  '/payroll/assignments': 'payroll:manage',
  '/payroll/runs': 'payroll:manage',
  '/payroll/payslips': 'payroll:payslip:view-all',
  '/payroll/adjustments': 'payroll:manage',
  '/payroll/disputes': 'payroll:manage',
  '/payroll/my-payslips': 'payroll:payslip:view-self',
  '/vacation/types': 'vacation:view',
  '/vacation/quota': 'vacation:view',
  '/vacation/balance': 'vacation:view',
  '/reimbursement/apply': 'reimbursement:view',
  '/reimbursement/list': 'reimbursement:view',
  '/reimbursement/approval': 'reimbursement:view',
  '/financial/budgets': 'reimbursement:approve',
  '/financial/expense-standards': 'reimbursement:approve',
  '/adjustment/shift-change': 'attendance:view',
  '/adjustment/overtime': 'attendance:view',
  '/adjustment/leave': 'vacation:view',
  '/approval/pending': 'approval:view',
  '/approval/history': 'approval:view',
  '/approval/flow': 'approval:view',
  '/visualization': 'dashboard:view',
  '/sso/config': 'sso:manage',
  '/sso/apps': 'sso:manage',
  '/data/import': 'data:import',
  '/data/export': 'data:export',
  '/data/export-tasks': 'data:export',
  '/data/template': 'data:import',
  '/notification/config': 'rbac:view',
  '/system/announcement': 'system:announcement:manage',
  '/system/config': 'system:config',
  '/system/report-template': 'report:manage',
  '/personnel/employee-tag': 'personnel:manage',
  '/personnel/certificate': 'personnel:manage',
  '/attendance/deduction-rules': 'attendance:manage',
  '/vacation/carryover': 'vacation:manage',
  '/payroll/structure-versions': 'payroll:manage',
}

function PageLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, permissions, logoutRemote } = useAuthStore()
  const { theme, toggleTheme, sidebarCollapsed, setSidebarCollapsed } = useAppStore()

  const canAccessPath = (path: string) => hasClientPermission({
    roles: user?.roles,
    permissions,
    permission: pathPermissionMap[path],
  })

  const visibleMenuList = menuList
    .map((item) => {
      if (!item.children) {
        return canAccessPath(item.key) ? item : null
      }

      const children = item.children.filter((child) => canAccessPath(child.key))
      return children.length ? { ...item, children } : null
    })
    .filter(Boolean) as MenuConfig[]

  // Track which submenus are open — merge auto-detected + user-toggled
  const autoOpenKeys = useMemo(() => {
    const keys: string[] = []
    for (const item of visibleMenuList) {
      if (item.children) {
        const match = item.children.some((c) => c.key === location.pathname)
        if (match) keys.push(item.key)
      }
    }
    return keys
  }, [visibleMenuList, location.pathname])

  const [openKeys, setOpenKeys] = useState<string[]>(autoOpenKeys)

  // When route changes, auto-open the relevant submenu (keep user's other opens)
  useEffect(() => {
    setOpenKeys((prev) => {
      const merged = new Set([...prev, ...autoOpenKeys])
      return Array.from(merged)
    })
  }, [autoOpenKeys])

  // Handle user clicking a submenu header
  const handleClickSubMenu = useCallback((_key: string, newOpenKeys: string[]) => {
    setOpenKeys(newOpenKeys)
  }, [])

  // Auto-build breadcrumb from menuList — no more hardcoded pathMap
  const breadcrumbItems = useMemo(() => {
    const currentPath = location.pathname
    let parentLabel = ''
    let currentLabel = ''

    for (const item of visibleMenuList) {
      if (item.key === currentPath) {
        currentLabel = item.label
        break
      }
      if (item.children) {
        const child = item.children.find((c) => c.key === currentPath)
        if (child) {
          parentLabel = item.label
          currentLabel = child.label
          break
        }
      }
    }

    const items = [{ label: '首页', path: '/dashboard' }]
    if (parentLabel) items.push({ label: parentLabel, path: '' })
    if (currentLabel) items.push({ label: currentLabel, path: '' })

    return items
  }, [visibleMenuList, location.pathname])

  const handleLogout = async () => {
    await logoutRemote()
    navigate('/login')
  }

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  // Premium user dropdown with info header
  const userDropdownMenu = (
    <div className={styles['user-dropdown']}>
      <div className={styles['user-dropdown__header']}>
        <Avatar size={40} style={{ backgroundColor: '#10B981', fontSize: 16 }}>
          {user?.realName?.[0] || <IconUser />}
        </Avatar>
        <div className={styles['user-dropdown__info']}>
          <div className={styles['user-dropdown__name']}>{user?.realName || '用户'}</div>
          <div className={styles['user-dropdown__role']}>
            {user?.roles?.[0] || '管理员'}
          </div>
        </div>
      </div>
      <div className={styles['user-dropdown__divider']} />
      <Menu
        selectedKeys={[]}
        onClickMenuItem={(key: string) => {
          if (key === 'logout') handleLogout()
          else if (key === 'profile') navigate('/profile/info')
          else if (key === 'password') navigate('/profile/password')
          else if (key === 'attendance') navigate('/profile/attendance')
        }}
        style={{ border: 'none', background: 'transparent' }}
      >
        <MenuItem key="profile">
          <IconUser style={{ marginRight: 8 }} />个人信息
        </MenuItem>
        <MenuItem key="password">
          <IconLock style={{ marginRight: 8 }} />修改密码
        </MenuItem>
        <MenuItem key="attendance">
          <IconCalendar style={{ marginRight: 8 }} />我的考勤
        </MenuItem>
        <div className={styles['user-dropdown__divider']} />
        <MenuItem key="logout">
          <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center' }}>
            <IconPoweroff style={{ marginRight: 8 }} />退出登录
          </span>
        </MenuItem>
      </Menu>
    </div>
  )

  return (
    <Layout className={styles['layout-wrapper']}>
      <Sider
        className={styles['layout-sider']}
        collapsible
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        trigger={null}
        breakpoint="xl"
        width={240}
        collapsedWidth={64}
      >
        <div className={styles['sider-logo']}>
          <div className={styles['sider-logo__icon']}>雷</div>
          {!sidebarCollapsed && <span className={styles['sider-logo__text']}>雷犀系统</span>}
        </div>
        <Menu
          selectedKeys={[location.pathname]}
          openKeys={openKeys}
          onClickMenuItem={handleMenuClick}
          onClickSubMenu={handleClickSubMenu}
          style={{ width: '100%', flex: 1, overflow: 'auto' }}
          className={styles['sider-menu']}
        >
          {visibleMenuList.map((item) => {
            const IconComp = item.icon
            return item.children ? (
              <SubMenu
                key={item.key}
                title={
                  <span>
                    {IconComp ? <IconComp style={{ marginRight: 10, fontSize: 17 }} /> : null}
                    {item.label}
                  </span>
                }
              >
                {item.children.map((child) => (
                  <MenuItem key={child.key}>{child.label}</MenuItem>
                ))}
              </SubMenu>
            ) : (
              <MenuItem key={item.key}>
                {IconComp ? <IconComp style={{ marginRight: 10, fontSize: 17 }} /> : null}
                {item.label}
              </MenuItem>
            )
          })}
        </Menu>
        <div className={styles['sider-version']}>
          {sidebarCollapsed ? 'v5' : 'v5.0 · 雷犀'}
        </div>
      </Sider>
      <Layout>
        <Header className={styles['layout-header']}>
          <div className={styles['layout-header__content']}>
            <div className={styles['layout-header__left']}>
              <div
                className={styles['layout-header__menu-toggle']}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                {sidebarCollapsed ? <IconMenuUnfold /> : <IconMenuFold />}
              </div>
              <Breadcrumb className={styles['layout-header__breadcrumb']}>
                {breadcrumbItems.map((item, index) => {
                  const isLast = index === breadcrumbItems.length - 1
                  return (
                    <Breadcrumb.Item key={index}>
                      {item.path && !isLast ? (
                        <a
                          onClick={(e) => { e.preventDefault(); navigate(item.path!) }}
                          className={styles['layout-header__breadcrumb-link']}
                        >
                          {index === 0 && <IconHome style={{ marginRight: 4, fontSize: 13 }} />}
                          {item.label}
                        </a>
                      ) : (
                        <span className={isLast ? styles['layout-header__breadcrumb-current'] : undefined}>
                          {index === 0 && <IconHome style={{ marginRight: 4, fontSize: 13 }} />}
                          {item.label}
                        </span>
                      )}
                    </Breadcrumb.Item>
                  )
                })}
              </Breadcrumb>
            </div>
            <Space size={4} className={styles['layout-header__right']}>
              <NotificationCenter placement="br" />
              <Tooltip content={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}>
                <span
                  className={`${styles['layout-header__icon']} ${styles['layout-header__icon--theme']}`}
                  onClick={toggleTheme}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  aria-label={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
                >
                  {theme === 'dark' ? <IconSun /> : <IconMoon />}
                </span>
              </Tooltip>
              <Tooltip content="帮助中心">
                <span className={styles['layout-header__icon']}>
                  <IconQuestionCircle />
                </span>
              </Tooltip>
              <div className={styles['layout-header__separator']} />
              <Dropdown droplist={userDropdownMenu} position="br" trigger="click">
                <div className={styles['layout-header__user-menu']}>
                  <Avatar size={30} style={{ backgroundColor: '#10B981', fontSize: 13 }}>
                    {user?.realName?.[0] || <IconUser />}
                  </Avatar>
                  <span className={styles['layout-header__user-name']}>{user?.realName || '用户'}</span>
                  <IconRight style={{ fontSize: 12, color: 'var(--lx-gray-400, #9CA3AF)' }} />
                </div>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content className={styles['layout-content']}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  )
}

export default PageLayout
