import { useState } from 'react'
import type { ComponentType } from 'react'
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Badge, Space, Divider } from '@arco-design/web-react'
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
  IconNotification,
  IconQuestionCircle,
  IconUser,
  IconClockCircle,
  IconLink,
  IconDownload,
  IconStorage,
  IconSubscribed,
  IconTrophy,
  IconExperiment,
} from '@arco-design/web-react/icon'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@/store/user'
import { hasClientPermission } from '@/components/AccessControl'
import './index.css'

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
    ],
  },
  {
    key: 'asset',
    icon: IconStorage,
    label: '资产管理',
    children: [
      { key: '/asset/items', label: '资产台账' },
    ],
  },
  {
    key: 'helpdesk',
    icon: IconQuestionCircle,
    label: 'HR服务台',
    children: [
      { key: '/helpdesk/tickets', label: '服务工单' },
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
      { key: '/schedule/assign', label: '排班分配' },
      { key: '/schedule/rules', label: '排班规则' },
      { key: '/schedule/recommend', label: '智能排班' },
      { key: '/schedule/swaps', label: '换班申请' },
      { key: '/schedule/secondments', label: '借调管理' },
      { key: '/schedule/templates', label: '排班模板' },
      { key: '/schedule/publish', label: '发布确认' },
      { key: '/schedule/report', label: '排班报表' },
      { key: '/my/schedule', label: '我的排班' },
    ],
  },
  {
    key: 'attendance',
    icon: IconCalendar,
    label: '考勤打卡核算',
    children: [
      { key: '/attendance/records', label: '打卡记录' },
      { key: '/attendance/calculation', label: '考勤核算' },
      { key: '/attendance/exceptions', label: '考勤异常' },
      { key: '/attendance/exception-rules', label: '异常规则' },
      { key: '/attendance/exception-stats', label: '异常统计' },
      { key: '/attendance/locations', label: '打卡位置' },
      { key: '/attendance/overtime-types', label: '加班类型' },
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
      { key: '/payroll/assignments', label: '薪资分配' },
      { key: '/payroll/runs', label: '薪资批次' },
      { key: '/payroll/payslips', label: '工资条管理' },
      { key: '/payroll/adjustments', label: '薪资调整项' },
      { key: '/payroll/disputes', label: '工资条申诉' },
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
  '/personnel/employee-tag': 'personnel:manage',
}

function PageLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { user, permissions, logoutRemote } = useUserStore()

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

  const handleLogout = async () => {
    await logoutRemote()
    navigate('/login')
  }

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  const getBreadcrumbItems = () => {
    const pathMap: Record<string, string> = {
      '/dashboard': '仪表盘',
      '/personnel/employee': '员工管理',
      '/personnel/lifecycle': '员工生命周期',
      '/personnel/department': '部门管理',
      '/personnel/position': '岗位管理',
      '/personnel/changes': '变动记录',
      '/attendance/home': '考勤首页',
      '/attendance/records': '打卡记录',
      '/attendance/schedule': '排班管理',
      '/attendance/shift': '班次管理',
      '/attendance/leave': '请假管理',
      '/attendance/overtime': '加班管理',
      '/attendance/stats': '考勤统计',
      '/attendance/settings': '考勤设置',
      '/attendance/calculation': '考勤核算',
      '/attendance/exceptions': '考勤异常',
      '/attendance/corrections': '补卡申请',
      '/payroll/components': '薪资组件',
      '/payroll/structures': '薪资结构',
      '/payroll/assignments': '薪资分配',
      '/payroll/runs': '薪资批次',
      '/payroll/payslips': '工资条管理',
      '/payroll/adjustments': '薪资调整项',
      '/payroll/disputes': '工资条申诉',
      '/payroll/my-payslips': '我的工资条',
      '/security/audit-logs': '审计日志',
      '/asset/items': '资产台账',
      '/helpdesk/tickets': '服务工单',
      '/recruitment/overview': '招聘总览',
      '/performance/overview': '绩效总览',
      '/training/overview': '培训总览',
      '/schedule/calendar': '排班日历',
      '/schedule/assign': '排班分配',
      '/schedule/rules': '排班规则',
      '/schedule/recommend': '智能排班',
      '/schedule/swaps': '换班申请',
      '/schedule/secondments': '借调管理',
      '/schedule/templates': '排班模板',
      '/schedule/publish': '发布确认',
      '/my/schedule': '我的排班',
      '/system/announcement': '公告管理',
      '/personnel/employee-tag': '员工标签',
    }
    return ['首页', pathMap[location.pathname] || '页面']
  }

  const userDropdownMenu = (
    <Menu>
      <MenuItem key="profile">个人信息</MenuItem>
      <MenuItem key="settings">账号设置</MenuItem>
      <Divider style={{ margin: '4px 0' }} />
      <MenuItem key="logout" onClick={handleLogout}>
        退出登录
      </MenuItem>
    </Menu>
  )

  return (
    <Layout className="layout-wrapper">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        breakpoint="xl"
      >
        <div className="sider-logo">
          <div className="sider-logo__icon">雷</div>
          {!collapsed && <span className="sider-logo__text">雷犀系统</span>}
        </div>
        <Menu
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['personnel', 'attendance']}
          onClickMenuItem={handleMenuClick}
          style={{ width: '100%' }}
        >
          {visibleMenuList.map((item) => {
            const IconComp = item.icon
            return item.children ? (
              <SubMenu
                key={item.key}
                title={
                  <span>
                    {IconComp ? <IconComp style={{ marginRight: 8 }} /> : null}
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
                {IconComp ? <IconComp style={{ marginRight: 8 }} /> : null}
                {item.label}
              </MenuItem>
            )
          })}
        </Menu>
      </Sider>
      <Layout>
        <Header className="layout-header">
          <div className="layout-header__content">
            <Space size="medium">
              <div
                className="layout-header__menu-toggle"
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <IconMenuUnfold /> : <IconMenuFold />}
              </div>
              <Breadcrumb>
                {getBreadcrumbItems().map((item, index) => (
                  <Breadcrumb.Item key={index}>{item}</Breadcrumb.Item>
                ))}
              </Breadcrumb>
            </Space>
            <Space size="small">
              <Badge count={5} dot>
                <span className="layout-header__icon">
                  <IconNotification />
                </span>
              </Badge>
              <span className="layout-header__icon">
                <IconQuestionCircle />
              </span>
              <Dropdown droplist={userDropdownMenu} position="br">
                <Space size="small" className="layout-header__user-menu">
                  <Avatar size={32} style={{ backgroundColor: '#165DFF' }}>
                    <IconUser />
                  </Avatar>
                  {!collapsed && <span>{user?.realName || '用户'}</span>}
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content className="layout-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default PageLayout
