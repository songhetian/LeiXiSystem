import { useCallback, useEffect, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, InputNumber, Message, Modal, Select, Space, Table, Tabs, Tag } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconPlus, IconRefresh } from '@arco-design/web-react/icon'
import { createPerformanceCycle, createPerformanceGoal, createPerformanceReview, getPerformanceCycles, getPerformanceGoals, getPerformanceReviews } from '@/api/performance'
import { getEmployees, type Employee } from '@/api/personnel'
import styles from './overview.module.css'
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const RangePicker = DatePicker.RangePicker

type Cycle = {
  id: number
  name: string
  cycleType: string
  startDate: string
  endDate: string
  status: string
  _count?: { goals: number; reviews: number }
}

type Goal = {
  id: number
  title: string
  weight: number
  progress: number
  status: string
  cycle?: { name: string }
  employee?: { employeeNo: string; user?: { realName: string } }
}

type Review = {
  id: number
  finalScore?: number
  rating?: string
  status: string
  cycle?: { name: string }
  employee?: { employeeNo: string; user?: { realName: string } }
  reviewer?: { realName: string }
}

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  active: { text: '进行中', color: 'green' },
  closed: { text: '已关闭', color: 'gray' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
  self_submitted: { text: '自评已交', color: 'blue' },
  reviewed: { text: '已评审', color: 'green' },
  confirmed: { text: '已确认', color: 'purple' },
}

function StatusTag({ value }: { value: string }) {
  const info = statusMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function PerformanceOverviewPage() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [cycleVisible, setCycleVisible] = useState(false)
  const [goalVisible, setGoalVisible] = useState(false)
  const [reviewVisible, setReviewVisible] = useState(false)
  const [cycleForm] = Form.useForm()
  const [goalForm] = Form.useForm()
  const [reviewForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cycleRes, goalRes, reviewRes, employeeRes]: any[] = await Promise.all([
        getPerformanceCycles({ page: 1, pageSize: 100 }),
        getPerformanceGoals({ page: 1, pageSize: 100 }),
        getPerformanceReviews({ page: 1, pageSize: 100 }),
        getEmployees({ page: 1, pageSize: 100, status: 'active' }),
      ])
      setCycles(cycleRes?.data?.list || [])
      setGoals(goalRes?.data?.list || [])
      setReviews(reviewRes?.data?.list || [])
      setEmployees(employeeRes?.data?.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateCycle = async () => {
    const values = await cycleForm.validate()
    const [startDate, endDate] = values.dateRange || []
    await createPerformanceCycle({ ...values, startDate, endDate })
    Message.success('绩效周期已创建')
    setCycleVisible(false)
    cycleForm.resetFields()
    loadData()
  }

  const handleCreateGoal = async () => {
    const values = await goalForm.validate()
    await createPerformanceGoal(values)
    Message.success('绩效目标已创建')
    setGoalVisible(false)
    goalForm.resetFields()
    loadData()
  }

  const handleCreateReview = async () => {
    const values = await reviewForm.validate()
    await createPerformanceReview(values)
    Message.success('绩效评估已创建')
    setReviewVisible(false)
    reviewForm.resetFields()
    loadData()
  }

  const cycleColumns: TableProps<Cycle>['columns'] = [
    { title: '周期名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'cycleType', width: 100 },
    { title: '开始日期', dataIndex: 'startDate', width: 130, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { title: '结束日期', dataIndex: 'endDate', width: 130, render: (value) => value ? new Date(value).toLocaleDateString() : '-' },
    { title: '目标数', width: 90, render: (_: any, record) => record._count?.goals || 0 },
    { title: '评估数', width: 90, render: (_: any, record) => record._count?.reviews || 0 },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
  ]

  const goalColumns: TableProps<Goal>['columns'] = [
    { title: '目标', dataIndex: 'title' },
    { title: '周期', width: 160, render: (_: any, record) => record.cycle?.name || '-' },
    { title: '员工', width: 160, render: (_: any, record) => record.employee ? `${record.employee.user?.realName || '-'}（${record.employee.employeeNo}）` : '-' },
    { title: '权重', dataIndex: 'weight', width: 90 },
    { title: '进度', dataIndex: 'progress', width: 90, render: (value) => `${value}%` },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
  ]

  const reviewColumns: TableProps<Review>['columns'] = [
    { title: '周期', width: 160, render: (_: any, record) => record.cycle?.name || '-' },
    { title: '员工', width: 160, render: (_: any, record) => record.employee ? `${record.employee.user?.realName || '-'}（${record.employee.employeeNo}）` : '-' },
    { title: '评审人', width: 120, render: (_: any, record) => record.reviewer?.realName || '-' },
    { title: '最终分', dataIndex: 'finalScore', width: 100, render: (value) => value ?? '-' },
    { title: '评级', dataIndex: 'rating', width: 80, render: (value) => value || '-' },
    { title: '状态', dataIndex: 'status', width: 120, render: (value) => <StatusTag value={value} /> },
  ]

  return (
    <div className={styles['performance-overview']}>
      <Card bordered={false}>
        <div className={styles['performance-overview__header']}>
          <div>
            <span className={styles['performance-overview__title']}>绩效管理</span>
            <Tag color="blue" className={styles['performance-overview__tag']}>周期、目标、评估</Tag>
          </div>
          <Space>
            <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
            <Button icon={<IconPlus />} onClick={() => setGoalVisible(true)}>新增目标</Button>
            <Button icon={<IconPlus />} onClick={() => setReviewVisible(true)}>新增评估</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => setCycleVisible(true)}>新增周期</Button>
          </Space>
        </div>

        <Tabs defaultActiveTab="cycles">
          <TabPane key="cycles" title="绩效周期">
            <Table rowKey="id" loading={loading} columns={cycleColumns} data={cycles} pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane key="goals" title="绩效目标">
            <Table rowKey="id" loading={loading} columns={goalColumns} data={goals} pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane key="reviews" title="绩效评估">
            <Table rowKey="id" loading={loading} columns={reviewColumns} data={reviews} pagination={{ pageSize: 10 }} />
          </TabPane>
        </Tabs>
      </Card>

      <Modal focusLock title="新增绩效周期" visible={cycleVisible} onOk={handleCreateCycle} onCancel={() => setCycleVisible(false)} className={styles['performance-overview__modal']}>
        <Form form={cycleForm} layout="vertical" initialValues={{ cycleType: 'quarter', status: 'active' }}>
          <FormItem label="周期名称" field="name" rules={[{ required: true, message: '请输入周期名称' }]}><Input /></FormItem>
          <FormItem label="周期类型" field="cycleType">
            <Select>
              <Option value="month">月度</Option>
              <Option value="quarter">季度</Option>
              <Option value="half_year">半年度</Option>
              <Option value="year">年度</Option>
            </Select>
          </FormItem>
          <FormItem label="日期范围" field="dateRange" rules={[{ required: true, message: '请选择日期范围' }]}><RangePicker className={styles['performance-overview__form-item']} /></FormItem>
        </Form>
      </Modal>

      <Modal focusLock title="新增绩效目标" visible={goalVisible} onOk={handleCreateGoal} onCancel={() => setGoalVisible(false)} className={styles['performance-overview__modal--wide']}>
        <Form form={goalForm} layout="vertical" initialValues={{ weight: 0, progress: 0, status: 'active' }}>
          <FormItem label="绩效周期" field="cycleId" rules={[{ required: true, message: '请选择周期' }]}>
            <Select>{cycles.map((cycle) => <Option key={cycle.id} value={cycle.id}>{cycle.name}</Option>)}</Select>
          </FormItem>
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select showSearch>{employees.map((employee) => <Option key={employee.id} value={employee.id}>{employee.realName}（{employee.employeeNo}）</Option>)}</Select>
          </FormItem>
          <FormItem label="目标标题" field="title" rules={[{ required: true, message: '请输入目标标题' }]}><Input /></FormItem>
          <FormItem label="指标口径" field="metric"><Input /></FormItem>
          <FormItem label="目标值" field="targetValue"><InputNumber min={0} className={styles['performance-overview__form-item']} /></FormItem>
          <FormItem label="权重" field="weight"><InputNumber min={0} max={100} className={styles['performance-overview__form-item']} /></FormItem>
          <FormItem label="说明" field="description"><Input.TextArea rows={3} /></FormItem>
        </Form>
      </Modal>

      <Modal focusLock title="新增绩效评估" visible={reviewVisible} onOk={handleCreateReview} onCancel={() => setReviewVisible(false)} className={styles['performance-overview__modal--wide']}>
        <Form form={reviewForm} layout="vertical" initialValues={{ status: 'draft' }}>
          <FormItem label="绩效周期" field="cycleId" rules={[{ required: true, message: '请选择周期' }]}>
            <Select>{cycles.map((cycle) => <Option key={cycle.id} value={cycle.id}>{cycle.name}</Option>)}</Select>
          </FormItem>
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select showSearch>{employees.map((employee) => <Option key={employee.id} value={employee.id}>{employee.realName}（{employee.employeeNo}）</Option>)}</Select>
          </FormItem>
          <FormItem label="最终分" field="finalScore"><InputNumber min={0} max={100} className={styles['performance-overview__form-item']} /></FormItem>
          <FormItem label="评级" field="rating"><Input placeholder="例如：A / B / C" /></FormItem>
          <FormItem label="评语" field="managerComment"><Input.TextArea rows={3} /></FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default PerformanceOverviewPage
