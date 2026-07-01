import { useCallback, useEffect, useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Select,
  DatePicker,
  Message,
  Tag,
  Progress,
  Grid,
  Typography,
} from '@arco-design/web-react'
import {
  IconPlayArrow,
  IconCheck,
} from '@arco-design/web-react/icon'
import type { TableProps } from '@arco-design/web-react'
import {
  getOnboardingFlows,
  startOnboarding,
  getOnboardingProgress,
  completeOnboarding,
  type OnboardingFlow,
} from '@/api/onboarding'
import { getEmployees, type Employee } from '@/api/personnel'
import styles from './onboarding.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option

function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [flows, setFlows] = useState<OnboardingFlow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [startModalVisible, setStartModalVisible] = useState(false)
  const [startForm] = Form.useForm()

  const [progressModalVisible, setProgressModalVisible] = useState(false)
  const [currentEmployee, setCurrentEmployee] = useState<(Employee & { user?: { realName: string } }) | null>(null)
  const [progress, setProgress] = useState<{ id: number; status: string; progress: number; completedTasks: number; totalTasks: number; tasks?: { id: number; title: string; status: string; dueDate?: string }[] } | null>(null)
  const [progressLoading, setProgressLoading] = useState(false)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEmployees({ page, pageSize, status: 'active' })
      if (res.code === 0) {
        setEmployees(res.data.list)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  const fetchFlows = useCallback(async () => {
    const res = await getOnboardingFlows({ status: 'active' })
    if (res.code === 0) {
      setFlows(res.data.list)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
    fetchFlows()
  }, [fetchEmployees, fetchFlows])

  const handleStart = (employee: any) => {
    setCurrentEmployee(employee)
    startForm.resetFields()
    const defaultFlow = flows.find((f) => f.isDefault)
    if (defaultFlow) {
      startForm.setFieldsValue({ flowId: defaultFlow.id })
    }
    setStartModalVisible(true)
  }

  const handleStartSubmit = async () => {
    if (!currentEmployee) return
    try {
      const values = await startForm.validate()
      await startOnboarding({
        employeeId: currentEmployee.id,
        flowId: values.flowId,
        startDate: values.startDate
          ? new Date(values.startDate).toISOString().split('T')[0]
          : undefined,
      })
      Message.success('入职流程已启动')
      setStartModalVisible(false)
      fetchEmployees()
    } catch {
      // handled
    }
  }

  const handleViewProgress = async (employee: any) => {
    setCurrentEmployee(employee)
    setProgressLoading(true)
    setProgressModalVisible(true)
    try {
      const res = await getOnboardingProgress(employee.id)
      if (res.code === 0) {
        setProgress(res.data)
      }
    } finally {
      setProgressLoading(false)
    }
  }

  const handleComplete = async () => {
    if (!currentEmployee) return
    Modal.confirm({
      title: '确认完成',
      content: '确定要完成该员工的入职流程吗？完成后将无法撤销。',
      onOk: async () => {
        await completeOnboarding(currentEmployee.id)
        Message.success('入职流程已完成')
        handleViewProgress(currentEmployee)
      },
    })
  }

  const columns: TableProps<any>['columns'] = [
    {
      title: '员工编号',
      dataIndex: 'employeeNo',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      width: 100,
      render: (_: any, record) => record.user?.realName || '-',
    },
    {
      title: '部门',
      dataIndex: 'department',
      width: 120,
      render: (val: any) => val?.name || '-',
    },
    {
      title: '入职日期',
      dataIndex: 'hireDate',
      width: 120,
      render: (val: string) => val ? new Date(val).toLocaleDateString() : '-',
    },
    {
      title: '入职状态',
      dataIndex: 'status',
      width: 100,
      render: (_: any, record) => {
        const status = record.onboarding?.status
        if (status === 'completed') return <Tag color="green">已完成</Tag>
        if (status === 'in_progress') return <Tag color="blue">进行中</Tag>
        if (status === 'cancelled') return <Tag color="gray">已取消</Tag>
        return <Tag color="orange">未启动</Tag>
      },
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, record) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<IconPlayArrow />}
            onClick={() => handleStart(record)}
          >
            启动入职
          </Button>
          <Button
            type="text"
            size="small"
            onClick={() => handleViewProgress(record)}
          >
            查看进度
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className={styles['onboarding-page']}>
      <Card
        bordered={false}
        title="入职办理"
        extra={
          <Typography.Text type="secondary">
            选择员工启动入职流程，自动分配入职任务
          </Typography.Text>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          data={employees}
          pagination={{
            total,
            current: page,
            pageSize,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal focusLock
        title="启动入职流程"
        visible={startModalVisible}
        onOk={handleStartSubmit}
        onCancel={() => setStartModalVisible(false)}
        className={styles['onboarding-page__modal--500']}
        okText="启动"
        cancelText="取消"
      >
        <Form form={startForm} layout="vertical">
          <FormItem label="选择入职流程" field="flowId" rules={[{ required: true, message: '请选择入职流程' }]}>
            <Select placeholder="请选择入职流程">
              {flows.map((f) => (
                <Option key={f.id} value={f.id}>
                  {f.name} {f.isDefault && <Tag color="blue" size="small">默认</Tag>}
                </Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="开始日期" field="startDate">
            <DatePicker className={styles['onboarding-page__date-picker-full']} />
          </FormItem>
        </Form>
      </Modal>

      <Modal focusLock
        title="入职进度"
        visible={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        className={styles['onboarding-page__modal--600']}
        footer={
          <Space>
            <Button onClick={() => setProgressModalVisible(false)}>关闭</Button>
            {progress && progress.status === 'in_progress' && (
              <Button type="primary" icon={<IconCheck />} onClick={handleComplete}>
                完成入职
              </Button>
            )}
          </Space>
        }
      >
        {progressLoading ? (
          <div className={styles['onboarding-page__text-center']}>加载中...</div>
        ) : progress ? (
          <div>
            <div className={styles['onboarding-page__progress-header']}>
              <div>
                <div className={styles['onboarding-page__title']}>
                  {currentEmployee?.user?.realName}
                </div>
                <div className={styles['onboarding-page__text-small']}>
                  {currentEmployee?.employeeNo}
                </div>
              </div>
              <Tag color={progress.status === 'completed' ? 'green' : 'blue'}>
                {progress.status === 'completed' ? '已完成' : '进行中'}
              </Tag>
            </div>

            <div className={styles['onboarding-page__progress-bar']}>
              <Progress percent={progress.progress} status={progress.status === 'completed' ? 'success' : 'normal'} />
              <div className={styles['onboarding-page__text-small--muted-margin']}>
                已完成 {progress.completedTasks} / {progress.totalTasks} 个任务
              </div>
            </div>

            <div className={styles['onboarding-page__tasks']}>
              <div className={styles['onboarding-page__subtitle']}>任务列表</div>
              {progress.tasks?.length ? (
                progress.tasks.map((task: any) => (
                  <div key={task.id} className={styles['onboarding-page__task-item']}>
                    <Tag color={
                      task.status === 'completed' ? 'green' :
                      task.status === 'processing' ? 'blue' :
                      task.status === 'cancelled' ? 'gray' : 'orange'
                    }>
                      {task.status === 'completed' ? '已完成' :
                       task.status === 'processing' ? '进行中' :
                       task.status === 'cancelled' ? '已取消' : '待处理'}
                    </Tag>
                    <span className={styles['onboarding-page__flex-item']}>{task.title}</span>
                    <span className={styles['onboarding-page__text-small--muted']}>
                      截止: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles['onboarding-page__text-center--muted']}>
                  暂无任务
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles['onboarding-page__text-center']}>
            该员工尚未启动入职流程
          </div>
        )}
      </Modal>
    </div>
  )
}

export default OnboardingPage
