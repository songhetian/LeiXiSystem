import { useState } from 'react'
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
} from '@arco-design/web-react'
import {
  IconEdit,
  IconUser,
  IconCalendar,
  IconSettings,
} from '@arco-design/web-react/icon'

const { Row, Col } = Grid
const FormItem = Form.Item
const TabPane = Tabs.TabPane

function Info() {
  const [editing, setEditing] = useState(false)
  const [form] = Form.useForm()

  const userInfo = {
    name: '张三',
    employeeNo: 'EMP001',
    department: '技术部',
    position: '高级工程师',
    phone: '13800138001',
    email: 'zhangsan@example.com',
    entryDate: '2023-01-15',
    status: '在职',
  }

  const handleEdit = () => {
    form.setFieldsValue(userInfo)
    setEditing(true)
  }

  const handleSave = async () => {
    try {
      await form.validate()
      Message.success('保存成功')
      setEditing(false)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card bordered={false} style={{ textAlign: 'center' }}>
            <Avatar size={80} style={{ marginBottom: 16 }}>
              <IconUser style={{ fontSize: 40 }} />
            </Avatar>
            <h3 style={{ marginBottom: 4 }}>{userInfo.name}</h3>
            <Tag color="blue">{userInfo.position}</Tag>
            <div style={{ marginTop: 16, color: '#86909C' }}>
              {userInfo.department}
            </div>
            <Button
              type="primary"
              icon={<IconEdit />}
              style={{ marginTop: 20, width: '100%' }}
              onClick={handleEdit}
            >
              编辑资料
            </Button>
          </Card>

          <Card bordered={false} style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 12, fontWeight: 600 }}>快捷入口</div>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button icon={<IconCalendar />} long>我的考勤</Button>
              <Button icon={<IconSettings />} long>修改密码</Button>
            </Space>
          </Card>
        </Col>

        <Col span={18}>
          <Card bordered={false}>
            <Tabs defaultActiveTab="basic">
              <TabPane key="basic" title="基本信息">
                {editing ? (
                  <Form form={form} layout="vertical">
                    <Row gutter={16}>
                      <Col span={12}>
                        <FormItem label="姓名" field="name">
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
                        <FormItem label="部门" field="department">
                          <Input disabled />
                        </FormItem>
                      </Col>
                      <Col span={12}>
                        <FormItem label="岗位" field="position">
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
                      <Button type="primary" onClick={handleSave}>保存</Button>
                      <Button onClick={() => setEditing(false)}>取消</Button>
                    </Space>
                  </Form>
                ) : (
                  <Descriptions
                    border
                    column={2}
                    data={[
                      { label: '姓名', value: userInfo.name },
                      { label: '工号', value: userInfo.employeeNo },
                      { label: '部门', value: userInfo.department },
                      { label: '岗位', value: userInfo.position },
                      { label: '手机号', value: userInfo.phone },
                      { label: '邮箱', value: userInfo.email },
                      { label: '入职日期', value: userInfo.entryDate },
                      { label: '状态', value: <Tag color="green">{userInfo.status}</Tag> },
                    ]}
                  />
                )}
              </TabPane>
              <TabPane key="work" title="工作信息">
                <Descriptions
                  border
                  column={2}
                  data={[
                    { label: '直属上级', value: '李经理' },
                    { label: '所属部门', value: '技术部-前端组' },
                    { label: '入职日期', value: '2023-01-15' },
                    { label: '转正日期', value: '2023-04-15' },
                    { label: '工龄', value: '1年5个月' },
                    { label: '员工类型', value: '正式员工' },
                  ]}
                />
              </TabPane>
              <TabPane key="contact" title="紧急联系人">
                <Descriptions
                  border
                  column={2}
                  data={[
                    { label: '紧急联系人', value: '李四' },
                    { label: '关系', value: '配偶' },
                    { label: '联系电话', value: '13900139000' },
                    { label: '家庭住址', value: '北京市朝阳区xxx街道xxx号' },
                  ]}
                />
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Info
