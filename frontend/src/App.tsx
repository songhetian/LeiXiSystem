import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useUserStore } from './store/user'
import Login from './pages/login'
import AppRoutes from './router'
import { getMe } from './api/auth'

function App() {
  const token = useUserStore((state) => state.token)
  const setUser = useUserStore((state) => state.setUser)
  const logout = useUserStore((state) => state.logout)
  const [checking, setChecking] = useState(Boolean(token))

  useEffect(() => {
    let mounted = true

    async function bootstrapAuth() {
      if (!token) {
        setChecking(false)
        return
      }

      try {
        const res: any = await getMe()
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
  }, [logout, setUser, token])

  if (checking) {
    return <div style={{ padding: 20, textAlign: 'center' }}>正在验证登录状态...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={token ? <AppRoutes /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
