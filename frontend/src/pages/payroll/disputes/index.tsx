import { useCallback, useMemo, useState } from 'react'
import { Card, Form, Select, Table } from '@arco-design/web-react'
import { getPayslipDisputes, handlePayslipDispute, PayslipDispute } from '@/api/payroll'
import { PageHeader, FilterBar, ApprovalActionModal, StatusTag, ApproveRejectButtons, employeeColumn, departmentColumn } from '@/components'
import { useTableData } from '@/hooks/useTableData'
import { toast } from '@/utils/toast'
import styles from './index.module.css'
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
    toast.success('工资条申诉已处理')
    setVisible(false)
    loadData()
  }, [current, loadData, targetStatus])

  const columns = useMemo(() => [
    { title: '期间', render: (_: unknown, record: any) => {
      const period = record.payslip?.payrollRun?.payrollPeriod
      return period ? `${period.year}-${String(period.month).padStart(2, '0')}` : '-'
    } },
    employeeColumn(),
    departmentColumn(),
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
        <ApproveRejectButtons
          disabled={record.status !== 'pending'}
          onApprove={() => openHandle(record, 'resolved')}
          onReject={() => openHandle(record, 'rejected')}
        />
      ),
    },
  ], [openHandle])

  return (
    <div className={styles['payslip-disputes']}>
      <Card bordered={false} className={styles['payslip-disputes__card']}>
        <PageHeader
          title="工资条申诉"
          description="处理员工对工资条的异议；解决后工资条会从申诉中状态回到已查看，便于员工重新确认。"
        />
      </Card>

      <Card bordered={false} className={styles['payslip-disputes__card']}>
        <FilterBar
          filters={
            <FormItem label="状态" field="status">
              <Select allowClear placeholder="全部状态" className={styles['payslip-disputes__select']}>
                <Option value="pending">待处理</Option>
                <Option value="resolved">已解决</Option>
                <Option value="rejected">已驳回</Option>
              </Select>
            </FormItem>
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
