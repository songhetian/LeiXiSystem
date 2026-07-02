import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  DatePicker,
} from '@arco-design/web-react'
import {
  IconThunderbolt,
  IconSend,
} from '@arco-design/web-react/icon'
import type { Dayjs } from 'dayjs'
import { calculatePayrollRun, createPayrollRun, getPayrollRunDetail, getPayrollRuns, publishPayrollRun, PayrollRun, PayrollRunDetail } from '@/api/payroll'
import { getEmployees, Employee } from '@/api/personnel'
import { getDepartmentsList, Department } from '@/api/organization'
import { PageHeader, StatusTag, FilterBar, employeeColumn, departmentColumn } from '@/components'
import { formatDate } from '@/utils/date'
import { toast } from '@/utils/toast'
import styles from './index.module.css'
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane
const { RangePicker } = DatePicker

const payrollStatusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'calculated', label: '已计算' },
  { value: 'approved', label: '已审核' },
  { value: 'published', label: '已发放' },
]

const payrollStructureOptions = [
  { value: 'standard', label: '标准薪资结构' },
  { value: 'executive', label: '高管薪资结构' },
  { value: 'commission', label: '提成薪资结构' },
]

function getDefaultPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return {
    year,
    month,
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: formatDate(new Date(year, month, 0)),
  }
}

function PayrollRunsPage() {
  const [data, setData] = useState<PayrollRun[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [detail, setDetail] = useState<PayrollRunDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [scopeType, setScopeType] = useState('all')
  const [form] = Form.useForm()
  const [searchStatus, setSearchStatus] = useState<string | undefined>()
  const [searchDateRange, setSearchDateRange] = useState<Dayjs[]>([])
  const [searchStructure, setSearchStructure] = useState<string | undefined>()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getPayrollRuns()
      let list = res.data || []
      // Client-side filtering fallback if API doesn't support these params
      if (searchStatus) {
        list = list.filter((item: PayrollRun) => item.status === searchStatus)
      }
      if (searchDateRange.length === 2) {
        const start = searchDateRange[0].startOf('day').valueOf()
        const end = searchDateRange[1].endOf('day').valueOf()
        list = list.filter((item: PayrollRun) => {
          const t = new Date((item as any).createdAt).getTime()
          return t >= start && t <= end
        })
      }
      if (searchStructure) {
        list = list.filter((item: PayrollRun) => (item as any).structure === searchStructure)
      }
      setData(list)
    } finally {
      setLoading(false)
    }
  }, [searchStatus, searchDateRange, searchStructure])

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [runRes, employeeRes, departmentRes] = await Promise.all([
        getPayrollRuns(),
        getEmployees({ page: 1, pageSize: 1000, status: 'active' }),
        getDepartmentsList(),
      ])
      setData(runRes.data || [])
      setEmployees(employeeRes.data?.list || [])
      setDepartments(departmentRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const handleSearch = () => {
    loadData()
  }

  const handleReset = () => {
    setSearchStatus(undefined)
    setSearchDateRange([])
    setSearchStructure(undefined)
  }

  const handleCalculate = useCallback(async (id: number) => {
    await calculatePayrollRun(id)
    toast.success('薪资批次计算完成')
    loadData()
  }, [loadData])

  const handlePublish = useCallback(async (id: number) => {
    await publishPayrollRun(id)
    toast.success('工资条发布成功')
    loadData()
  }, [loadData])

  const openCreate = useCallback(() => {
    form.resetFields()
    form.setFieldsValue({ ...getDefaultPeriod(), scopeType: 'all' })
    setScopeType('all')
    setVisible(true)
  }, [form])

  const handleCreate = useCallback(async () => {
    const values = await form.validate()
    await createPayrollRun({
      ...values,
      year: Number(values.year),
      month: Number(values.month),
      scopeValue: values.scopeType === 'all' ? undefined : values.scopeValue,
    })
    toast.success('薪资批次创建成功')
    setVisible(false)
    loadData()
  }, [form, loadData])

  const handleScopeTypeChange = useCallback((value: string) => {
    setScopeType(value)
    form.setFieldsValue({ scopeValue: undefined })
  }, [form])

  const openDetail = useCallback(async (record: any) => {
    setDetailVisible(true)
    setDetailLoading(true)
    try {
      const res = await getPayrollRunDetail(record.id)
      setDetail(res.data)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const runColumns = useMemo(() => [
    { title: '批次ID', dataIndex: 'id', width: 90 },
    {
      title: '薪资期间',
      render: (_: unknown, record: any) => record.payrollPeriod ? `${record.payrollPeriod.year}-${String(record.payrollPeriod.month).padStart(2, '0')}` : '-',
    },
    {
      title: '范围',
      dataIndex: 'scopeType',
      render: (value: string) => value === 'all' ? '全公司' : value === 'department' ? '指定部门' : '指定员工',
    },
    {
      title: '工资条数量',
      render: (_: unknown, record: any) => record.payslips?.length || 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="payrollRun" value={value} />,
    },
    {
      title: '创建人',
      render: (_: unknown, record: any) => record.creator?.realName || '-',
    },
    {
      title: '操作',
      width: 240,
      render: (_: unknown, record: any) => (
        <Space>
          <Button type="text" size="small" onClick={() => openDetail(record)}>
            详情
          </Button>
          <Button
            type="secondary"
            size="small"
            icon={<IconThunderbolt />}
            disabled={!['draft', 'calculated'].includes(record.status)}
            onClick={() => handleCalculate(record.id)}
          >
            计算
          </Button>
          <Popconfirm title="发布后员工可以查看工资条，确认发布？" onOk={() => handlePublish(record.id)}>
            <Button type="primary" size="small" status="success" icon={<IconSend />} disabled={!['calculated', 'approved'].includes(record.status)}>
              发放
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleCalculate, handlePublish, openDetail])

  const payslipColumns = useMemo(() => [
    employeeColumn(),
    departmentColumn(),
    { title: '应发', dataIndex: 'grossPay' },
    { title: '扣款', dataIndex: 'totalDeduction' },
    { title: '实发', dataIndex: 'netPay' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag preset="payslip" value={value} /> },
  ], [])

  const adjustmentColumns = useMemo(() => [
    employeeColumn(),
    departmentColumn(),
    { title: '组件', render: (_: unknown, record: any) => record.component?.name || '-' },
    { title: '类型', dataIndex: 'type' },
    { title: '金额', dataIndex: 'amount' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag preset="payrollAdjustment" value={value} /> },
  ], [])

  const disputeColumns = useMemo(() => [
    employeeColumn(),
    { title: '申诉原因', dataIndex: 'reason' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag preset="payslipDispute" value={value} /> },
    { title: '处理回复', dataIndex: 'handlerReply' },
  ], [])

  const summary = detail?.summary || {}

  return (
    <div className={styles['payroll-runs']}>
      <Card bordered={false} className={styles['payroll-runs__card']}>
        <PageHeader
          title="薪资批次"
          description="参考 ERPNext Payroll Entry：先生成批次，再计算工资条，最后复核、审批、发布。"
          extra={<Button type="primary" onClick={openCreate}>创建批次</Button>}
        />
      </Card>

      <Card bordered={false}>
        <FilterBar
          filters={
            <>
              <FormItem label="状态">
                <Select
                  placeholder="请选择状态"
                  value={searchStatus}
                  onChange={setSearchStatus}
                  allowClear
                >
                  {payrollStatusOptions.map((opt) => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
                </Select>
              </FormItem>
              <FormItem label="创建时间">
                <RangePicker
                  value={searchDateRange}
                  onChange={(_, date) => setSearchDateRange(date)}
                />
              </FormItem>
              <FormItem label="薪资结构">
                <Select
                  placeholder="请选择薪资结构"
                  value={searchStructure}
                  onChange={setSearchStructure}
                  allowClear
                >
                  {payrollStructureOptions.map((opt) => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
                </Select>
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={runColumns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal focusLock
        title="创建薪资批次"
        visible={visible}
        onOk={handleCreate}
        onCancel={() => setVisible(false)}
        className={styles['payroll-runs__modal']}
      >
        <Form form={form} layout="vertical">
          <Space size="large">
            <FormItem label="年份" field="year" rules={[{ required: true, message: '请输入年份' }]}>
              <Input className={styles['payroll-runs__input']} />
            </FormItem>
            <FormItem label="月份" field="month" rules={[{ required: true, message: '请输入月份' }]}>
              <Input className={styles['payroll-runs__input']} />
            </FormItem>
            <FormItem label="范围" field="scopeType" rules={[{ required: true, message: '请选择范围' }]}>
              <Select className={styles['payroll-runs__input--wide']} onChange={handleScopeTypeChange}>
                <Option value="all">全公司</Option>
                <Option value="department">指定部门</Option>
                <Option value="employee">指定员工</Option>
              </Select>
            </FormItem>
          </Space>
          {scopeType !== 'all' && (
            <FormItem
              label={scopeType === 'department' ? '选择部门' : '选择员工'}
              field="scopeValue"
              rules={[{ required: true, message: scopeType === 'department' ? '请选择部门' : '请选择员工' }]}
            >
              <Select
                mode="multiple"
                placeholder={scopeType === 'department' ? '请选择参与薪资批次的部门' : '请选择参与薪资批次的员工'}
              >
                {scopeType === 'department'
                  ? departments.map((department) => (
                    <Option key={department.id} value={department.id}>{department.name}</Option>
                  ))
                  : employees.map((employee) => (
                    <Option key={employee.id} value={employee.id}>
                      {employee.realName}（{employee.employeeNo}）
                    </Option>
                  ))}
              </Select>
            </FormItem>
          )}
          <Space size="large">
            <FormItem label="开始日期" field="startDate" rules={[{ required: true, message: '请输入开始日期' }]}>
              <Input className={styles['payroll-runs__input--wider']} placeholder="YYYY-MM-DD" />
            </FormItem>
            <FormItem label="结束日期" field="endDate" rules={[{ required: true, message: '请输入结束日期' }]}>
              <Input className={styles['payroll-runs__input--wider']} placeholder="YYYY-MM-DD" />
            </FormItem>
          </Space>
        </Form>
      </Modal>

      <Drawer
        title="薪资批次详情"
        visible={detailVisible}
        className={styles['payroll-runs__drawer']}
        footer={null}
        onCancel={() => setDetailVisible(false)}
      >
        <Space direction="vertical" size="large" className={styles['payroll-runs__space']}>
          <Descriptions
            column={3}
            data={[
              { label: '批次ID', value: detail?.run?.id || '-' },
              {
                label: '薪资期间',
                value: detail?.run?.payrollPeriod ? `${detail.run.payrollPeriod.year}-${String(detail.run.payrollPeriod.month).padStart(2, '0')}` : '-',
              },
              { label: '状态', value: detail?.run?.status ? <StatusTag preset="payrollRun" value={detail.run.status} /> : '-' },
              { label: '创建人', value: detail?.run?.creator?.realName || '-' },
              { label: '范围', value: detail?.run?.scopeType || '-' },
              { label: '创建时间', value: detail?.run?.createdAt || '-' },
            ]}
          />

          <Row gutter={16}>
            <Col span={6}><Card bordered={false} className={styles['payroll-runs__statistic-card']}><Statistic title="工资条" value={summary.payslipCount || 0} suffix="条" /></Card></Col>
            <Col span={6}><Card bordered={false} className={styles['payroll-runs__statistic-card']}><Statistic title="实发合计" value={summary.netPay || 0} /></Card></Col>
            <Col span={6}><Card bordered={false} className={styles['payroll-runs__statistic-card']}><Statistic title="调整项" value={summary.adjustmentCount || 0} suffix="条" /></Card></Col>
            <Col span={6}><Card bordered={false} className={styles['payroll-runs__statistic-card']}><Statistic title="申诉" value={summary.disputeCount || 0} suffix="条" /></Card></Col>
          </Row>

          <Tabs>
            <TabPane key="payslips" title="工资条">
              <Table rowKey="id" loading={detailLoading} data={detail?.payslips || []} columns={payslipColumns} pagination={{ pageSize: 8 }} />
            </TabPane>
            <TabPane key="adjustments" title="调整项">
              <Table rowKey="id" loading={detailLoading} data={detail?.adjustments || []} columns={adjustmentColumns} pagination={{ pageSize: 8 }} />
            </TabPane>
            <TabPane key="disputes" title="申诉">
              <Table rowKey="id" loading={detailLoading} data={detail?.disputes || []} columns={disputeColumns} pagination={{ pageSize: 8 }} />
            </TabPane>
          </Tabs>
        </Space>
      </Drawer>
    </div>
  )
}

export default PayrollRunsPage
