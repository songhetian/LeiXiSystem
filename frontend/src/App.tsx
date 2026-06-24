import { Routes, Route, Navigate } from 'react-router-dom'
import { useUserStore } from './store/user'
import Login from './pages/login'
import AppRoutes from './router'

function App() {
  const token = useUserStore((state) => state.token)

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
