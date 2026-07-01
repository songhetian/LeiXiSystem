import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Descriptions, Form, Input, Message, Modal, Popconfirm, Select, Space, Table } from '@arco-design/web-react'
import { getPayslips, getPayrollRuns, recalculatePayslip, withdrawPayslip, batchPublishPayslips, batchWithdrawPayslips, Payslip, PayrollRun } from '@/api/payroll'
import { PageHeader, FilterBar, StatusTag, employeeColumn, departmentColumn, EmployeeSelect, BatchActions } from '@/components'
import { useBatchSelection } from '@/hooks/useBatchSelection'
import styles from './index.module.css'
const FormItem = Form.Item
const Option = Select.Option

const payslipStatusText: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  viewed: '已查看',
  confirmed: '已确认',
  disputed: '有申诉',
  cancelled: '已取消',
}

function PayslipsPage() {
  const [data, setData] = useState<Payslip[]>([])
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [detail, setDetail] = useState<Payslip | null>(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const batch = useBatchSelection<Payslip>()

  const loadData = useCallback(async (params?: any) => {
    setLoading(true)
    try {
      const res = await getPayslips(params)
      setData(res.data.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadInitialData = useCallback(async () => {
    setLoading(true)
    try {
      const [runRes, payslipRes]: any[] = await Promise.all([
        getPayrollRuns(),
        getPayslips(),
      ])
      setRuns(runRes.data || [])
      setData(payslipRes.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const handleSearch = useCallback(async () => {
    const values = form.getFieldsValue()
    await loadData(values)
  }, [form, loadData])

  const handleReset = useCallback(async () => {
    form.resetFields()
    await loadData()
  }, [form, loadData])

  const handleRecalculate = useCallback(async (record: any) => {
    try {
      await recalculatePayslip(record.id)
      Message.success('工资条重算完成')
      await loadData(form.getFieldsValue())
    } catch (e: any) {
      Message.error(e?.message || '重算失败')
    }
  }, [form, loadData])

  const handleWithdraw = useCallback(async (record: any) => {
    try {
      await withdrawPayslip(record.id)
      Message.success('工资条已撤回')
      await loadData(form.getFieldsValue())
    } catch (e: any) {
      Message.error(e?.message || '撤回失败')
    }
  }, [form, loadData])

  const openDetail = useCallback((record: any) => {
    setDetail(record)
    setVisible(true)
  }, [])

  // 批量发布
  const handleBatchPublish = useCallback(async () => {
    const draftItems = data.filter((item) => item.status === 'draft' && batch.isSelected(item.id))
    if (draftItems.length === 0) {
      Message.warning('请选择草稿状态的工资条')
      return
    }
    try {
      await batchPublishPayslips(draftItems.map((item) => item.id))
      Message.success(`成功发布 ${draftItems.length} 个工资条`)
      batch.clearSelection()
      await loadData(form.getFieldsValue())
    } catch (e: any) {
      Message.error(e?.message || '发布失败')
    }
  }, [data, batch, form, loadData])

  // 批量撤回
  const handleBatchWithdraw = useCallback(async () => {
    const publishableItems = data.filter(
      (item) => ['published', 'viewed'].includes(item.status) && batch.isSelected(item.id)
    )
    if (publishableItems.length === 0) {
      Message.warning('请选择已发布或已查看状态的工资条')
      return
    }
    try {
      await batchWithdrawPayslips(publishableItems.map((item) => item.id))
      Message.success(`成功撤回 ${publishableItems.length} 个工资条`)
      batch.clearSelection()
      await loadData(form.getFieldsValue())
    } catch (e: any) {
      Message.error(e?.message || '撤回失败')
    }
  }, [data, batch, form, loadData])

  const columns = useMemo(() => [
    {
      title: '薪资期间',
      render: (_: unknown, record: any) => {
        const period = record.payrollRun?.payrollPeriod
        return period ? `${period.year}-${String(period.month).padStart(2, '0')}` : '-'
      },
    },
    employeeColumn(),
    departmentColumn(),
    { title: '应发', dataIndex: 'grossPay' },
    { title: '扣款', dataIndex: 'totalDeduction' },
    { title: '实发', dataIndex: 'netPay' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="payslip" value={value} />,
    },
    { title: '发布时间', dataIndex: 'publishedAt' },
    {
      title: '操作',
      width: 190,
      render: (_: unknown, record: any) => (
        <Space>
          <Button type="text" size="small" onClick={() => openDetail(record)}>
            查看
          </Button>
          <Popconfirm
            title="重算会把工资条退回草稿并清空已查看状态，确认重算？"
            onOk={() => handleRecalculate(record)}
          >
            <Button
              type="text"
              size="small"
              disabled={['confirmed', 'cancelled'].includes(record.status)}
            >
              重算
            </Button>
          </Popconfirm>
          <Popconfirm
            title="撤回后员工将不能继续查看该工资条，确认撤回？"
            onOk={() => handleWithdraw(record)}
          >
            <Button
              type="text"
              size="small"
              status="warning"
              disabled={!['published', 'viewed'].includes(record.status)}
            >
              撤回
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ], [handleRecalculate, handleWithdraw, openDetail, batch])

  return (
    <div className={styles.payslips}>
      <Card bordered={false} className={styles.payslips__card}>
        <PageHeader
          title="工资条管理"
          description="HR/财务查看薪资批次下的工资条状态和金额汇总，员工端仍需二级密码查看明细。"
        />
      </Card>

      <Card bordered={false} className={styles.payslips__card}>
        <FilterBar
          filters={
            <>
              <FormItem label="薪资批次" field="payrollRunId">
                <Select className={styles.payslips__select} placeholder="全部批次" allowClear>
                  {runs.map((run) => (
                    <Option key={run.id} value={run.id}>
                      #{run.id} {run.payrollPeriod ? `${run.payrollPeriod.year}-${String(run.payrollPeriod.month).padStart(2, '0')}` : ''}
                    </Option>
                  ))}
                </Select>
              </FormItem>
              <FormItem label="员工" field="employeeId">
                <EmployeeSelect />
              </FormItem>
            </>
          }
          onSearch={handleSearch}
          onReset={handleReset}
        />
      </Card>

      <Card bordered={false}>
        <BatchActions
          selectedCount={batch.selectedCount}
          onClear={batch.clearSelection}
          actions={
            <>
              <Button type="primary" onClick={handleBatchPublish}>
                批量发布
              </Button>
              <Button status="warning" onClick={handleBatchWithdraw}>
                批量撤回
              </Button>
            </>
          }
        />
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          rowSelection={batch.getRowSelection(data)}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal focusLock
        title="工资条摘要"
        visible={visible}
        footer={null}
        onCancel={() => setVisible(false)}
        className={styles.payslips__modal}
      >
        {detail && (
          <Space direction="vertical" className={styles.payslips__space}>
            <Descriptions
              column={2}
              data={[
                { label: '员工', value: detail.employee?.user?.realName || '-' },
                { label: '状态', value: payslipStatusText[detail.status] || detail.status },
                { label: '应发工资', value: detail.grossPay },
                { label: '扣款合计', value: detail.totalDeduction },
                { label: '实发工资', value: detail.netPay },
                { label: '已出勤天数', value: detail.paidDays },
              ]}
            />
            <Input.TextArea
              value={JSON.stringify(detail.attendanceSnapshot || {}, null, 2)}
              autoSize={{ minRows: 4, maxRows: 8 }}
              readOnly
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default PayslipsPage
