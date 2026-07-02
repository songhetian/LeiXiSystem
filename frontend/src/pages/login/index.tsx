import { useState } from 'react'
import { Form, Input, Button, Checkbox, Card, Space, Typography, Divider } from '@arco-design/web-react'
import {
  IconDashboard,
  IconClockCircle,
  IconSafe,
  IconUser,
  IconLock,
} from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import { login } from '@/api/auth'
import { toast } from '@/utils/toast'
import styles from './index.module.css'
const { Title, Text } = Typography

function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { username: string; password: string }) => {
    if (!values.username || !values.password) {
      toast.warning('请输入用户名和密码')
      return
    }

    setLoading(true)
    try {
      const res = await login(values)
      if (res.success || res.code === 0) {
        if (res.data) {
          setAuth(res.data.token, res.data.user)
        }
        toast.success('登录成功')
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('登录失败:', error)
      toast.error('登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: IconClockCircle, title: '智能考勤', desc: 'AI驱动的智能考勤管理，多维度数据分析' },
    { icon: IconDashboard, title: '数据驾驶舱', desc: '实时数据可视化，一站式企业决策看板' },
    { icon: IconSafe, title: '安全合规', desc: '企业级安全防护，全链路数据加密存储' },
  ]

  return (
    <div className={styles['login-page']}>
      <div className={styles['login-wrapper']}>
        {/* Left Panel - Brand Identity */}
        <div className={styles['login-left']}>
          <div className={styles['geometric-overlay']} />

          <div className={styles['brand']}>
            <div className={styles['brand-logo']}>
              <span className={styles['brand-logo-text']}>雷</span>
            </div>
            <div>
              <div className={styles['brand-name']}>雷犀系统</div>
              <div className={styles['brand-slogan']}>企业级人事考勤一体化管理平台</div>
            </div>
          </div>

          <div className={styles['features-section']}>
            {features.map((item, index) => {
              const IconComp = item.icon
              return (
                <div className={styles['feature-card']} key={index}>
                  <div className={styles['feature-icon']}>
                    <IconComp className={styles['feature-icon-svg']} />
                  </div>
                  <div>
                    <div className={styles['feature-title']}>{item.title}</div>
                    <div className={styles['feature-desc']}>{item.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className={styles['login-right']}>
          <Card className={styles['login-card']} bordered={false}>
            <Space direction="vertical" size={28} className={styles['login-form-space']}>
              <div className={styles['form-header']}>
                <Title heading={4} className={styles['form-title']}>
                  欢迎回来
                </Title>
                <Text type="secondary" className={styles['form-subtitle']}>
                  登录您的雷犀系统账号
                </Text>
              </div>

              <Form
                onSubmit={handleSubmit}
                layout="vertical"
                className={styles['login-form']}
              >
                <Form.Item field="username" label="用户名">
                  <Input
                    size="large"
                    placeholder="请输入用户名"
                    allowClear
                    prefix={<IconUser className={styles['input-icon-prefix']} />}
                    className={styles['login-input']}
                  />
                </Form.Item>

                <Form.Item field="password" label="密码">
                  <Input.Password
                    size="large"
                    placeholder="请输入密码"
                    prefix={<IconLock className={styles['input-icon-prefix']} />}
                    className={styles['login-input']}
                  />
                </Form.Item>

                <Form.Item>
                  <Space
                    direction="horizontal"
                    className={styles['form-actions']}
                  >
                    <Checkbox>记住密码</Checkbox>
                    <a className={styles['forgot-link']}>忘记密码？</a>
                  </Space>
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    long
                    size="large"
                    loading={loading}
                    className={styles['submit-btn']}
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>

              <Divider className={styles['form-divider']} />

              <div className={styles['form-footer']}>
                <Text type="secondary" className={styles['footer-text']}>
                  &copy; 2024 雷犀系统 All rights reserved.
                </Text>
              </div>
            </Space>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Login
