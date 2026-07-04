import { useState } from 'react'
import { Form, Input, Button, Checkbox, Link, Space, Card } from '@arco-design/web-react'
import { IconUser, IconLock } from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { login } from '@/api/auth'
import { toast } from '@/utils/toast'
import styles from './index.module.less'

function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (values: { username: string; password: string }) => {
    if (!values.username || !values.password) {
      setErrorMessage('请输入用户名和密码')
      return
    }
    setErrorMessage('')
    setLoading(true)
    try {
      const res = await login(values)
      if (res.success || res.code === 0) {
        if (res.data) setAuth(res.data.token, res.data.user)
        toast.success('登录成功')
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('登录失败:', error)
      setErrorMessage('登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>雷</div>
          <div className={styles.title}>雷犀系统</div>
          <div className={styles.subtitle}>企业级人事考勤一体化管理平台</div>
        </div>

        <div className={styles.error}>{errorMessage}</div>

        <Form layout="vertical" onSubmit={handleSubmit} className={styles.form}>
          <Form.Item field="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<IconUser />} placeholder="用户名" size="large" className={styles.input} />
          </Form.Item>
          <Form.Item field="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<IconLock />} placeholder="密码" size="large" className={styles.input} />
          </Form.Item>
          <Space size={16} direction="vertical" style={{ width: '100%' }}>
            <div className={styles.actions}>
              <Checkbox>记住密码</Checkbox>
              <Link>忘记密码？</Link>
            </div>
            <Button type="primary" long htmlType="submit" loading={loading} size="large" className={styles.submit}>
              登录
            </Button>
          </Space>
        </Form>

        <div className={styles.footer}>
          &copy; 2024 雷犀系统 · All rights reserved
        </div>
      </div>
    </div>
  )
}
Login.displayName = 'LoginPage'
export default Login
