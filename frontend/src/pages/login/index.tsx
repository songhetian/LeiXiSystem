import { useState } from 'react'
import { Form, Input, Button, Checkbox, Message, Card, Space, Typography, Divider } from '@arco-design/web-react'
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
import styles from './index.module.css'
const { Title, Text } = Typography

function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { username: string; password: string }) => {
    if (!values.username || !values.password) {
      Message.warning('请输入用户名和密码')
      return
    }

    setLoading(true)
    try {
      const res = await login(values)
      if (res.success || res.code === 0) {
        if (res.data) {
          setAuth(res.data.token, res.data.user)
        }
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
    <div className={styles['login-page']}>
      <div className={styles['login-wrapper']}>
        <div className={styles['login-left']}>
          <div className={styles.brand}>
            <div className={styles['brand-logo']}>雷</div>
            <div>
              <div className={styles['brand-name']}>雷犀系统</div>
              <div className={styles['brand-slogan']}>企业级人事考勤一体化管理平台</div>
            </div>
          </div>
          
          <div className={styles['login-illustration']}>
            {features.map((item, index) => {
              const IconComp = item.icon
              return (
                <div className={styles['illustration-card']} key={index}>
                  <div className={styles['illustration-icon']}>
                    <IconComp className={styles['login-illustration-icon']} />
                  </div>
                  <div>
                    <div className={styles['illustration-title']}>{item.title}</div>
                    <div className={styles['illustration-desc']}>{item.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles['login-right']}>
          <Card className={styles['login-card']} bordered={false}>
            <Space direction="vertical" size={32} className={styles['login-form__space']}>
              <div>
                <Title heading={4} className={styles['login-form__title']}>
                  账号登录
                </Title>
                <Text type="secondary">请输入您的账号信息登录系统</Text>
              </div>

              <Form
                onSubmit={handleSubmit}
                layout="vertical"

              >
                <Form.Item field="username" label="用户名">
                  <Input
                    size="large"
                    placeholder="请输入用户名"
                    allowClear
                    prefix={<IconUser className={styles['login-form__icon-prefix']} />}
                  />
                </Form.Item>

                <Form.Item field="password" label="密码">
                  <Input.Password
                    size="large"
                    placeholder="请输入密码"
                    prefix={<IconLock className={styles['login-form__icon-prefix']} />}
                  />
                </Form.Item>

                <Form.Item>
                  <Space
                    direction="horizontal"
                    className={styles['login-form__actions']}
                  >
                    <Checkbox>记住密码</Checkbox>
                    <a className={styles['login-form__link']}>忘记密码？</a>
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

              <Divider className={styles['login-form__divider']} />

              <div className={styles['login-form__footer']}>
                <Text type="secondary" className={styles['login-form__footer-text']}>
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
