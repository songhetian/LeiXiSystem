import { useState } from 'react'
import {
  Card,
  Button,
  Select,
  Space,
  Modal,
  Form,
  Message,
  Tag,
  Table,
  Grid,
  Calendar,
  Badge,
} from '@arco-design/web-react'
import {
  IconLeft,
  IconRight,
  IconPlus,
  IconEdit,
} from '@arco-design/web-react/icon'

const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

interface ScheduleDay {
  date: string
  shifts: { name: string; color: string; count: number }[]
}

const mockCalendarData: Record<string, ScheduleDay> = {}

function generateCalendarData() {
  const colors: Record<string, string> = {
    '标准早班': 'blue',
    '午班': 'orange',
    '夜班': 'purple',
    '休息': 'gray',
  }
  for (let i = 1; i <= 30; i++) {
    const date = `2024-06-${String(i).padStart(2, '0')}`
    const day = new Date(date).getDay()
    if (day === 0 || day === 6) {
      mockCalendarData[date] = {
        date,
        shifts: [{ name: '休息', color: 'gray', count: 120 }],
      }
    } else {
      mockCalendarData[date] = {
        date,
        shifts: [
          { name: '标准早班', color: 'blue', count: 80 },
          { name: '午班', color: 'orange', count: 30 },
          { name: '夜班', color: 'purple', count: 10 },
        ],
      }
    }
  }
}
generateCalendarData()

function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2024, 5, 1))
  const [visible, setVisible] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [form] = Form.useForm()
  const [department, setDepartment] = useState<string>('全部')

  const dateCellRender = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayData = mockCalendarData[dateStr]

    if (!dayData) return null

    return (
      <div style={{ fontSize: 12 }}>
        {dayData.shifts.map((shift, index) => (
          <Badge
            key={index}
            color={shift.color}
            text={`${shift.name} ${shift.count}人`}
            style={{ display: 'block', marginBottom: 2 }}
          />
        ))}
      </div>
    )
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDateSelect = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    setSelectedDate(dateStr)
    setVisible(true)
  }

  const handleOk = async () => {
    try {
      await form.validate()
      Message.success('排班设置成功')
      setVisible(false)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <FormItem label="部门">
            <Select style={{ width: 150 }} value={department} onChange={setDepartment}>
              <Option value="全部">全部部门</Option>
              <Option value="技术部">技术部</Option>
              <Option value="产品部">产品部</Option>
              <Option value="市场部">市场部</Option>
              <Option value="人事部">人事部</Option>
              <Option value="财务部">财务部</Option>
              <Option value="运营部">运营部</Option>
            </Select>
          </FormItem>
          <FormItem>
            <Space size="small">
              <Button icon={<IconLeft />} onClick={handlePrevMonth} />
              <Button type="primary" icon={<IconPlus />}>
                批量排班
              </Button>
              <Button icon={<IconRight />} onClick={handleNextMonth} />
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月 排班日历
          </span>
          <Space size="small">
            <Tag color="blue">早班 80人</Tag>
            <Tag color="orange">午班 30人</Tag>
            <Tag color="purple">夜班 10人</Tag>
            <Tag color="gray">休息</Tag>
          </Space>
        </div>

        <Calendar
          dateCellRender={dateCellRender}
          panel={false}
          defaultValue={currentMonth}
          onSelect={handleDateSelect}
        />
      </Card>

      <Modal
        title={`排班设置 - ${selectedDate}`}
        visible={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={560}
      >
        <Form form={form} layout="vertical">
          <FormItem label="班次类型">
            <Select placeholder="请选择班次" style={{ width: '100%' }}>
              <Option value="morning">标准早班</Option>
              <Option value="afternoon">午班</Option>
              <Option value="night">夜班</Option>
              <Option value="rest">休息</Option>
            </Select>
          </FormItem>
          <FormItem label="排班人员">
            <Select mode="multiple" placeholder="请选择人员" style={{ width: '100%' }}>
              <Option value="1">张三 (EMP001)</Option>
              <Option value="2">李四 (EMP002)</Option>
              <Option value="3">王五 (EMP003)</Option>
              <Option value="4">赵六 (EMP004)</Option>
              <Option value="5">钱七 (EMP005)</Option>
            </Select>
          </FormItem>
          <FormItem label="备注">
            <Form.Item field="remark">
              <Form.TextArea placeholder="请输入备注" rows={3} />
            </Form.Item>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default CalendarPage
