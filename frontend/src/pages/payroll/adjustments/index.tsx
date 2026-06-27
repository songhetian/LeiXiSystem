import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Message, Modal, Select, Space, Table, Tag, Typography } from '@arco-design/web-react'
import { approvePayrollAdjustment, createPayrollAdjustment, getPayrollAdjustments, getSalaryComponents, rejectPayrollAdjustment } from '@/api/payroll'
import { getEmployees } from '@/api/personnel'
import ApprovalActionModal from '@/components/ApprovalActionModal'
import StatusTag from '@/components/StatusTag'
import { useTableData } from '@/hooks/useTableData'

const { Title, Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

function getCurrentYearMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function PayrollAdjustmentsPage() {
  const [employees, setEmployees] = useState<any[]>([])
  const [components, setComponents] = useState<any[]>([])
  const [visible, setVisible] = useState(false)
  const [actionState, setActionState] = useState<{ visible: boolean; record?: any; action?: 'approve' | 'reject' }>({ visible: false })
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  const { data, setData, loading, setLoading, loadData, handleSearch, handleReset } = useTableData({
    fetcher: getPayrollAdjustments,
    form: filterForm,
    paginated: false,
    immediate: false,
  })

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [employeeRes, componentRes, adjustmentRes]: any[] = await Promise.all([
      getEmployees({ page: 1, pageSize: 1000, status: 'active' }),
      getSalaryComponents(),
        getPayrollAdjustments(),
      ])
      setEmployees(employeeRes.data?.list || [])
      setComponents((componentRes.data || []).filter((item: any) => item.enabled))
      setData(adjustmentRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const openCreate = useCallback(() => {
    form.resetFields()
    form.setFieldsValue({ ...getCurrentYearMonth(), type: 'earning', status: 'pending' })
    setVisible(true)
  }, [form])

  const handleCreate = useCallback(async () => {
    const values = await form.validate()
    await createPayrollAdjustment({
      ...values,
      employeeId: Number(values.employeeId),
      componentId: Number(values.componentId),
      year: Number(values.year),
      month: Number(values.month),
      amount: Number(values.amount),
    })
    Message.success('薪资调整项创建成功')
    setVisible(false)
    loadData()
  }, [form, loadData])

  const openAction = useCallback((record: any, action: 'approve' | 'reject') => {
    setActionState({ visible: true, record, action })
  }, [])

  const closeAction = useCallback(() => {
    setActionState({ visible: false })
  }, [])

  const submitAction = useCallback(async (values: { comment?: string }) => {
    if (!actionState.record || !actionState.action) return
    if (actionState.action === 'approve') {
      await approvePayrollAdjustment(actionState.record.id, { opinion: values.comment })
      Message.success('薪资调整项已通过')
    } else {
      await rejectPayrollAdjustment(actionState.record.id, { opinion: values.comment })
      Message.success('薪资调整项已驳回')
    }
    closeAction()
    loadData()
  }, [actionState, closeAction, loadData])

  const columns = useMemo(() => [
    { title: '期间', render: (_: unknown, record: any) => `${record.year}-${String(record.month).padStart(2, '0')}` },
    { title: '员工', render: (_: unknown, record: any) => record.employee?.user?.realName || '-' },
    { title: '部门', render: (_: unknown, record: any) => record.employee?.user?.department?.name || '-' },
    { title: '组件', render: (_: unknown, record: any) => record.component?.name || '-' },
    { title: '类型', dataIndex: 'type', render: (value: string) => <Tag color={value === 'earning' ? 'green' : 'red'}>{value === 'earning' ? '补贴/补发' : '扣款/追扣'}</Tag> },
    { title: '金额', dataIndex: 'amount' },
    { title: '原因', dataIndex: 'reason' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="payrollAdjustment" value={value} />,
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, record: any) => (
        <Space>
          <Button type="text" size="small" disabled={record.status !== 'pending'} onClick={() => openAction(record, 'approve')}>通过</Button>
          <Button type="text" size="small" status="danger" disabled={record.status !== 'pending'} onClick={() => openAction(record, 'reject')}>驳回</Button>
        </Space>
      ),
    },
  ], [openAction])

  return (
    <div style={{ paddingBottom: 20 }}>
      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title heading={5} style={{ margin: 0 }}>薪资调整项</Title>
            <Button type="primary" onClick={openCreate}>新增调整项</Button>
          </div>
          <Text type="secondary">用于临时补贴、临时扣款、补发、追扣；已审批的调整项会在工资条计算和单条重算时自动纳入。</Text>
        </Space>
      </Card>

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Form form={filterForm} layout="inline">
          <FormItem label="状态" field="status">
            <Select allowClear placeholder="全部状态" style={{ width: 140 }}>
              <Option value="pending">待审批</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已驳回</Option>
            </Select>
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" onClick={handleSearch}>查询</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal title="新增薪资调整项" visible={visible} onOk={handleCreate} onCancel={() => setVisible(false)} style={{ width: 620 }}>
        <Form form={form} layout="vertical">
          <FormItem label="员工" field="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select showSearch placeholder="选择员工">
              {employees.map((employee) => (
                <Option key={employee.id} value={employee.id}>{employee.realName}（{employee.employeeNo}）</Option>
              ))}
            </Select>
          </FormItem>
          <FormItem label="薪资组件" field="componentId" rules={[{ required: true, message: '请选择薪资组件' }]}>
            <Select placeholder="选择薪资组件">
              {components.map((component) => (
                <Option key={component.id} value={component.id}>{component.name}</Option>
              ))}
            </Select>
          </FormItem>
          <Space size="large">
            <FormItem label="年份" field="year" rules={[{ required: true, message: '请输入年份' }]}>
              <InputNumber style={{ width: 120 }} />
            </FormItem>
            <FormItem label="月份" field="month" rules={[{ required: true, message: '请输入月份' }]}>
              <InputNumber min={1} max={12} style={{ width: 120 }} />
            </FormItem>
            <FormItem label="类型" field="type" rules={[{ required: true, message: '请选择类型' }]}>
              <Select style={{ width: 160 }}>
                <Option value="earning">补贴/补发</Option>
                <Option value="deduction">扣款/追扣</Option>
              </Select>
            </FormItem>
          </Space>
          <FormItem label="金额" field="amount" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </FormItem>
          <FormItem label="原因" field="reason" rules={[{ required: true, message: '请输入调整原因' }]}>
            <Input.TextArea placeholder="例如：补发上月餐补、追扣缺勤扣款" autoSize={{ minRows: 3, maxRows: 6 }} />
          </FormItem>
        </Form>
      </Modal>
      <ApprovalActionModal
        visible={actionState.visible}
        title={actionState.action === 'approve' ? '通过薪资调整项' : '驳回薪资调整项'}
        commentLabel="审批意见"
        commentPlaceholder="请输入薪资调整项审批意见"
        defaultComment={actionState.action === 'approve' ? '同意调整' : '驳回调整'}
        onOk={submitAction}
        onCancel={closeAction}
      />
    </div>
  )
}

export default PayrollAdjustmentsPage
