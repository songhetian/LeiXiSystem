import { useState } from 'react'
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Badge, Space } from '@arco-design/web-react'
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
} from '@arco-design/web-react/icon'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useUserStore } from '@/store/user'
import './index.css'

const { Header, Sider, Content } = Layout
const MenuItem = Menu.Item
const SubMenu = Menu.SubMenu

const menuList = [
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
    ],
  },
  {
    key: 'attendance',
    icon: IconCalendar,
    label: '考勤打卡核算',
    children: [
      { key: '/attendance/records', label: '打卡记录' },
      { key: '/attendance/calculation', label: '考勤核算' },
      { key: '/attendance/stats', label: '考勤统计' },
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

function PageLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useUserStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleMenuClick = (key: string) => {
    navigate(key)
  }

  const getBreadcrumbItems = () => {
    const pathMap: Record<string, string> = {
      '/dashboard': '仪表盘',
      '/personnel/employee': '员工管理',
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
    }
    return ['首页', pathMap[location.pathname] || '页面']
  }

  const userDropdownItems = [
    {
      key: 'profile',
      content: '个人信息',
    },
    {
      key: 'settings',
      content: '账号设置',
    },
    {
      key: 'divider',
      type: 'divider' as const,
    },
    {
      key: 'logout',
      content: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        breakpoint="xl"
      >
        <div className="sider-logo">
          <div className="sider-logo-icon">雷</div>
          {!collapsed && <span className="sider-logo-text">雷犀系统</span>}
        </div>
        <Menu
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['personnel', 'attendance']}
          onClickMenuItem={handleMenuClick}
          style={{ width: '100%' }}
        >
          {menuList.map((item) => {
            const IconComp = item.icon
            return item.children ? (
              <SubMenu
                key={item.key}
                title={item.label}
                icon={<IconComp />}
              >
                {item.children.map((child) => (
                  <MenuItem key={child.key}>{child.label}</MenuItem>
                ))}
              </SubMenu>
            ) : (
              <MenuItem key={item.key} icon={<IconComp />}>
                {item.label}
              </MenuItem>
            )
          })}
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
            <Space size="medium">
              <div
                style={{ cursor: 'pointer', fontSize: 18, color: '#4e5969' }}
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
                <span style={{ cursor: 'pointer', fontSize: 18, color: '#4e5969' }}>
                  <IconNotification />
                </span>
              </Badge>
              <span style={{ cursor: 'pointer', fontSize: 18, color: '#4e5969' }}>
                <IconQuestionCircle />
              </span>
              <Dropdown droplist={userDropdownItems} position="br">
                <Space size="small" style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}>
                  <Avatar size={32} style={{ backgroundColor: '#165DFF' }}>
                    <IconUser />
                  </Avatar>
                  {!collapsed && <span>{user?.real_name || '用户'}</span>}
                </Space>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content style={{ padding: 20, backgroundColor: 'var(--color-fill-3)', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default PageLayout
