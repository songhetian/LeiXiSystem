import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Grid,
  Input,
  Message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Typography,
} from '@arco-design/web-react'
import { calculatePayrollRun, createPayrollRun, getPayrollRunDetail, getPayrollRuns, publishPayrollRun } from '@/api/payroll'
import { getEmployees } from '@/api/personnel'
import { getDepartmentsList } from '@/api/organization'
import StatusTag from '@/components/StatusTag'

const { Title, Text } = Typography
const { Row, Col } = Grid
const FormItem = Form.Item
const Option = Select.Option
const TabPane = Tabs.TabPane

function getDefaultPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return {
    year,
    month,
    startDate: `${year}-${String(month).padStart(2, '0')}-01`,
    endDate: new Date(year, month, 0).toISOString().slice(0, 10),
  }
}

function PayrollRunsPage() {
  const [data, setData] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [scopeType, setScopeType] = useState('all')
  const [form] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await getPayrollRuns()
      setData(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [runRes, employeeRes, departmentRes]: any[] = await Promise.all([
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

  const handleCalculate = useCallback(async (id: number) => {
    await calculatePayrollRun(id)
    Message.success('薪资批次计算完成')
    loadData()
  }, [loadData])

  const handlePublish = useCallback(async (id: number) => {
    await publishPayrollRun(id)
    Message.success('工资条发布成功')
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
    Message.success('薪资批次创建成功')
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
      const res: any = await getPayrollRunDetail(record.id)
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
            type="text"
            size="small"
            disabled={!['draft', 'calculated'].includes(record.status)}
            onClick={() => handleCalculate(record.id)}
          >
            计算
          </Button>
          <Popconfirm title="发布后员工可以查看工资条，确认发布？" onOk={() => handlePublish(record.id)}>
            <Button type="text" size="small" disabled={!['calculated', 'approved'].includes(record.status)}>
              发布
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleCalculate, handlePublish, openDetail])

  const payslipColumns = useMemo(() => [
    { title: '员工', render: (_: unknown, record: any) => record.employee?.user?.realName || '-' },
    { title: '部门', render: (_: unknown, record: any) => record.employee?.user?.department?.name || '-' },
    { title: '应发', dataIndex: 'grossPay' },
    { title: '扣款', dataIndex: 'totalDeduction' },
    { title: '实发', dataIndex: 'netPay' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag preset="payslip" value={value} /> },
  ], [])

  const adjustmentColumns = useMemo(() => [
    { title: '员工', render: (_: unknown, record: any) => record.employee?.user?.realName || '-' },
    { title: '部门', render: (_: unknown, record: any) => record.employee?.user?.department?.name || '-' },
    { title: '组件', render: (_: unknown, record: any) => record.component?.name || '-' },
    { title: '类型', dataIndex: 'type' },
    { title: '金额', dataIndex: 'amount' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag preset="payrollAdjustment" value={value} /> },
  ], [])

  const disputeColumns = useMemo(() => [
    { title: '员工', render: (_: unknown, record: any) => record.employee?.user?.realName || '-' },
    { title: '申诉原因', dataIndex: 'reason' },
    { title: '状态', dataIndex: 'status', render: (value: string) => <StatusTag preset="payslipDispute" value={value} /> },
    { title: '处理回复', dataIndex: 'handlerReply' },
  ], [])

  const summary = detail?.summary || {}

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title heading={5} style={{ margin: 0 }}>薪资批次</Title>
            <Button type="primary" onClick={openCreate}>创建批次</Button>
          </div>
          <Text type="secondary">参考 ERPNext Payroll Entry：先生成批次，再计算工资条，最后复核、审批、发布。</Text>
        </Space>
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

      <Modal
        title="创建薪资批次"
        visible={visible}
        onOk={handleCreate}
        onCancel={() => setVisible(false)}
        style={{ width: 520 }}
      >
        <Form form={form} layout="vertical">
          <Space size="large">
            <FormItem label="年份" field="year" rules={[{ required: true, message: '请输入年份' }]}>
              <Input style={{ width: 120 }} />
            </FormItem>
            <FormItem label="月份" field="month" rules={[{ required: true, message: '请输入月份' }]}>
              <Input style={{ width: 120 }} />
            </FormItem>
            <FormItem label="范围" field="scopeType" rules={[{ required: true, message: '请选择范围' }]}>
              <Select style={{ width: 140 }} onChange={handleScopeTypeChange}>
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
              <Input style={{ width: 180 }} placeholder="YYYY-MM-DD" />
            </FormItem>
            <FormItem label="结束日期" field="endDate" rules={[{ required: true, message: '请输入结束日期' }]}>
              <Input style={{ width: 180 }} placeholder="YYYY-MM-DD" />
            </FormItem>
          </Space>
        </Form>
      </Modal>

      <Drawer
        title="薪资批次详情"
        visible={detailVisible}
        width={920}
        footer={null}
        onCancel={() => setDetailVisible(false)}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
            <Col span={6}><Card bordered={false}><Statistic title="工资条" value={summary.payslipCount || 0} suffix="条" /></Card></Col>
            <Col span={6}><Card bordered={false}><Statistic title="实发合计" value={summary.netPay || 0} /></Card></Col>
            <Col span={6}><Card bordered={false}><Statistic title="调整项" value={summary.adjustmentCount || 0} suffix="条" /></Card></Col>
            <Col span={6}><Card bordered={false}><Statistic title="申诉" value={summary.disputeCount || 0} suffix="条" /></Card></Col>
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
