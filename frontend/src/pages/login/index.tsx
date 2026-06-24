import { useState } from 'react'
import { Form, Input, Button, Checkbox, Message, Card, Space, Typography, Divider, Grid } from '@arco-design/web-react'
import {
  IconDashboard,
  IconClockCircle,
  IconSafe,
  IconUser,
  IconLock,
} from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/user'
import { login } from '@/api/auth'
import './index.css'

const { Title, Text } = Typography

function Login() {
  const navigate = useNavigate()
  const setToken = useUserStore((state) => state.setToken)
  const setUser = useUserStore((state) => state.setUser)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { username: string; password: string }) => {
    if (!values.username || !values.password) {
      Message.warning('请输入用户名和密码')
      return
    }

    setLoading(true)
    try {
      const res: any = await login(values)
      if (res.success) {
        setToken(res.data.token)
        setUser(res.data.user)
        Message.success('登录成功')
        navigate('/dashboard')
      }
    } catch (error) {
      console.error('登录失败:', error)
      Message.error('登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: IconDashboard, title: '数据可视化', desc: '多维度数据分析，助力企业决策' },
    { icon: IconClockCircle, title: '高效审批', desc: '灵活的审批流程，提升办公效率' },
    { icon: IconSafe, title: '安全可靠', desc: '企业级安全保障，数据加密存储' },
  ]

  return (
    <div className="login-page">
      <div className="login-wrapper">
        <div className="login-left">
          <div className="brand">
            <div className="brand-logo">雷</div>
            <div>
              <div className="brand-name">雷犀系统</div>
              <div className="brand-slogan">企业级人事考勤一体化管理平台</div>
            </div>
          </div>
          
          <div className="login-illustration">
            {features.map((item, index) => {
              const IconComp = item.icon
              return (
                <div className="illustration-card" key={index}>
                  <div className="illustration-icon">
                    <IconComp style={{ fontSize: 20, color: '#fff' }} />
                  </div>
                  <div>
                    <div className="illustration-title">{item.title}</div>
                    <div className="illustration-desc">{item.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="login-right">
          <Card className="login-card" bordered={false}>
            <Space direction="vertical" size={32} style={{ width: '100%' }}>
              <div>
                <Title heading={4} style={{ margin: '0 0 8px 0' }}>
                  账号登录
                </Title>
                <Text type="secondary">请输入您的账号信息登录系统</Text>
              </div>

              <Form
                onSubmit={handleSubmit}
                layout="vertical"
                initialValues={{ remember: true }}
              >
                <Form.Item field="username" label="用户名">
                  <Input
                    size="large"
                    placeholder="请输入用户名"
                    allowClear
                    prefix={<IconUser style={{ color: 'rgb(var(--text-3))' }} />}
                  />
                </Form.Item>

                <Form.Item field="password" label="密码">
                  <Input.Password
                    size="large"
                    placeholder="请输入密码"
                    prefix={<IconLock style={{ color: 'rgb(var(--text-3))' }} />}
                  />
                </Form.Item>

                <Form.Item>
                  <Space
                    direction="horizontal"
                    justify="space-between"
                    style={{ width: '100%' }}
                  >
                    <Checkbox>记住密码</Checkbox>
                    <a style={{ color: 'rgb(var(--primary-6))' }}>忘记密码？</a>
                  </Space>
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    long
                    size="large"
                    loading={loading}
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>

              <Divider style={{ margin: 0 }} />

              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  © 2024 雷犀系统 版权所有
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
