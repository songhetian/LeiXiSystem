import { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Switch,
  TimePicker,
  Button,
  Message,
  Space,
  Divider,
  Tag,
} from '@arco-design/web-react'
import {
  IconNotification,
} from '@arco-design/web-react/icon'
import { getMessagePreferences, updateMessagePreferences } from '@/api/messagePreference'
import { PageHeader } from '@/components'
import styles from './preferences.module.css'
const FormItem = Form.Item

const NOTIFICATION_TYPES = [
  { value: 'system', label: '系统通知', description: '系统维护、版本更新等系统消息' },
  { value: 'approval', label: '审批通知', description: '请假、报销、加班等审批结果' },
  { value: 'attendance', label: '考勤通知', description: '打卡异常、考勤统计等考勤消息' },
  { value: 'schedule', label: '排班通知', description: '排班变更、新排班发布等消息' },
  { value: 'payroll', label: '薪资通知', description: '工资条发布、薪资调整等消息' },
]

export default function MessagePreferences() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await getMessagePreferences()
      if (res.code === 0) {
        const data = res.data
        form.setFieldsValue({
          enableSound: data.enableSound,
          enableDesktop: data.enableDesktop,
          mutedTypes: data.mutedTypes || [],
          dndStart: data.doNotDisturbStart,
          dndEnd: data.doNotDisturbEnd,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSave = async () => {
    const values = await form.validate()
    setSaving(true)
    try {
      await updateMessagePreferences({
        mutedTypes: values.mutedTypes || [],
        enableSound: values.enableSound,
        enableDesktop: values.enableDesktop,
        doNotDisturbStart: values.dndStart,
        doNotDisturbEnd: values.dndEnd,
      })
      Message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles['message-preferences']}>
      <PageHeader title="消息设置" description="设置消息通知偏好、免打扰时段等。" />

      <Card bordered={false} style={{ marginTop: 16 }} loading={loading}>
        <Form form={form} layout="vertical">
          <h3 style={{ marginBottom: 16 }}>
            <IconNotification style={{ marginRight: 8 }} />
            通知方式
          </h3>

          <div style={{ display: 'flex', gap: 40, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconNotification style={{ fontSize: 20, color: 'var(--color-primary-6)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>声音提醒</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>收到新消息时播放提示音</div>
              </div>
              <FormItem field="enableSound" style={{ marginBottom: 0, marginLeft: 'auto' }}>
                <Switch />
              </FormItem>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconNotification style={{ fontSize: 20, color: 'var(--color-primary-6)' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>桌面通知</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>收到新消息时弹出桌面通知</div>
              </div>
              <FormItem field="enableDesktop" style={{ marginBottom: 0, marginLeft: 'auto' }}>
                <Switch />
              </FormItem>
            </div>
          </div>

          <Divider />

          <h3 style={{ marginBottom: 16 }}>
            <IconNotification style={{ marginRight: 8 }} />
            免打扰设置
          </h3>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 12 }}>
              设置免打扰时段后，在该时段内收到消息将不会弹出提醒，但消息仍会正常接收。
            </div>
            <Space size="large">
              <FormItem label="开始时间" field="dndStart">
                <TimePicker format="HH:mm" placeholder="选择开始时间" />
              </FormItem>
              <FormItem label="结束时间" field="dndEnd">
                <TimePicker format="HH:mm" placeholder="选择结束时间" />
              </FormItem>
            </Space>
          </div>

          <Divider />

          <h3 style={{ marginBottom: 16 }}>
            <IconNotification style={{ marginRight: 8 }} />
            消息类型设置
          </h3>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-2)', marginBottom: 12 }}>
              关闭后将不会接收对应类型的消息通知。
            </div>
          </div>

          <FormItem field="mutedTypes" style={{ marginBottom: 0 }}>
            <div>
              {NOTIFICATION_TYPES.map(type => (
                <div
                  key={type.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'var(--color-fill-2)',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                      {type.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-3)' }}>
                      {type.description}
                    </div>
                  </div>
                  <Tag color="green">接收</Tag>
                </div>
              ))}
            </div>
          </FormItem>

          <div style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border-2)',
            textAlign: 'right',
          }}>
            <Space>
              <Button onClick={() => form.resetFields()}>重置</Button>
              <Button type="primary" loading={saving} onClick={handleSave}>
                保存设置
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  )
}
