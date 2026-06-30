import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Message } from '@arco-design/web-react'
import { Spin } from '@arco-design/web-react'
import { useUserStore } from './store/user'
import Login from './pages/login'
import AppRoutes from './router'
import { getMe } from './api/auth'
import { ErrorBoundary } from './components'
import './App.css'

Message.config({
  duration: 3000,
  maxCount: 5,
  closable: false,
})

function App() {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn)
  const setUser = useUserStore((state) => state.setUser)
  const logout = useUserStore((state) => state.logout)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let mounted = true

    async function bootstrapAuth() {
      try {
        const res = await getMe()
        if (mounted && (res?.code === 0 || res?.success) && res.data) {
          setUser(res.data)
        }
      } catch {
        if (mounted) {
          logout()
        }
      } finally {
        if (mounted) {
          setChecking(false)
        }
      }
    }

    bootstrapAuth()

    return () => {
      mounted = false
    }
  }, [logout, setUser])

  if (checking) {
    return (
      <div className="app-checking">
        <Spin size={32} />
        <span>正在验证登录状态...</span>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={isLoggedIn ? <AppRoutes /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
