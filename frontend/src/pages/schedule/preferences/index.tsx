import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Form,
  Select,
  Input,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
} from '@arco-design/web-react'
import {
  IconSave,
} from '@arco-design/web-react/icon'
import {
  getMySchedulePreference,
  updateMySchedulePreference,
  type SchedulePreference,
} from '@/api/schedule'
import { getShifts, Shift } from '@/api/shift'
import { getEmployees, Employee } from '@/api/personnel'
import { toast } from '@/utils/toast'
import styles from './style.module.css'
const { Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

const WEEKDAYS = [
  { value: 0, label: '周日' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
]

function PreferencesPage() {
  const [_loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [preference, setPreference] = useState<SchedulePreference | null>(null)

  const loadPreference = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMySchedulePreference()
      if (res.data) {
        setPreference(res.data)
        const preferredDays = res.data.preferredDays
          ? res.data.preferredDays.split(',').map(Number)
          : []
        const avoidDays = res.data.avoidDays
          ? res.data.avoidDays.split(',').map(Number)
          : []
        form.setFieldsValue({
          preferredShiftId: res.data.preferredShiftId,
          preferredDays,
          avoidDays,
          avoidDates: res.data.avoidDates,
          notes: res.data.notes,
        })
      }
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [form])

  const loadShifts = useCallback(async () => {
    try {
      const res = await getShifts({ page: 1, pageSize: 100, status: 'active' })
      setShifts(res.data?.list || [])
    } catch {
      // error handled by interceptor
    }
  }, [])

  useEffect(() => {
    loadPreference()
    loadShifts()
  }, [loadPreference, loadShifts])

  const handleSave = async () => {
    try {
      setSaving(true)
      const values = await form.validate()
      const data = {
        preferredShiftId: values.preferredShiftId,
        preferredDays: values.preferredDays?.join(','),
        avoidDays: values.avoidDays?.join(','),
        avoidDates: values.avoidDates,
        notes: values.notes,
      }
      await updateMySchedulePreference(data)
      toast.success('保存成功')
      loadPreference()
    } catch {
      // error handled by interceptor
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles['schedule-preferences']}>
      <Card bordered={false}>
        <div className={styles['schedule-preferences__header']}>
          <span className={styles['schedule-preferences__title']}>我的排班偏好</span>
          <Button type="primary" icon={<IconSave />} loading={saving} onClick={handleSave}>
            保存设置
          </Button>
        </div>

        <Alert
          type="info"
          title="排班偏好说明"
          content="设置您的排班偏好后，智能排班系统会在生成排班方案时优先考虑您的偏好设置。硬约束（如请假、休息间隔）会优先于偏好设置。"
          className={styles['schedule-preferences__alert']}
        />

        <Form form={form} layout="vertical">
          <Divider orientation="left">班次偏好</Divider>
          <FormItem label="偏好班次" field="preferredShiftId" tooltip="选择您最希望工作的班次">
            <Select placeholder="请选择偏好班次" allowClear className={styles['schedule-preferences__select-shift']}>
              {shifts.map((s) => (
                <Option key={s.id} value={s.id}>
                  <Space>
                    <span className={styles['schedule-preferences__shift-dot']} />
                    {s.name} ({s.startTime} - {s.endTime})
                  </Space>
                </Option>
              ))}
            </Select>
          </FormItem>

          <Divider orientation="left">工作日偏好</Divider>
          <FormItem
            label="偏好工作日"
            field="preferredDays"
            tooltip="选择您希望工作的日期（多选），系统会优先在这些日期安排班次"
          >
            <Select mode="multiple" placeholder="请选择偏好工作日" className={styles['schedule-preferences__select-days']}>
              {WEEKDAYS.map((d) => (
                <Option key={d.value} value={d.value}>{d.label}</Option>
              ))}
            </Select>
          </FormItem>

          <FormItem
            label="希望休息日"
            field="avoidDays"
            tooltip="选择您不希望工作的日期（多选），系统会尽量避免在这些日期安排班次"
          >
            <Select mode="multiple" placeholder="请选择希望休息的日期" className={styles['schedule-preferences__select-days']}>
              {WEEKDAYS.map((d) => (
                <Option key={d.value} value={d.value}>{d.label}</Option>
              ))}
            </Select>
          </FormItem>

          <Divider orientation="left">特殊日期</Divider>
          <FormItem
            label="避开特定日期"
            field="avoidDates"
            tooltip="填写您希望避开的具体日期，多个日期用逗号分隔，格式：YYYY-MM-DD，如：2024-05-01,2024-06-01"
          >
            <Input.TextArea
              placeholder="格式：YYYY-MM-DD，多个日期用逗号分隔，如：2024-05-01,2024-06-01"
              rows={2}
              className={styles['schedule-preferences__textarea-narrow']}
            />
          </FormItem>

          <Divider orientation="left">备注</Divider>
          <FormItem label="其他说明" field="notes" tooltip="填写其他需要说明的排班需求或特殊情况">
            <Input.TextArea placeholder="如有其他排班需求或特殊情况，请在此说明" rows={3} className={styles['schedule-preferences__textarea-narrow']} />
          </FormItem>
        </Form>
      </Card>

      {preference && (
        <Card bordered={false} className={styles['schedule-preferences__card-note']}>
          <Text type="secondary">当前设置生效中，系统会在下次生成排班时参考您的偏好</Text>
        </Card>
      )}
    </div>
  )
}

export default PreferencesPage
