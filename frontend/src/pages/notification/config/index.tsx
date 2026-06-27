import { useState } from 'react'
import {
  Card,
  Form,
  Switch,
  Button,
  Space,
  Message,
  Divider,
  Tabs,
  Input,
  Select,
} from '@arco-design/web-react'
import {
  IconNotification,
  IconMessage,
  IconEmail,
  IconPhone,
} from '@arco-design/web-react/icon'

const FormItem = Form.Item
const TabPane = Tabs.TabPane
const Option = Select.Option
const TextArea = Input.TextArea

function Config() {
  const [form] = Form.useForm()

  const handleSave = async () => {
    try {
      const values = await form.validate()
      console.log('配置值:', values)
      Message.success('保存成功')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false}>
        <Tabs defaultActiveTab="basic">
          <TabPane key="basic" title="基础设置">
            <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
              <FormItem label="消息通知" field="notificationEnabled" initialValue={true}>
                <Switch />
              </FormItem>
              <FormItem label="声音提醒" field="soundEnabled" initialValue={true}>
                <Switch />
              </FormItem>
              <FormItem label="桌面通知" field="desktopEnabled" initialValue={false}>
                <Switch />
              </FormItem>
              <FormItem label="免打扰模式" field="dndEnabled" initialValue={false}>
                <Switch />
              </FormItem>
              <FormItem label="免打扰时段" field="dndTime">
                <Input defaultValue="22:00 - 08:00" />
              </FormItem>
            </Form>
          </TabPane>

          <TabPane key="channel" title="通知渠道">
            <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Space size="medium">
                  <IconNotification style={{ fontSize: 20, color: '#165DFF' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>站内消息</div>
                    <div style={{ color: '#86909C', fontSize: 12 }}>系统内消息通知</div>
                  </div>
                </Space>
                <FormItem field="siteEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Space size="medium">
                  <IconEmail style={{ fontSize: 20, color: '#00B42A' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>邮件通知</div>
                    <div style={{ color: '#86909C', fontSize: 12 }}>发送邮件到绑定邮箱</div>
                  </div>
                </Space>
                <FormItem field="emailEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Space size="medium">
                  <IconPhone style={{ fontSize: 20, color: '#FF7D00' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>短信通知</div>
                    <div style={{ color: '#86909C', fontSize: 12 }}>发送短信到绑定手机</div>
                  </div>
                </Space>
                <FormItem field="smsEnabled" initialValue={false}>
                  <Switch />
                </FormItem>
              </div>
            </Form>
          </TabPane>

          <TabPane key="type" title="消息类型">
            <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>审批通知</div>
                  <div style={{ color: '#86909C', fontSize: 12 }}>请假、报销、调班等审批相关</div>
                </div>
                <FormItem field="approvalEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>考勤提醒</div>
                  <div style={{ color: '#86909C', fontSize: 12 }}>迟到、早退、考勤异常提醒</div>
                </div>
                <FormItem field="attendanceEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>系统公告</div>
                  <div style={{ color: '#86909C', fontSize: 12 }}>系统维护、更新等公告</div>
                </div>
                <FormItem field="systemEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
            </Form>
          </TabPane>
        </Tabs>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Space size="large">
            <Button onClick={() => form.resetFields()}>重置</Button>
            <Button type="primary" onClick={handleSave}>保存配置</Button>
          </Space>
        </div>
      </Card>
    </div>
  )
}

export default Config
