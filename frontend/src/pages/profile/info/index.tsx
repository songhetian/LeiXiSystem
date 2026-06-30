import { useState, useEffect } from 'react'
import './index.css';
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
} from '@arco-design/web-react/icon'
import { useNavigate } from 'react-router-dom'
import { getMe } from '@/api/auth'
import type { User } from '@/types'

const { Row, Col } = Grid
const FormItem = Form.Item
const TabPane = Tabs.TabPane

function Info() {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
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
      realName: userInfo?.realName,
      employeeNo: userInfo?.employeeNo,
      departmentName: userInfo?.departmentName,
      positionName: userInfo?.positionName,
      phone: userInfo?.phone,
      email: userInfo?.email,
    })
    setEditing(true)
  }

  const handleSave = async () => {
    try {
      await form.validate()
      Message.info('个人资料编辑功能暂未开放')
      setEditing(false)
    } catch {
      // error handled by interceptor
    }
  }

  return (
    <div className="profile-info">
      <Row gutter={16}>
        <Col span={6}>
          <Card bordered={false} className="profile-info__card-center" loading={loading}>
            <Avatar size={80} className="profile-info__avatar">
              <IconUser className="profile-info__icon-user" />
            </Avatar>
            <h3 className="profile-info__name">{userInfo?.realName || '-'}</h3>
            <Tag color="blue">{userInfo?.positionName || '-'}</Tag>
            <div className="profile-info__dept">
              {userInfo?.departmentName || '-'}
            </div>
            <Button
              type="primary"
              icon={<IconEdit />}
              className="profile-info__btn-edit"
              onClick={handleEdit}
            >
              编辑资料
            </Button>
          </Card>

          <Card bordered={false} className="profile-info__section">
            <div className="profile-info__section-title">快捷入口</div>
            <Space direction="vertical" size="small" className="profile-info__space-full">
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
                      <Row gutter={16}>
                        <Col span={12}>
                          <FormItem label="姓名" field="realName">
                            <Input />
                          </FormItem>
                        </Col>
                        <Col span={12}>
                          <FormItem label="工号" field="employeeNo">
                            <Input disabled />
                          </FormItem>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <FormItem label="部门" field="departmentName">
                            <Input disabled />
                          </FormItem>
                        </Col>
                        <Col span={12}>
                          <FormItem label="岗位" field="positionName">
                            <Input disabled />
                          </FormItem>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <FormItem label="手机号" field="phone">
                            <Input />
                          </FormItem>
                        </Col>
                        <Col span={12}>
                          <FormItem label="邮箱" field="email">
                            <Input />
                          </FormItem>
                        </Col>
                      </Row>
                      <Space>
                        <Button type="primary" onClick={handleSave}>
                          保存
                        </Button>
                        <Button onClick={() => setEditing(false)}>取消</Button>
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
                        { label: '手机号', value: userInfo?.phone || '-' },
                        { label: '邮箱', value: userInfo?.email || '-' },
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
                      ]}
                    />
                  )}
                </Spin>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Info
