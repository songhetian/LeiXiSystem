import { useCallback, useMemo, useState } from 'react'
import { Button, Card, Form, Message, Select, Space, Table, Typography } from '@arco-design/web-react'
import { getPayslipDisputes, handlePayslipDispute, PayslipDispute } from '@/api/payroll'
import ApprovalActionModal from '@/components/ApprovalActionModal'
import StatusTag from '@/components/StatusTag'
import { useTableData } from '@/hooks/useTableData'
import './index.css'

const { Title, Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

function PayslipDisputesPage() {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<PayslipDispute | null>(null)
  const [targetStatus, setTargetStatus] = useState<'resolved' | 'rejected'>('resolved')
  const [filterForm] = Form.useForm()
  const { data, loading, loadData, handleSearch, handleReset } = useTableData({
    fetcher: getPayslipDisputes,
    form: filterForm,
    paginated: false,
  })

  const openHandle = useCallback((record: any, status: 'resolved' | 'rejected') => {
    setCurrent(record)
    setTargetStatus(status)
    setVisible(true)
  }, [])

  const submitHandle = useCallback(async (values: { comment?: string }) => {
    if (!current?.id) return
    await handlePayslipDispute(current.id, { status: targetStatus, handlerReply: values.comment })
    Message.success('工资条申诉已处理')
    setVisible(false)
    loadData()
  }, [current, loadData, targetStatus])

  const columns = useMemo(() => [
    { title: '期间', render: (_: unknown, record: any) => {
      const period = record.payslip?.payrollRun?.payrollPeriod
      return period ? `${period.year}-${String(period.month).padStart(2, '0')}` : '-'
    } },
    { title: '员工', render: (_: unknown, record: any) => record.employee?.user?.realName || '-' },
    { title: '部门', render: (_: unknown, record: any) => record.employee?.user?.department?.name || '-' },
    { title: '申诉原因', dataIndex: 'reason' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="payslipDispute" value={value} />,
    },
    { title: '处理回复', dataIndex: 'handlerReply' },
    {
      title: '操作',
      width: 160,
      render: (_: unknown, record: any) => (
        <Space>
          <Button type="text" size="small" disabled={record.status !== 'pending'} onClick={() => openHandle(record, 'resolved')}>解决</Button>
          <Button type="text" size="small" status="danger" disabled={record.status !== 'pending'} onClick={() => openHandle(record, 'rejected')}>驳回</Button>
        </Space>
      ),
    },
  ], [openHandle])

  return (
    <div className="payslip-disputes">
      <Card bordered={false} className="payslip-disputes__card">
        <Space direction="vertical" size={4}>
          <Title heading={5} className="payslip-disputes__title">工资条申诉</Title>
          <Text type="secondary">处理员工对工资条的异议；解决后工资条会从申诉中状态回到已查看，便于员工重新确认。</Text>
        </Space>
      </Card>

      <Card bordered={false} className="payslip-disputes__card">
        <Form form={filterForm} layout="inline">
          <FormItem label="状态" field="status">
            <Select allowClear placeholder="全部状态" className="payslip-disputes__select">
              <Option value="pending">待处理</Option>
              <Option value="resolved">已解决</Option>
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
          scroll={{ x: 1100 }}
        />
      </Card>

      <ApprovalActionModal
        visible={visible}
        title={targetStatus === 'resolved' ? '解决申诉' : '驳回申诉'}
        commentLabel="处理回复"
        commentPlaceholder="请输入给员工的处理说明"
        onOk={submitHandle}
        onCancel={() => setVisible(false)}
      />
    </div>
  )
}

export default PayslipDisputesPage
