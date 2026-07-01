import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock dashboard API
const mockGetDashboardStats = vi.fn()
const mockGetAttendanceOverview = vi.fn()
const mockGetDashboardTodos = vi.fn()

vi.mock('@/api/dashboard', () => ({
  getDashboardStats: (...args: any[]) => mockGetDashboardStats(...args),
  getAttendanceOverview: (...args: any[]) => mockGetAttendanceOverview(...args),
  getDashboardTodos: (...args: any[]) => mockGetDashboardTodos(...args),
}))

// Mock CSS modules
vi.mock('../../pages/dashboard/index.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}))

import Dashboard from '../../pages/dashboard'

const mockStatsData = {
  totalUsers: 156,
  activeUsers: 120,
  totalDepartments: 8,
  totalPositions: 24,
  todayAttendance: 132,
  pendingApprovals: 5,
}

const mockAttendanceData = {
  date: '2024-01-15',
  total: 156,
  normal: 120,
  late: 10,
  early: 5,
  absent: 3,
  attendanceRate: '89%',
  recentList: [
    { id: 1, name: '张三', department: '技术部', checkIn: '09:00', status: 'normal' },
    { id: 2, name: '李四', department: '市场部', checkIn: '09:30', status: 'late' },
    { id: 3, name: '王五', department: '人事部', checkIn: '08:50', status: 'normal' },
  ],
}

const mockTodosData = [
  {
    id: 1,
    type: 'approval',
    typeName: '审批',
    title: '请假申请 - 张三',
    applicant: '张三',
    createdAt: '2024-01-15T09:00:00',
  },
  {
    id: 2,
    type: 'approval',
    typeName: '审批',
    title: '加班申请 - 李四',
    applicant: '李四',
    createdAt: '2024-01-15T10:00:00',
  },
]

describe('Dashboard 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDashboardStats.mockResolvedValue({ data: mockStatsData })
    mockGetAttendanceOverview.mockResolvedValue({ data: mockAttendanceData })
    mockGetDashboardTodos.mockResolvedValue({ data: mockTodosData })
  })

  describe('渲染', () => {
    it('应该正常渲染仪表盘页面', async () => {
      render(<Dashboard />)

      expect(screen.getByText(/欢迎回来/)).toBeInTheDocument()
      expect(screen.getByText('今天是工作日，祝您工作愉快！')).toBeInTheDocument()
    })

    it('应该渲染统计卡片标题', async () => {
      render(<Dashboard />)

      // 等待数据加载完成后才能看到 Statistic 标题（Card loading 时会隐藏内容）
      await waitFor(() => {
        expect(screen.getByText('156')).toBeInTheDocument()
      })

      expect(screen.getByText('员工总数')).toBeInTheDocument()
      expect(screen.getByText('今日出勤')).toBeInTheDocument()
      expect(screen.getByText('待审批')).toBeInTheDocument()
      expect(screen.getByText('部门数量')).toBeInTheDocument()
    })

    it('应该显示统计数据', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('156')).toBeInTheDocument()
      })

      expect(screen.getByText('132')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })

    it('应该渲染考勤概览卡片', async () => {
      render(<Dashboard />)

      expect(screen.getByText('今日考勤概览')).toBeInTheDocument()
      expect(screen.getByText('查看全部')).toBeInTheDocument()
    })

    it('应该渲染待办事项卡片', async () => {
      render(<Dashboard />)

      expect(screen.getByText('待办事项')).toBeInTheDocument()
    })
  })

  describe('数据加载', () => {
    it('应该在挂载时请求所有 API', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(mockGetDashboardStats).toHaveBeenCalledTimes(1)
        expect(mockGetAttendanceOverview).toHaveBeenCalledTimes(1)
        expect(mockGetDashboardTodos).toHaveBeenCalledTimes(1)
      })
    })

    it('应该显示考勤列表数据', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument()
        expect(screen.getByText('李四')).toBeInTheDocument()
        expect(screen.getByText('王五')).toBeInTheDocument()
      })
    })

    it('应该显示考勤状态标签', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        // 张三和王五都是正常状态，所以应该有多个"正常"标签
        const normalTags = screen.getAllByText('正常')
        expect(normalTags.length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('迟到')).toBeInTheDocument()
      })
    })

    it('应该显示待办事项列表', async () => {
      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('请假申请 - 张三')).toBeInTheDocument()
        expect(screen.getByText('加班申请 - 李四')).toBeInTheDocument()
      })
    })
  })

  describe('错误处理', () => {
    it('API 请求失败时不应该崩溃', async () => {
      mockGetDashboardStats.mockRejectedValueOnce(new Error('error'))
      mockGetAttendanceOverview.mockRejectedValueOnce(new Error('error'))
      mockGetDashboardTodos.mockRejectedValueOnce(new Error('error'))

      render(<Dashboard />)

      // 等待 API 调用完成和 loading 状态恢复
      await waitFor(() => {
        expect(mockGetDashboardStats).toHaveBeenCalledTimes(1)
      })

      await waitFor(() => {
        expect(screen.getByText(/欢迎回来/)).toBeInTheDocument()
      })

      // 页面应该仍然渲染，不会崩溃
      expect(screen.getByText('今日考勤概览')).toBeInTheDocument()
      expect(screen.getByText('待办事项')).toBeInTheDocument()
    })
  })

  describe('空数据', () => {
    it('应该处理空考勤列表', async () => {
      mockGetAttendanceOverview.mockResolvedValueOnce({
        data: { ...mockAttendanceData, recentList: [] },
      })

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('今日考勤概览')).toBeInTheDocument()
      })
    })

    it('应该处理空待办列表', async () => {
      mockGetDashboardTodos.mockResolvedValueOnce({ data: [] })

      render(<Dashboard />)

      await waitFor(() => {
        expect(screen.getByText('待办事项')).toBeInTheDocument()
      })
    })
  })
})
