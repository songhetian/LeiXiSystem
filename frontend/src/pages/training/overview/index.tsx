import { useCallback, useEffect, useState } from 'react'
import './index.css';
import { Button, Card, DatePicker, Form, Input, InputNumber, Message, Modal, Select, Space, Table, Tabs, Tag } from '@arco-design/web-react'
import type { TableProps } from '@arco-design/web-react'
import { IconCheck, IconPlus, IconRefresh } from '@arco-design/web-react/icon'
import { createTrainingCourse, createTrainingEnrollment, createTrainingSession, getTrainingCourses, getTrainingEnrollments, getTrainingSessions, completeTrainingEnrollment } from '@/api/training'
import { getEmployees, type Employee } from '@/api/personnel'

const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const RangePicker = DatePicker.RangePicker

type Course = {
  id: number
  title: string
  code: string
  category?: string
  durationHours?: number
  status: string
  _count?: { sessions: number }
}

type Session = {
  id: number
  title: string
  startTime: string
  endTime?: string
  location?: string
  status: string
  course?: { title: string }
  instructor?: { realName: string }
  _count?: { enrollments: number }
}

type Enrollment = {
  id: number
  status: string
  score?: number
  session?: { title: string; course?: { title: string } }
  employee?: { employeeNo: string; user?: { realName: string } }
}

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '启用', color: 'green' },
  inactive: { text: '停用', color: 'gray' },
  planned: { text: '计划中', color: 'blue' },
  open: { text: '报名中', color: 'green' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'red' },
  enrolled: { text: '已报名', color: 'blue' },
}

function StatusTag({ value }: { value: string }) {
  const info = statusMap[value] || { text: value, color: 'gray' }
  return <Tag color={info.color}>{info.text}</Tag>
}

function TrainingOverviewPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [courseVisible, setCourseVisible] = useState(false)
  const [sessionVisible, setSessionVisible] = useState(false)
  const [enrollVisible, setEnrollVisible] = useState(false)
  const [courseForm] = Form.useForm()
  const [sessionForm] = Form.useForm()
  const [enrollForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [courseRes, sessionRes, enrollmentRes, employeeRes]: any[] = await Promise.all([
        getTrainingCourses({ page: 1, pageSize: 100 }),
        getTrainingSessions({ page: 1, pageSize: 100 }),
        getTrainingEnrollments({ page: 1, pageSize: 100 }),
        getEmployees({ page: 1, pageSize: 100, status: 'active' }),
      ])
      setCourses(courseRes?.data?.list || [])
      setSessions(sessionRes?.data?.list || [])
      setEnrollments(enrollmentRes?.data?.list || [])
      setEmployees(employeeRes?.data?.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreateCourse = async () => {
    const values = await courseForm.validate()
    await createTrainingCourse(values)
    Message.success('课程已创建')
    setCourseVisible(false)
    courseForm.resetFields()
    loadData()
  }

  const handleCreateSession = async () => {
    const values = await sessionForm.validate()
    const [startTime, endTime] = values.timeRange || []
    await createTrainingSession({ ...values, startTime, endTime })
    Message.success('培训班次已创建')
    setSessionVisible(false)
    sessionForm.resetFields()
    loadData()
  }

  const handleEnroll = async () => {
    const values = await enrollForm.validate()
    await createTrainingEnrollment(values)
    Message.success('报名成功')
    setEnrollVisible(false)
    enrollForm.resetFields()
    loadData()
  }

  const courseColumns: TableProps<Course>['columns'] = [
    { title: '课程名称', dataIndex: 'title' },
    { title: '编码', dataIndex: 'code', width: 140 },
    { title: '分类', dataIndex: 'category', width: 120 },
    { title: '课时', dataIndex: 'durationHours', width: 90, render: (value) => value ?? '-' },
    { title: '班次数', width: 90, render: (_: any, record) => record._count?.sessions || 0 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag value={value} /> },
  ]

  const sessionColumns: TableProps<Session>['columns'] = [
    { title: '班次', dataIndex: 'title' },
    { title: '课程', width: 180, render: (_: any, record) => record.course?.title || '-' },
    { title: '开始时间', dataIndex: 'startTime', width: 170, render: (value) => value ? new Date(value).toLocaleString() : '-' },
    { title: '地点', dataIndex: 'location', width: 140 },
    { title: '讲师', width: 120, render: (_: any, record) => record.instructor?.realName || '-' },
    { title: '报名数', width: 90, render: (_: any, record) => record._count?.enrollments || 0 },
    { title: '状态', dataIndex: 'status', width: 100, render: (value) => <StatusTag value={value} /> },
  ]

  const enrollmentColumns: TableProps<Enrollment>['columns'] = [
    { title: '员工', width: 180, render: (_: any, record) => record.employee ? `${record.employee.user?.realName || '-'}（${record.employee.employeeNo}）` : '-' },
    { title: '课程', render: (_: any, record) => record.session?.course?.title || '-' },
    { title: '班次', render: (_: any, record) => record.session?.title || '-' },
    { title: '成绩', dataIndex: 'score', width: 90, render: (value) => value ?? '-' },
    { title: '状态', dataIndex: 'status', width: 110, render: (value) => <StatusTag value={value} /> },
    {
      title: '操作',
      width: 120,
      render: (_: any, record) => record.status !== 'completed' ? (
        <Button
          size="small"
          type="text"
          icon={<IconCheck />}
          onClick={async () => {
            await completeTrainingEnrollment(record.id)
            Message.success('已完成培训')
            loadData()
          }}
        >
          完成
        </Button>
      ) : null,
    },
  ]

  return (
    <div className="training-overview">
      <Card bordered={false}>
        <div className="training-overview__header">
          <div>
            <span className="training-overview__title">培训管理</span>
            <Tag color="blue" className="training-overview__tag">课程、班次、报名</Tag>
          </div>
          <Space>
            <Button icon={<IconRefresh />} onClick={loadData}>刷新</Button>
            <Button icon={<IconPlus />} onClick={() => setEnrollVisible(true)}>员工报名</Button>
            <Button icon={<IconPlus />} onClick={() => setSessionVisible(true)}>新增班次</Button>
            <Button type="primary" icon={<IconPlus />} onClick={() => setCourseVisible(true)}>新增课程</Button>
          </Space>
        </div>

        <Tabs defaultActiveTab="courses">
          <TabPane key="courses" title="课程库">
            <Table rowKey="id" loading={loading} columns={courseColumns} data={courses} pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane key="sessions" title="培训班次">
            <Table rowKey="id" loading={loading} columns={sessionColumns} data={sessions} pagination={{ pageSize: 10 }} />
          </TabPane>
          <TabPane key="enrollments" title="报名记录">
            <Table rowKey="id" loading={loading} columns={enrollmentColumns} data={enrollments} pagination={{ pageSize: 10 }} />
          </TabPane>
        </Tabs>
      </Card>

      <Modal title="新增课程" visible={courseVisible} onOk={handleCreateCourse} onCancel={() => setCourseVisible(false)} className="training-overview__modal--md">
        <Form form={courseForm} layout="vertical" initialValues={{ status: 'active' }}>
          <FormItem label="课程名称" field="title" rules={[{ required: true, message: '请输入课程名称' }]}><Input /></FormItem>
          <FormItem label="课程编码" field="code" rules={[{ required: true, message: '请输入课程编码' }]}><Input /></FormItem>
          <FormItem label="分类" field="category"><Input placeholder="例如：合规、技能、管理" /></FormItem>
          <FormItem label="课时" field="durationHours"><InputNumber min={0} className="training-overview__input-full" /></FormItem>
          <FormItem label="说明" field="description"><Input.TextArea rows={3} /></FormItem>
        </Form>
      </Modal>

      <Modal title="新增培训班次" visible={sessionVisible} onOk={handleCreateSession} onCancel={() => setSessionVisible(false)} className="training-overview__modal--lg">
        <Form form={sessionForm} layout="vertical" initialValues={{ status: 'planned' }}>
          <FormItem label="课程" field="courseId" rules={[{ required: true, message: '请选择课程' }]}>
            <Select>{courses.map((course) => <Option key={course.id} value={course.id}>{course.title}</Option>)}</Select>
          </FormItem>
          <FormItem label="班次名称" field="title" rules={[{ required: true, message: '请输入班次名称' }]}><Input /></FormItem>
          <FormItem label="时间范围" field="timeRange" rules={[{ required: true, message: '请选择时间范围' }]}><RangePicker showTime className="training-overview__input-full" /></FormItem>
          <FormItem label="地点" field="location"><Input /></FormItem>
          <FormItem label="容量" field="capacity"><InputNumber min={1} className="training-overview__input-full" /></FormItem>
        </Form>
      </Modal>

      <Modal title="员工报名" visible={enrollVisible} onOk={handleEnroll} onCancel={() => setEnrollVisible(false)} className="training-overview__modal--sm">
        <Form form={enrollForm} layout="vertical">
          <FormItem label="培训班次" field="sessionId" rules={[{ required: true, message: '请选择班次' }]}>
            <Select>{sessions.map((session) => <Option key={session.id} value={session.id}>{session.title}</Option>)}</Select>
          </FormItem>
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select showSearch>{employees.map((employee) => <Option key={employee.id} value={employee.id}>{employee.realName}（{employee.employeeNo}）</Option>)}</Select>
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default TrainingOverviewPage
