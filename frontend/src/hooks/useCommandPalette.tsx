import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Modal, Input, Empty, Space, Typography, Spin, Tag } from '@arco-design/web-react'
import {
  IconSearch,
  IconHome,
  IconUser,
  IconSettings,
  IconExport,
  IconImport,
  IconCalendar,
  IconFile,
  IconCheckCircle,
  IconCompass,
} from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { getEmployees } from '@/api/personnel'
import { getPendingApproval } from '@/api/approval'
import { getAttendanceRecords } from '@/api/attendance'
import { catchError } from '@/utils/catchError'
import styles from './useCommandPalette.module.css'
const { Text } = Typography

interface Command {
  /** 唯一标识 */
  key: string
  /** 显示标题 */
  title: string
  /** 描述 */
  description?: string
  /** 图标 */
  icon?: React.ReactNode
  /** 分类 */
  category?: string
  /** 点击执行 */
  action: () => void
  /** 快捷键提示 */
  shortcut?: string
  /** 关键词（用于搜索） */
  keywords?: string[]
}

interface CommandPaletteOptions {
  /** 额外的命令 */
  commands?: Command[]
  /** 是否启用 */
  enabled?: boolean
}

interface CommandPaletteResult {
  /** 打开命令面板 */
  open: () => void
  /** 关闭命令面板 */
  close: () => void
  /** 命令面板组件 */
  CommandPalette: React.ReactNode
}

/** 所有可导航页面（用于页面搜索） */
const pageRoutes: Omit<Command, 'action'>[] = [
  { key: 'page-dashboard', title: '仪表盘', description: '页面导航 → /dashboard', icon: <IconHome />, category: '页面搜索', keywords: ['仪表盘', 'dashboard', '概览'] },
  { key: 'page-employee', title: '员工管理', description: '页面导航 → /personnel/employee', icon: <IconUser />, category: '页面搜索', keywords: ['员工', '人员', 'employee'] },
  { key: 'page-changes', title: '人事变动', description: '页面导航 → /personnel/changes', icon: <IconFile />, category: '页面搜索', keywords: ['人事变动', '变动记录'] },
  { key: 'page-lifecycle', title: '员工生命周期', description: '页面导航 → /personnel/lifecycle', icon: <IconFile />, category: '页面搜索', keywords: ['生命周期', 'lifecycle'] },
  { key: 'page-onboarding', title: '入职管理', description: '页面导航 → /personnel/onboarding', icon: <IconFile />, category: '页面搜索', keywords: ['入职', 'onboarding'] },
  { key: 'page-onboarding-flow', title: '入职流程', description: '页面导航 → /personnel/onboarding-flow', icon: <IconFile />, category: '页面搜索', keywords: ['入职流程', '入职配置'] },
  { key: 'page-employee-tag', title: '员工标签', description: '页面导航 → /personnel/employee-tag', icon: <IconFile />, category: '页面搜索', keywords: ['标签', 'tag'] },
  { key: 'page-department', title: '部门管理', description: '页面导航 → /organization/department', icon: <IconCompass />, category: '页面搜索', keywords: ['部门', 'department', '组织架构'] },
  { key: 'page-position', title: '职位管理', description: '页面导航 → /organization/position', icon: <IconCompass />, category: '页面搜索', keywords: ['职位', 'position', '岗位'] },
  { key: 'page-role', title: '角色管理', description: '页面导航 → /rbac/role', icon: <IconSettings />, category: '页面搜索', keywords: ['角色', 'role', '权限'] },
  { key: 'page-permission', title: '权限管理', description: '页面导航 → /rbac/permission', icon: <IconSettings />, category: '页面搜索', keywords: ['权限', 'permission'] },
  { key: 'page-user-role', title: '用户角色', description: '页面导航 → /rbac/user-role', icon: <IconSettings />, category: '页面搜索', keywords: ['用户角色', 'user role'] },
  { key: 'page-shift-list', title: '班次列表', description: '页面导航 → /shift/list', icon: <IconCalendar />, category: '页面搜索', keywords: ['班次', 'shift'] },
  { key: 'page-shift-rule', title: '班次规则', description: '页面导航 → /shift/rule', icon: <IconCalendar />, category: '页面搜索', keywords: ['班次规则', 'shift rule'] },
  { key: 'page-schedule-calendar', title: '排班日历', description: '页面导航 → /schedule/calendar', icon: <IconCalendar />, category: '页面搜索', keywords: ['排班', '日历', 'schedule', 'calendar'] },
  { key: 'page-schedule-weekly', title: '周排班', description: '页面导航 → /schedule/weekly', icon: <IconCalendar />, category: '页面搜索', keywords: ['周排班', 'weekly'] },
  { key: 'page-schedule-assign', title: '排班分配', description: '页面导航 → /schedule/assign', icon: <IconCalendar />, category: '页面搜索', keywords: ['排班分配', 'assign'] },
  { key: 'page-schedule-rules', title: '排班规则', description: '页面导航 → /schedule/rules', icon: <IconCalendar />, category: '页面搜索', keywords: ['排班规则'] },
  { key: 'page-schedule-recommend', title: '排班推荐', description: '页面导航 → /schedule/recommend', icon: <IconCalendar />, category: '页面搜索', keywords: ['排班推荐', 'recommend'] },
  { key: 'page-schedule-swaps', title: '换班管理', description: '页面导航 → /schedule/swaps', icon: <IconCalendar />, category: '页面搜索', keywords: ['换班', 'swaps'] },
  { key: 'page-schedule-secondments', title: '借调管理', description: '页面导航 → /schedule/secondments', icon: <IconCalendar />, category: '页面搜索', keywords: ['借调', 'secondments'] },
  { key: 'page-schedule-templates', title: '排班模板', description: '页面导航 → /schedule/templates', icon: <IconCalendar />, category: '页面搜索', keywords: ['排班模板', 'templates'] },
  { key: 'page-schedule-publish', title: '排班发布', description: '页面导航 → /schedule/publish', icon: <IconCalendar />, category: '页面搜索', keywords: ['排班发布', 'publish'] },
  { key: 'page-schedule-report', title: '排班报表', description: '页面导航 → /schedule/report', icon: <IconFile />, category: '页面搜索', keywords: ['排班报表'] },
  { key: 'page-attendance-records', title: '考勤记录', description: '页面导航 → /attendance/records', icon: <IconCalendar />, category: '页面搜索', keywords: ['考勤记录', 'attendance', '打卡'] },
  { key: 'page-attendance-calculation', title: '考勤计算', description: '页面导航 → /attendance/calculation', icon: <IconCalendar />, category: '页面搜索', keywords: ['考勤计算', 'calculation'] },
  { key: 'page-attendance-exceptions', title: '考勤异常', description: '页面导航 → /attendance/exceptions', icon: <IconCalendar />, category: '页面搜索', keywords: ['考勤异常', 'exceptions'] },
  { key: 'page-attendance-exception-rules', title: '异常规则', description: '页面导航 → /attendance/exception-rules', icon: <IconCalendar />, category: '页面搜索', keywords: ['异常规则'] },
  { key: 'page-attendance-exception-stats', title: '异常统计', description: '页面导航 → /attendance/exception-stats', icon: <IconCalendar />, category: '页面搜索', keywords: ['异常统计'] },
  { key: 'page-attendance-locations', title: '打卡地点', description: '页面导航 → /attendance/locations', icon: <IconCalendar />, category: '页面搜索', keywords: ['打卡地点', 'locations'] },
  { key: 'page-attendance-overtime-types', title: '加班类型', description: '页面导航 → /attendance/overtime-types', icon: <IconCalendar />, category: '页面搜索', keywords: ['加班类型'] },
  { key: 'page-attendance-corrections', title: '考勤补卡', description: '页面导航 → /attendance/corrections', icon: <IconCalendar />, category: '页面搜索', keywords: ['补卡', 'corrections'] },
  { key: 'page-attendance-stats', title: '考勤统计', description: '页面导航 → /attendance/stats', icon: <IconCalendar />, category: '页面搜索', keywords: ['考勤统计', 'stats'] },
  { key: 'page-attendance-report', title: '考勤报表', description: '页面导航 → /attendance/report', icon: <IconFile />, category: '页面搜索', keywords: ['考勤报表'] },
  { key: 'page-attendance-leave-overtime-report', title: '请假加班报表', description: '页面导航 → /attendance/leave-overtime-report', icon: <IconFile />, category: '页面搜索', keywords: ['请假加班报表'] },
  { key: 'page-attendance-detail', title: '考勤明细', description: '页面导航 → /attendance/attendance-detail', icon: <IconCalendar />, category: '页面搜索', keywords: ['考勤明细'] },
  { key: 'page-attendance-department-ranking', title: '部门排名', description: '页面导航 → /attendance/department-ranking', icon: <IconFile />, category: '页面搜索', keywords: ['部门排名'] },
  { key: 'page-attendance-trend-analysis', title: '趋势分析', description: '页面导航 → /attendance/trend-analysis', icon: <IconFile />, category: '页面搜索', keywords: ['趋势分析'] },
  { key: 'page-attendance-deduction-rules', title: '扣款规则', description: '页面导航 → /attendance/deduction-rules', icon: <IconSettings />, category: '页面搜索', keywords: ['扣款规则'] },
  { key: 'page-attendance-monthly', title: '月度考勤', description: '页面导航 → /attendance/monthly', icon: <IconCalendar />, category: '页面搜索', keywords: ['月度考勤', 'monthly'] },
  { key: 'page-payroll-components', title: '薪资项目', description: '页面导航 → /payroll/components', icon: <IconFile />, category: '页面搜索', keywords: ['薪资项目', 'payroll'] },
  { key: 'page-payroll-structures', title: '薪资结构', description: '页面导航 → /payroll/structures', icon: <IconFile />, category: '页面搜索', keywords: ['薪资结构'] },
  { key: 'page-payroll-assignments', title: '薪资分配', description: '页面导航 → /payroll/assignments', icon: <IconFile />, category: '页面搜索', keywords: ['薪资分配'] },
  { key: 'page-payroll-runs', title: '薪资核算', description: '页面导航 → /payroll/runs', icon: <IconFile />, category: '页面搜索', keywords: ['薪资核算', 'runs'] },
  { key: 'page-payroll-payslips', title: '工资条管理', description: '页面导航 → /payroll/payslips', icon: <IconFile />, category: '页面搜索', keywords: ['工资条', 'payslips'] },
  { key: 'page-payroll-adjustments', title: '薪资调整', description: '页面导航 → /payroll/adjustments', icon: <IconFile />, category: '页面搜索', keywords: ['薪资调整'] },
  { key: 'page-payroll-disputes', title: '薪资争议', description: '页面导航 → /payroll/disputes', icon: <IconFile />, category: '页面搜索', keywords: ['薪资争议'] },
  { key: 'page-my-payslips', title: '我的工资条', description: '页面导航 → /payroll/my-payslips', icon: <IconFile />, category: '页面搜索', keywords: ['我的工资条'] },
  { key: 'page-audit-logs', title: '审计日志', description: '页面导航 → /security/audit-logs', icon: <IconSettings />, category: '页面搜索', keywords: ['审计日志', 'audit'] },
  { key: 'page-announcement', title: '公告管理', description: '页面导航 → /system/announcement', icon: <IconFile />, category: '页面搜索', keywords: ['公告', 'announcement'] },
  { key: 'page-system-config', title: '系统配置', description: '页面导航 → /system/config', icon: <IconSettings />, category: '页面搜索', keywords: ['系统配置', 'config'] },
  { key: 'page-report-template', title: '报表模板', description: '页面导航 → /system/report-template', icon: <IconFile />, category: '页面搜索', keywords: ['报表模板'] },
  { key: 'page-asset-items', title: '资产管理', description: '页面导航 → /asset/items', icon: <IconFile />, category: '页面搜索', keywords: ['资产', 'asset'] },
  { key: 'page-helpdesk-tickets', title: '工单管理', description: '页面导航 → /helpdesk/tickets', icon: <IconFile />, category: '页面搜索', keywords: ['工单', 'helpdesk', 'tickets'] },
  { key: 'page-recruitment', title: '招聘概览', description: '页面导航 → /recruitment/overview', icon: <IconFile />, category: '页面搜索', keywords: ['招聘', 'recruitment'] },
  { key: 'page-performance', title: '绩效概览', description: '页面导航 → /performance/overview', icon: <IconFile />, category: '页面搜索', keywords: ['绩效', 'performance'] },
  { key: 'page-training', title: '培训概览', description: '页面导航 → /training/overview', icon: <IconFile />, category: '页面搜索', keywords: ['培训', 'training'] },
  { key: 'page-vacation-types', title: '假期类型', description: '页面导航 → /vacation/types', icon: <IconCalendar />, category: '页面搜索', keywords: ['假期类型', 'vacation'] },
  { key: 'page-vacation-quota', title: '假期额度', description: '页面导航 → /vacation/quota', icon: <IconCalendar />, category: '页面搜索', keywords: ['假期额度', 'quota'] },
  { key: 'page-vacation-balance', title: '假期余额', description: '页面导航 → /vacation/balance', icon: <IconCalendar />, category: '页面搜索', keywords: ['假期余额', 'balance'] },
  { key: 'page-vacation-carryover', title: '假期结转', description: '页面导航 → /vacation/carryover', icon: <IconCalendar />, category: '页面搜索', keywords: ['假期结转', 'carryover'] },
  { key: 'page-reimbursement-apply', title: '报销申请', description: '页面导航 → /reimbursement/apply', icon: <IconFile />, category: '页面搜索', keywords: ['报销申请', 'reimbursement'] },
  { key: 'page-reimbursement-list', title: '报销列表', description: '页面导航 → /reimbursement/list', icon: <IconFile />, category: '页面搜索', keywords: ['报销列表'] },
  { key: 'page-reimbursement-approval', title: '报销审批', description: '页面导航 → /reimbursement/approval', icon: <IconCheckCircle />, category: '页面搜索', keywords: ['报销审批'] },
  { key: 'page-financial-budgets', title: '预算管理', description: '页面导航 → /financial/budgets', icon: <IconFile />, category: '页面搜索', keywords: ['预算', 'budgets'] },
  { key: 'page-expense-standards', title: '费用标准', description: '页面导航 → /financial/expense-standards', icon: <IconFile />, category: '页面搜索', keywords: ['费用标准'] },
  { key: 'page-finance-report', title: '财务报表', description: '页面导航 → /financial/report', icon: <IconFile />, category: '页面搜索', keywords: ['财务报表'] },
  { key: 'page-adjustment-shift', title: '调班申请', description: '页面导航 → /adjustment/shift-change', icon: <IconCalendar />, category: '页面搜索', keywords: ['调班', 'shift change'] },
  { key: 'page-adjustment-overtime', title: '加班申请', description: '页面导航 → /adjustment/overtime', icon: <IconCalendar />, category: '页面搜索', keywords: ['加班申请', 'overtime'] },
  { key: 'page-adjustment-leave', title: '请假申请', description: '页面导航 → /adjustment/leave', icon: <IconCalendar />, category: '页面搜索', keywords: ['请假申请', 'leave'] },
  { key: 'page-profile-info', title: '个人信息', description: '页面导航 → /profile/info', icon: <IconUser />, category: '页面搜索', keywords: ['个人信息', 'profile'] },
  { key: 'page-profile-password', title: '修改密码', description: '页面导航 → /profile/password', icon: <IconSettings />, category: '页面搜索', keywords: ['修改密码', 'password'] },
  { key: 'page-profile-attendance', title: '我的考勤', description: '页面导航 → /profile/attendance', icon: <IconCalendar />, category: '页面搜索', keywords: ['我的考勤'] },
  { key: 'page-approval-pending', title: '待审批', description: '页面导航 → /approval/pending', icon: <IconCheckCircle />, category: '页面搜索', keywords: ['待审批', 'approval', 'pending'] },
  { key: 'page-approval-history', title: '审批历史', description: '页面导航 → /approval/history', icon: <IconFile />, category: '页面搜索', keywords: ['审批历史'] },
  { key: 'page-approval-flow', title: '审批流程', description: '页面导航 → /approval/flow', icon: <IconFile />, category: '页面搜索', keywords: ['审批流程'] },
  { key: 'page-visualization', title: '数据大屏', description: '页面导航 → /visualization', icon: <IconFile />, category: '页面搜索', keywords: ['数据大屏', 'visualization', '可视化'] },
  { key: 'page-sso-config', title: 'SSO配置', description: '页面导航 → /sso/config', icon: <IconSettings />, category: '页面搜索', keywords: ['SSO', '单点登录'] },
  { key: 'page-sso-apps', title: 'SSO应用', description: '页面导航 → /sso/apps', icon: <IconSettings />, category: '页面搜索', keywords: ['SSO应用'] },
  { key: 'page-data-import', title: '数据导入', description: '页面导航 → /data/import', icon: <IconImport />, category: '页面搜索', keywords: ['数据导入', 'import'] },
  { key: 'page-data-export', title: '数据导出', description: '页面导航 → /data/export', icon: <IconExport />, category: '页面搜索', keywords: ['数据导出', 'export'] },
  { key: 'page-export-tasks', title: '导出任务', description: '页面导航 → /data/export-tasks', icon: <IconExport />, category: '页面搜索', keywords: ['导出任务'] },
  { key: 'page-data-template', title: '数据模板', description: '页面导航 → /data/template', icon: <IconFile />, category: '页面搜索', keywords: ['数据模板', 'template'] },
  { key: 'page-notification-list', title: '通知列表', description: '页面导航 → /notification/list', icon: <IconFile />, category: '页面搜索', keywords: ['通知列表', 'notification'] },
  { key: 'page-notification-config', title: '通知配置', description: '页面导航 → /notification/config', icon: <IconSettings />, category: '页面搜索', keywords: ['通知配置'] },
  { key: 'page-message-center', title: '消息中心', description: '页面导航 → /message-center', icon: <IconFile />, category: '页面搜索', keywords: ['消息中心', 'message'] },
  { key: 'page-message-send', title: '消息发送', description: '页面导航 → /message-manage/send', icon: <IconFile />, category: '页面搜索', keywords: ['消息发送'] },
  { key: 'page-message-templates', title: '消息模板', description: '页面导航 → /message-manage/templates', icon: <IconFile />, category: '页面搜索', keywords: ['消息模板'] },
  { key: 'page-message-records', title: '消息记录', description: '页面导航 → /message-manage/records', icon: <IconFile />, category: '页面搜索', keywords: ['消息记录'] },
  { key: 'page-message-stats', title: '消息统计', description: '页面导航 → /message-manage/stats', icon: <IconFile />, category: '页面搜索', keywords: ['消息统计'] },
  { key: 'page-message-preferences', title: '消息偏好', description: '页面导航 → /message-manage/preferences', icon: <IconSettings />, category: '页面搜索', keywords: ['消息偏好'] },
]

/** 页面路径映射，用于快速查找 */
const pagePathMap: Record<string, string> = {}
pageRoutes.forEach((p) => {
  const pathMatch = p.description?.match(/→\s*(.+)/)
  if (pathMatch) pagePathMap[p.key] = pathMatch[1]
})

/**
 * 命令面板 Hook
 *
 * @example
 * const { open, close, CommandPalette } = useCommandPalette({
 *   commands: [
 *     { key: 'export', title: '导出数据', icon: <IconExport />, action: handleExport },
 *   ],
 * })
 *
 * return (
 *   <>
 *     <Button onClick={open}>打开命令面板</Button>
 *     {CommandPalette}
 *   </>
 * )
 */
export function useCommandPalette(options: CommandPaletteOptions = {}): CommandPaletteResult {
  const { commands = [], enabled = true } = options
  const [visible, setVisible] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<Command[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef(0)
  const navigate = useNavigate()

  // 默认命令
  const defaultCommands: Command[] = [
    {
      key: 'home',
      title: '返回首页',
      description: '跳转到系统首页',
      icon: <IconHome />,
      category: '导航',
      action: () => navigate('/'),
      keywords: ['首页', 'home'],
    },
    {
      key: 'employees',
      title: '员工管理',
      description: '管理员工信息',
      icon: <IconUser />,
      category: '导航',
      action: () => navigate('/personnel/employee'),
      keywords: ['员工', '人员'],
    },
    {
      key: 'export',
      title: '导出数据',
      description: '导出当前页面的数据',
      icon: <IconExport />,
      category: '操作',
      shortcut: 'Ctrl+Shift+E',
      action: () => {},
      keywords: ['导出', 'export', 'download'],
    },
    {
      key: 'import',
      title: '导入数据',
      description: '从文件导入数据',
      icon: <IconImport />,
      category: '操作',
      shortcut: 'Ctrl+Shift+I',
      action: () => {},
      keywords: ['导入', 'import', 'upload'],
    },
    {
      key: 'settings',
      title: '系统设置',
      description: '打开系统设置页面',
      icon: <IconSettings />,
      category: '导航',
      action: () => navigate('/settings'),
      keywords: ['设置', 'settings'],
    },
  ]

  // 合并静态命令
  const allCommands = [...defaultCommands, ...commands]

  // 过滤静态命令
  const filteredStaticCommands = search.trim()
    ? allCommands.filter((cmd) => {
        const searchLower = search.toLowerCase()
        return (
          cmd.title.toLowerCase().includes(searchLower) ||
          cmd.description?.toLowerCase().includes(searchLower) ||
          cmd.keywords?.some((k) => k.toLowerCase().includes(searchLower))
        )
      })
    : allCommands

  // 合并所有可显示项（静态 + 动态搜索结果）
  const allFilteredCommands = useMemo(() => {
    return [...filteredStaticCommands, ...searchResults]
  }, [filteredStaticCommands, searchResults])

  // 按分类分组
  const groupedCommands = allFilteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || '其他'
    if (!acc[category]) acc[category] = []
    acc[category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  // 防抖业务搜索
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    const query = search.trim()
    if (!query) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    setSearchLoading(true)
    const currentAbort = ++abortRef.current

    searchTimerRef.current = setTimeout(async () => {
      try {
        // 并行发起 API 搜索
        const [employeeRes, approvalRes, attendanceRes] = await Promise.allSettled([
          getEmployees({ keyword: query, pageSize: 5 }),
          getPendingApproval({ page: 1, pageSize: 50 }),
          getAttendanceRecords({ keyword: query, pageSize: 5 }),
        ])

        // 检查是否已被中止
        if (currentAbort !== abortRef.current) return

        const newCommands: Command[] = []
        const queryLower = query.toLowerCase()

        // 员工搜索结果
        if (employeeRes.status === 'fulfilled' && employeeRes.value?.data?.list) {
          employeeRes.value.data.list.forEach((emp) => {
            newCommands.push({
              key: `emp-${emp.id}`,
              title: emp.realName,
              description: `${emp.employeeNo} · ${emp.department}`,
              icon: <IconUser />,
              category: '业务搜索',
              action: () => navigate('/personnel/employee'),
              keywords: [emp.realName, emp.employeeNo, emp.department],
            })
          })
        }

        // 审批搜索结果（客户端过滤，API 不支持 keyword）
        if (approvalRes.status === 'fulfilled' && approvalRes.value?.data?.list) {
          const filtered = approvalRes.value.data.list.filter(
            (item) =>
              item.typeName?.toLowerCase().includes(queryLower) ||
              item.title?.toLowerCase().includes(queryLower) ||
              item.applicant?.toLowerCase().includes(queryLower)
          )
          filtered.slice(0, 5).forEach((item) => {
            newCommands.push({
              key: `approval-${item.id}`,
              title: item.title,
              description: `${item.typeName} · ${item.applicant} · ${item.createdAt}`,
              icon: <IconCheckCircle />,
              category: '业务搜索',
              action: () => navigate('/approval/pending'),
              keywords: [item.typeName, item.title, item.applicant],
            })
          })
        }

        // 考勤搜索结果
        if (attendanceRes.status === 'fulfilled' && attendanceRes.value?.data?.list) {
          attendanceRes.value.data.list.forEach((record) => {
            newCommands.push({
              key: `attendance-${record.id}`,
              title: `${record.employeeName} 考勤记录`,
              description: `${record.date} · ${record.status}`,
              icon: <IconCalendar />,
              category: '业务搜索',
              action: () => navigate(`/attendance/records?keyword=${encodeURIComponent(query)}`),
              keywords: [record.employeeName, record.employeeNo, record.status],
            })
          })
        }

        // 页面搜索结果（客户端过滤）
        const matchedPages = pageRoutes
          .filter((page) => {
            return (
              page.title.toLowerCase().includes(queryLower) ||
              page.description?.toLowerCase().includes(queryLower) ||
              page.keywords?.some((k) => k.toLowerCase().includes(queryLower))
            )
          })
          .slice(0, 8)

        matchedPages.forEach((page) => {
          const path = pagePathMap[page.key] || '/'
          newCommands.push({
            ...page,
            action: () => navigate(path),
          } as Command)
        })

        setSearchResults(newCommands)
      } catch (e) {
        catchError(e, { component: 'CommandPalette', operation: '业务搜索' })
      } finally {
        if (currentAbort === abortRef.current) {
          setSearchLoading(false)
        }
      }
    }, 300)

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [search, navigate])

  // 打开
  const open = useCallback(() => {
    if (!enabled) return
    setVisible(true)
    setSearch('')
    setSelectedIndex(0)
    setSearchResults([])
    setSearchLoading(false)
  }, [enabled])

  // 关闭
  const close = useCallback(() => {
    setVisible(false)
    setSearch('')
    setSearchResults([])
    setSearchLoading(false)
    abortRef.current++
  }, [])

  // 执行命令
  const executeCommand = useCallback(
    (command: Command) => {
      command.action()
      close()
    },
    [close]
  )

  // 键盘事件
  useEffect(() => {
    if (!visible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape 关闭
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }

      // 上/下导航
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, allFilteredCommands.length - 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        return
      }

      // Enter 执行
      if (e.key === 'Enter' && allFilteredCommands[selectedIndex]) {
        e.preventDefault()
        executeCommand(allFilteredCommands[selectedIndex])
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, allFilteredCommands, selectedIndex, executeCommand, close])

  // 全局快捷键 Ctrl+K 或 Cmd+K
  useEffect(() => {
    if (!enabled) return

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        open()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [enabled, open])

  // 自动聚焦输入框
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [visible])

  // 滚动到选中项
  useEffect(() => {
    const selectedElement = document.querySelector('.command-palette__item--selected')
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // 命令面板组件
  const CommandPalette = (
    <Modal
      focusLock
      visible={visible}
      onCancel={close}
      title={null}
      footer={null}
      className={styles['command-palette__modal']}
      unmountOnExit
    >
      <div className={styles['command-palette']}>
        <Input
          ref={inputRef as any}
          placeholder="输入命令或搜索..."
          value={search}
          onChange={setSearch}
          prefix={<IconSearch />}
          className={styles['command-palette__input']}
          allowClear
          role="combobox"
          aria-expanded={visible}
          aria-autocomplete="list"
          aria-controls="command-palette-list"
          aria-activedescendant={
            allFilteredCommands[selectedIndex]
              ? `command-item-${allFilteredCommands[selectedIndex].key}`
              : undefined
          }
        />

        <div
          className={styles['command-palette__list']}
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="命令列表"
        >
          {searchLoading && (
            <div className={styles['command-palette__loading']}>
              <Spin size={20} />
              <Text type="secondary" style={{ marginLeft: 8 }}>
                搜索中...
              </Text>
            </div>
          )}

          {!searchLoading && allFilteredCommands.length === 0 ? (
            <Empty
              description={search.trim() ? '无匹配结果' : '未找到匹配的命令'}
              className={styles['command-palette__empty']}
            />
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} className={styles['command-palette__category']}>
                <div className={styles['command-palette__category-title']}>{category}</div>
                {cmds.map((cmd) => {
                  const globalIndex = allFilteredCommands.indexOf(cmd)
                  const isSelected = globalIndex === selectedIndex

                  return (
                    <div
                      key={cmd.key}
                      id={`command-item-${cmd.key}`}
                      role="option"
                      aria-selected={isSelected}
                      className={`${styles['command-palette__item']} ${isSelected ? styles['command-palette__item--selected'] : ''}`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className={styles['command-palette__item-icon']}>{cmd.icon}</div>
                      <div className={styles['command-palette__item-content']}>
                        <div className={styles['command-palette__item-title']}>{cmd.title}</div>
                        {cmd.description && (
                          <div className={styles['command-palette__item-desc']}>{cmd.description}</div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <div className={styles['command-palette__item-shortcut']}>{cmd.shortcut}</div>
                      )}
                      {cmd.category === '业务搜索' && (
                        <Tag size="small" color="arcoblue" className={styles['command-palette__item-tag']}>
                          {cmd.category}
                        </Tag>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className={styles['command-palette__footer']}>
          <Space size="large">
            <Text type="secondary" className={styles['command-palette__hint']}>
              <kbd>↑↓</kbd> 导航
            </Text>
            <Text type="secondary" className={styles['command-palette__hint']}>
              <kbd>Enter</kbd> 执行
            </Text>
            <Text type="secondary" className={styles['command-palette__hint']}>
              <kbd>Esc</kbd> 关闭
            </Text>
          </Space>
        </div>
      </div>
    </Modal>
  )

  return {
    open,
    close,
    CommandPalette,
  }
}

export default useCommandPalette
