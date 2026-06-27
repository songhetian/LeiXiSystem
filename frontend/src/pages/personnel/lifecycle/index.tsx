import { useCallback, useEffect, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Message, Modal, Select, Space, Table, Tabs, Tag } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconCheck, IconPlus } from '@arco-design/web-react/icon'
import { completeLifecycleEvent, createLifecycleEvent, getLifecycleEvents, getOffboardingTasks, getOnboardingTasks } from '@/api/lifecycle'
import { getEmployees } from '@/api/personnel'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

type LifecycleEvent = {
  id: number
  eventType: string
  title: string
  effectiveDate: string
  status: string
  employee?: {
    employeeNo: string
    user?: { realName: string }
  }
  creator?: { realName: string }
}

type LifecycleTask = {
  id: number
  title: string
  status: string
  dueDate?: string
  employee?: {
    employeeNo: string
    user?: { realName: string }
  }
  assignee?: { realName: string }
}

const eventTypeOptions = [
  { value: 'onboarding', label: '入职' },
  { value: 'probation', label: '转正' },
  { value: 'transfer', label: '调岗' },
  { value: 'promotion', label: '晋升' },
  { value: 'salary_adjustment', label: '薪资调整' },
  { value: 'offboarding', label: '离职' },
  { value: 'rehire', label: '返聘' },
]

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'orange' },
  processing: { text: '处理中', color: 'blue' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
}

function LifecycleStatusTag({ value }: { value: string }) {
  const info = statusMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function LifecyclePage() {
  const [events, setEvents] = useState<LifecycleEvent[]>([])
  const [onboardingTasks, setOnboardingTasks] = useState<LifecycleTask[]>([])
  const [offboardingTasks, setOffboardingTasks] = useState<LifecycleTask[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [form] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [eventRes, onboardingRes, offboardingRes, employeeRes]: any[] = await Promise.all([
        getLifecycleEvents({ page: 1, pageSize: 20 }),
        getOnboardingTasks({ page: 1, pageSize: 20 }),
        getOffboardingTasks({ page: 1, pageSize: 20 }),
        getEmployees({ page: 1, pageSize: 100, status: 'active' }),
      ])
      setEvents(eventRes?.data?.list || [])
      setOnboardingTasks(onboardingRes?.data?.list || [])
      setOffboardingTasks(offboardingRes?.data?.list || [])
      setEmployees(employeeRes?.data?.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateEvent = async () => {
    const values = await form.validate()
    await createLifecycleEvent(values)
    Message.success('生命周期事件已创建')
    setVisible(false)
    form.resetFields()
    loadData()
  }

  const eventColumns: TableProps<LifecycleEvent>['columns'] = [
    {
      title: '员工',
      render: (_: any, record) => `${record.employee?.user?.realName || '-'}（${record.employee?.employeeNo || '-'}）`,
    },
    {
      title: '类型',
      dataIndex: 'eventType',
      width: 120,
      render: (value) => <Tag color="blue">{eventTypeOptions.find((item) => item.value === value)?.label || value}</Tag>,
    },
    { title: '标题', dataIndex: 'title' },
    {
      title: '生效日期',
      dataIndex: 'effectiveDate',
      width: 140,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value) => <LifecycleStatusTag value={value} />,
    },
    {
      title: '创建人',
      width: 120,
      render: (_: any, record) => record.creator?.realName || '-',
    },
    {
      title: '操作',
      width: 120,
      render: (_: any, record) => record.status !== 'completed' ? (
        <Button
          size="small"
          type="text"
          icon={<IconCheck />}
          onClick={async () => {
            await completeLifecycleEvent(record.id)
            Message.success('已完成')
            loadData()
          }}
        >
          完成
        </Button>
      ) : null,
    },
  ]

  const taskColumns: TableProps<LifecycleTask>['columns'] = [
    {
      title: '员工',
      render: (_: any, record) => `${record.employee?.user?.realName || '-'}（${record.employee?.employeeNo || '-'}）`,
    },
    { title: '任务', dataIndex: 'title' },
    {
      title: '负责人',
      width: 120,
      render: (_: any, record) => record.assignee?.realName || '-',
    },
    {
      title: '截止日期',
      dataIndex: 'dueDate',
      width: 140,
      render: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value) => <LifecycleStatusTag value={value} />,
    },
  ]

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>员工生命周期</span>
            <Tag color="blue" style={{ marginLeft: 8 }}>入职、转正、调岗、晋升、离职</Tag>
          </div>
          <Button type="primary" icon={<IconPlus />} onClick={() => setVisible(true)}>
            新增事件
          </Button>
        </div>

        <Tabs defaultActiveTab="events">
          <TabPane key="events" title="生命周期事件">
            <Table rowKey="id" loading={loading} columns={eventColumns} data={events} pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane key="onboarding" title="入职任务">
            <Table rowKey="id" loading={loading} columns={taskColumns} data={onboardingTasks} pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane key="offboarding" title="离职任务">
            <Table rowKey="id" loading={loading} columns={taskColumns} data={offboardingTasks} pagination={{ pageSize: 10 }} />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="新增生命周期事件"
        visible={visible}
        onOk={handleCreateEvent}
        onCancel={() => setVisible(false)}
        style={{ width: 560 }}
      >
        <Form form={form} layout="vertical" initialValues={{ eventType: 'onboarding', status: 'pending' }}>
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select placeholder="请选择员工" showSearch>
              {employees.map((employee) => (
                <Option key={employee.id} value={employee.id}>
                  {employee.realName}（{employee.employeeNo}）
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="事件类型" field="eventType" rules={[{ required: true, message: '请选择事件类型' }]}>
            <Select>
              {eventTypeOptions.map((item) => <Option key={item.value} value={item.value}>{item.label}</Option>)}
            </Select>
          </FormItem>
          <FormItem label="标题" field="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="例如：张三入职流程" />
          </FormItem>
          <FormItem label="生效日期" field="effectiveDate" rules={[{ required: true, message: '请选择生效日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </FormItem>
          <FormItem label="状态" field="status">
            <Select>
              <Option value="pending">待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </FormItem>
          <FormItem label="说明" field="description">
            <Input.TextArea rows={3} placeholder="补充说明" />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default LifecyclePage
