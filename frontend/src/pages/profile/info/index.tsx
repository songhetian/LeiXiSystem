import { useState, useEffect } from 'react'
import styles from './index.module.css'
import {
  Card,
  Button,
  Input,
  Form,
  Message,
  Tag,
  Grid,
  Avatar,
  Descriptions,
  Tabs,
  Space,
  Spin,
} from '@arco-design/web-react'
import {
  IconEdit,
  IconUser,
  IconCalendar,
  IconSettings,
  IconBook,
  IconFile,
  IconClockCircle,
  IconSafe,
} from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { getMe, updateProfile } from '@/api/auth'
import type { User } from '@/types'

const { Row, Col } = Grid
const FormItem = Form.Item
const TabPane = Tabs.TabPane

const selfServiceItems = [
  {
    title: '我的工资条',
    icon: <IconBook className={styles['self-service__icon']} />,
    desc: '查看最新工资条',
    path: '/payroll/my-payslips',
  },
  {
    title: '申请报销',
    icon: <IconFile className={styles['self-service__icon']} />,
    desc: '提交新的报销申请',
    path: '/reimbursement/apply',
  },
  {
    title: '请假申请',
    icon: <IconCalendar className={styles['self-service__icon']} />,
    desc: '提交请假/调班申请',
    path: '/adjustment/leave',
  },
  {
    title: '加班申请',
    icon: <IconClockCircle className={styles['self-service__icon']} />,
    desc: '提交加班申请',
    path: '/adjustment/overtime',
  },
  {
    title: '我的排班',
    icon: <IconCalendar className={styles['self-service__icon']} />,
    desc: '查看本周排班',
    path: '/my/schedule',
  },
  {
    title: '我的考勤',
    icon: <IconCalendar className={styles['self-service__icon']} />,
    desc: '查看考勤记录',
    path: '/profile/attendance',
  },
  {
    title: '证明申请',
    icon: <IconFile className={styles['self-service__icon']} />,
    desc: '申请在职/收入证明',
    path: '/profile/certificate',
  },
  {
    title: '修改密码',
    icon: <IconSafe className={styles['self-service__icon']} />,
    desc: '修改登录密码',
    path: '/profile/password',
  },
]

function Info() {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userInfo, setUserInfo] = useState<User | null>(null)

  const fetchUserInfo = async () => {
    setLoading(true)
    try {
      const res = await getMe()
      if (res.data) {
        setUserInfo(res.data)
      }
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserInfo()
  }, [])

  const handleEdit = () => {
    form.setFieldsValue({
      phone: userInfo?.phone || '',
      email: userInfo?.email || '',
      emergencyContactName: userInfo?.emergencyContactName || '',
      emergencyContactPhone: userInfo?.emergencyContactPhone || '',
      description: userInfo?.description || '',
    })
    setEditing(true)
  }

  const handleSave = async () => {
    try {
      await form.validate()
      setSaving(true)
      const values = form.getFieldsValue()
      await updateProfile({
        phone: values.phone,
        email: values.email,
        emergencyContactName: values.emergencyContactName,
        emergencyContactPhone: values.emergencyContactPhone,
        description: values.description,
      })
      Message.success('个人资料已更新')
      setEditing(false)
      fetchUserInfo()
    } catch (err: any) {
      // Only show error if it's not a validation error
      if (err?.errors) return
      Message.error(err?.message || '保存失败，请稍后再试')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
  }

  return (
    <div className={styles['profile-info']}>
      <Row gutter={16}>
        <Col span={6}>
          <Card bordered={false} className={styles['profile-info__card-center']} loading={loading}>
            <Avatar size={80} className={styles['profile-info__avatar']}>
              <IconUser className={styles['profile-info__icon-user']} />
            </Avatar>
            <h3 className={styles['profile-info__name']}>{userInfo?.realName || '-'}</h3>
            <Tag color="blue">{userInfo?.positionName || '-'}</Tag>
            <div className={styles['profile-info__dept']}>
              {userInfo?.departmentName || '-'}
            </div>
            <Button
              type="primary"
              icon={<IconEdit />}
              className={styles['profile-info__btn-edit']}
              onClick={handleEdit}
            >
              编辑资料
            </Button>
          </Card>

          <Card bordered={false} className={styles['profile-info__section']}>
            <div className={styles['profile-info__section-title']}>快捷入口</div>
            <Space direction="vertical" size="small" className={styles['profile-info__space-full']}>
              <Button icon={<IconCalendar />} long onClick={() => navigate('/profile/attendance')}>
                我的考勤
              </Button>
              <Button icon={<IconSettings />} long onClick={() => navigate('/profile/password')}>
                修改密码
              </Button>
            </Space>
          </Card>
        </Col>

        <Col span={18}>
          <Card bordered={false} loading={loading}>
            <Tabs defaultActiveTab="basic">
              <TabPane key="basic" title="基本信息">
                <Spin loading={loading}>
                  {editing ? (
                    <Form form={form} layout="vertical">
                      <div className={styles['profile-info__readonly-section']}>
                        <Row gutter={16}>
                          <Col span={12}>
                            <FormItem label="姓名">
                              <Input value={userInfo?.realName} disabled />
                            </FormItem>
                          </Col>
                          <Col span={12}>
                            <FormItem label="工号">
                              <Input value={userInfo?.employeeNo} disabled />
                            </FormItem>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col span={12}>
                            <FormItem label="部门">
                              <Input value={userInfo?.departmentName} disabled />
                            </FormItem>
                          </Col>
                          <Col span={12}>
                            <FormItem label="岗位">
                              <Input value={userInfo?.positionName} disabled />
                            </FormItem>
                          </Col>
                        </Row>
                        <Row gutter={16}>
                          <Col span={12}>
                            <FormItem label="用户名">
                              <Input value={userInfo?.username} disabled />
                            </FormItem>
                          </Col>
                          <Col span={12}>
                            <FormItem label="角色">
                              <Input
                                value={(userInfo?.roles || []).join(', ')}
                                disabled
                              />
                            </FormItem>
                          </Col>
                        </Row>
                      </div>

                      <div className={styles['profile-info__editable-divider']}>
                        <span>以下信息可编辑</span>
                      </div>

                      <Row gutter={16}>
                        <Col span={12}>
                          <FormItem
                            label="手机号"
                            field="phone"
                            rules={[
                              { match: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
                            ]}
                          >
                            <Input placeholder="请输入手机号" />
                          </FormItem>
                        </Col>
                        <Col span={12}>
                          <FormItem
                            label="邮箱"
                            field="email"
                            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
                          >
                            <Input placeholder="请输入邮箱" />
                          </FormItem>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <FormItem label="紧急联系人" field="emergencyContactName">
                            <Input placeholder="请输入紧急联系人姓名" />
                          </FormItem>
                        </Col>
                        <Col span={12}>
                          <FormItem label="紧急联系人电话" field="emergencyContactPhone">
                            <Input placeholder="请输入紧急联系人电话" />
                          </FormItem>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={24}>
                          <FormItem label="个人简介" field="description">
                            <Input.TextArea
                              placeholder="请输入个人简介"
                              autoSize={{ minRows: 2, maxRows: 4 }}
                              maxLength={200}
                              showWordLimit
                            />
                          </FormItem>
                        </Col>
                      </Row>
                      <Space>
                        <Button type="primary" onClick={handleSave} loading={saving}>
                          保存
                        </Button>
                        <Button onClick={handleCancel}>取消</Button>
                      </Space>
                    </Form>
                  ) : (
                    <Descriptions
                      border
                      column={2}
                      data={[
                        { label: '姓名', value: userInfo?.realName || '-' },
                        { label: '工号', value: userInfo?.employeeNo || '-' },
                        { label: '部门', value: userInfo?.departmentName || '-' },
                        { label: '岗位', value: userInfo?.positionName || '-' },
                        { label: '用户名', value: userInfo?.username || '-' },
                        {
                          label: '角色',
                          value: (
                            <Space size="small">
                              {(userInfo?.roles || []).map((r: string) => (
                                <Tag key={r} color="blue">
                                  {r}
                                </Tag>
                              ))}
                            </Space>
                          ),
                        },
                        { label: '手机号', value: userInfo?.phone || '-' },
                        { label: '邮箱', value: userInfo?.email || '-' },
                        {
                          label: '紧急联系人',
                          value: userInfo?.emergencyContactName || '-',
                        },
                        {
                          label: '紧急联系人电话',
                          value: userInfo?.emergencyContactPhone || '-',
                        },
                        {
                          label: '个人简介',
                          value: userInfo?.description || '-',
                          span: 2,
                        },
                      ]}
                    />
                  )}
                </Spin>
              </TabPane>
            </Tabs>
          </Card>

          {/* Self-Service Quick Access Panel */}
          <Card
            bordered={false}
            className={styles['self-service']}
            title="自助服务"
          >
            <div className={styles['self-service__grid']}>
              {selfServiceItems.map((item) => (
                <div
                  key={item.path}
                  className={styles['self-service__card']}
                  onClick={() => navigate(item.path)}
                >
                  <div className={styles['self-service__card-icon']}>{item.icon}</div>
                  <div className={styles['self-service__card-title']}>{item.title}</div>
                  <div className={styles['self-service__card-desc']}>{item.desc}</div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Info
