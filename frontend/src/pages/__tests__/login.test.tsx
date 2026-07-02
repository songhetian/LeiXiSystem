import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// Mock auth store
const mockSetAuth = vi.fn()
vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn((selector?: any) => {
    if (selector) {
      return mockSetAuth
    }
    return {
      getState: () => ({ setAuth: mockSetAuth }),
    }
  }),
}))

// Mock login API
const mockLogin = vi.fn()
vi.mock('@/api/auth', () => ({
  login: (...args: any[]) => mockLogin(...args),
}))

// Mock CSS modules
vi.mock('../../pages/login/index.module.css', () => ({
  default: new Proxy(
    {},
    {
      get: (_target, prop) => String(prop),
    },
  ),
}))

// Mock Arco Design icons
vi.mock('@arco-design/web-react/icon', () => ({
  IconDashboard: () => React.createElement('span', null, 'IconDashboard'),
  IconClockCircle: () => React.createElement('span', null, 'IconClockCircle'),
  IconSafe: () => React.createElement('span', null, 'IconSafe'),
  IconUser: () => React.createElement('span', null, 'IconUser'),
  IconLock: () => React.createElement('span', null, 'IconLock'),
}))

import Login from '../../pages/login'

describe('Login 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('渲染', () => {
    it('应该正常渲染登录页面', () => {
      render(<Login />)
      expect(screen.getByText('欢迎回来')).toBeInTheDocument()
    })

    it('应该渲染用户名和密码输入框', () => {
      render(<Login />)
      expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument()
    })

    it('应该渲染登录按钮', () => {
      render(<Login />)
      expect(screen.getByRole('button', { name: /登录/i })).toBeInTheDocument()
    })

    it('应该渲染品牌信息', () => {
      render(<Login />)
      expect(screen.getByText('雷犀系统')).toBeInTheDocument()
      expect(screen.getByText('企业级人事考勤一体化管理平台')).toBeInTheDocument()
    })

    it('应该渲染功能介绍卡片', () => {
      render(<Login />)
      expect(screen.getByText('智能考勤')).toBeInTheDocument()
      expect(screen.getByText('数据驾驶舱')).toBeInTheDocument()
      expect(screen.getByText('安全合规')).toBeInTheDocument()
    })

    it('应该渲染"记住密码"和"忘记密码"选项', () => {
      render(<Login />)
      expect(screen.getByText('记住密码')).toBeInTheDocument()
      expect(screen.getByText('忘记密码？')).toBeInTheDocument()
    })
  })

  describe('表单提交', () => {
    it('登录成功后应该调用 setAuth 并跳转', async () => {
      const user = userEvent.setup()
      mockLogin.mockResolvedValueOnce({
        success: true,
        data: { token: 'abc123', user: { id: 1, name: 'admin' } },
      })

      render(<Login />)

      await user.type(screen.getByPlaceholderText('请输入用户名'), 'admin')
      await user.type(screen.getByPlaceholderText('请输入密码'), 'password123')
      await user.click(screen.getByRole('button', { name: /登录/i }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          username: 'admin',
          password: 'password123',
        })
      })

      await waitFor(() => {
        expect(mockSetAuth).toHaveBeenCalledWith('abc123', {
          id: 1,
          name: 'admin',
        })
      })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('code===0 时也应该视为成功', async () => {
      const user = userEvent.setup()
      mockLogin.mockResolvedValueOnce({
        code: 0,
        data: { token: 'token-xyz', user: { id: 2, name: 'user2' } },
      })

      render(<Login />)

      await user.type(screen.getByPlaceholderText('请输入用户名'), 'user2')
      await user.type(screen.getByPlaceholderText('请输入密码'), 'pass')
      await user.click(screen.getByRole('button', { name: /登录/i }))

      await waitFor(() => {
        expect(mockSetAuth).toHaveBeenCalledWith('token-xyz', {
          id: 2,
          name: 'user2',
        })
      })
    })

    it('登录失败时不应该跳转', async () => {
      const user = userEvent.setup()
      mockLogin.mockRejectedValueOnce(new Error('密码错误'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<Login />)

      await user.type(screen.getByPlaceholderText('请输入用户名'), 'admin')
      await user.type(screen.getByPlaceholderText('请输入密码'), 'wrongpass')
      await user.click(screen.getByRole('button', { name: /登录/i }))

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled()
      })

      // Wait for error handling
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled()
      })

      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockSetAuth).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
