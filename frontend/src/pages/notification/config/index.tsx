import { useEffect } from 'react'
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
} from '@arco-design/web-react'
import {
  IconNotification,
  IconEmail,
  IconPhone,
} from '@arco-design/web-react/icon'
import styles from './style.module.css'
const FormItem = Form.Item
const TabPane = Tabs.TabPane

const STORAGE_KEY = 'notification_config'

interface NotificationConfig {
  notificationEnabled: boolean
  soundEnabled: boolean
  desktopEnabled: boolean
  dndEnabled: boolean
  dndTime: string
  siteEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  approvalEnabled: boolean
  attendanceEnabled: boolean
  systemEnabled: boolean
}

const defaultConfig: NotificationConfig = {
  notificationEnabled: true,
  soundEnabled: true,
  desktopEnabled: false,
  dndEnabled: false,
  dndTime: '22:00 - 08:00',
  siteEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  approvalEnabled: true,
  attendanceEnabled: true,
  systemEnabled: true,
}

function loadConfig(): NotificationConfig {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? { ...defaultConfig, ...JSON.parse(data) } : defaultConfig
  } catch {
    return defaultConfig
  }
}

function saveConfig(config: NotificationConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function Config() {
  const [form] = Form.useForm()

  useEffect(() => {
    const config = loadConfig()
    form.setFieldsValue(config)
  }, [form])

  const handleSave = async () => {
    try {
      const values = await form.validate()
      saveConfig(values)
      Message.success('保存成功')
    } catch {
      // validation error
    }
  }

  return (
    <div className={styles['notification-config']}>
      <Card bordered={false}>
        <Tabs defaultActiveTab="basic">
          <TabPane key="basic" title="基础设置">
            <Form form={form} layout="vertical" className={styles['notification-config__form']}>
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
            <Form form={form} layout="vertical" className={styles['notification-config__form']}>
              <div className={styles['notification-config__channel-item']}>
                <Space size="medium">
                  <IconNotification className={styles['notification-config__icon'] + ' ' + styles['notification-config__icon--notification']} />
                  <div>
                    <div className={styles['notification-config__channel-title']}>站内消息</div>
                    <div className={styles['notification-config__channel-desc']}>系统内消息通知</div>
                  </div>
                </Space>
                <FormItem field="siteEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div className={styles['notification-config__channel-item']}>
                <Space size="medium">
                  <IconEmail className={styles['notification-config__icon'] + ' ' + styles['notification-config__icon--email']} />
                  <div>
                    <div className={styles['notification-config__channel-title']}>邮件通知</div>
                    <div className={styles['notification-config__channel-desc']}>发送邮件到绑定邮箱</div>
                  </div>
                </Space>
                <FormItem field="emailEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div className={styles['notification-config__channel-item']}>
                <Space size="medium">
                  <IconPhone className={styles['notification-config__icon'] + ' ' + styles['notification-config__icon--phone']} />
                  <div>
                    <div className={styles['notification-config__channel-title']}>短信通知</div>
                    <div className={styles['notification-config__channel-desc']}>发送短信到绑定手机</div>
                  </div>
                </Space>
                <FormItem field="smsEnabled" initialValue={false}>
                  <Switch />
                </FormItem>
              </div>
            </Form>
          </TabPane>

          <TabPane key="type" title="消息类型">
            <Form form={form} layout="vertical" className={styles['notification-config__form']}>
              <div className={styles['notification-config__type-item']}>
                <div>
                  <div className={styles['notification-config__type-title']}>审批通知</div>
                  <div className={styles['notification-config__type-desc']}>请假、报销、调班等审批相关</div>
                </div>
                <FormItem field="approvalEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div className={styles['notification-config__type-item']}>
                <div>
                  <div className={styles['notification-config__type-title']}>考勤提醒</div>
                  <div className={styles['notification-config__type-desc']}>迟到、早退、考勤异常提醒</div>
                </div>
                <FormItem field="attendanceEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
              <Divider />
              <div className={styles['notification-config__type-item']}>
                <div>
                  <div className={styles['notification-config__type-title']}>系统公告</div>
                  <div className={styles['notification-config__type-desc']}>系统维护、更新等公告</div>
                </div>
                <FormItem field="systemEnabled" initialValue={true}>
                  <Switch />
                </FormItem>
              </div>
            </Form>
          </TabPane>
        </Tabs>

        <div className={styles['notification-config__footer']}>
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
