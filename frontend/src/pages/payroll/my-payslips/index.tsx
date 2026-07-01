import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Descriptions, Form, Input, Message, Modal, Space, Table } from '@arco-design/web-react'
import { confirmMyPayslip, disputeMyPayslip, getMyPayslipDetail, getMyPayslips, setPayslipPassword, verifyPayslipPassword, Payslip } from '@/api/payroll'
import { PageHeader, StatusTag } from '@/components'
import styles from './index.module.css'
const FormItem = Form.Item

function MyPayslipsPage() {
  const [data, setData] = useState<Payslip[]>([])
  const [detail, setDetail] = useState<Payslip | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [verifyVisible, setVerifyVisible] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [disputeVisible, setDisputeVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const [disputeForm] = Form.useForm()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyPayslips()
      setData(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openVerify = useCallback((id: number) => {
    setSelectedId(id)
    setVerifyVisible(true)
    form.resetFields()
  }, [form])

  const handleVerify = useCallback(async () => {
    const values = await form.validate()
    let token = ''

    try {
      const verifyRes: any = await verifyPayslipPassword({ password: values.password })
      token = verifyRes.data?.payslipAccessToken
    } catch (error: any) {
      if (error?.response?.status === 404) {
        const setupPassword = values.password
        await setPayslipPassword({ password: setupPassword, confirmPassword: setupPassword })
        const verifyRes = await verifyPayslipPassword({ password: setupPassword })
        token = verifyRes.data?.payslipAccessToken || ''
      } else {
        throw error
      }
    }

    if (!selectedId || !token) return
    const detailRes = await getMyPayslipDetail(selectedId, token)
    setDetail(detailRes.data)
    setVerifyVisible(false)
    setDetailVisible(true)
    Message.success('二级密码验证成功')
  }, [form, selectedId])

  const handleConfirm = useCallback(async () => {
    if (!detail?.id) return
    await confirmMyPayslip(detail.id)
    Message.success('工资条已确认')
    setDetailVisible(false)
    loadData()
  }, [detail, loadData])

  const openDispute = useCallback(() => {
    disputeForm.resetFields()
    setDisputeVisible(true)
  }, [disputeForm])

  const handleDispute = useCallback(async () => {
    if (!detail?.id) return
    const values = await disputeForm.validate()
    await disputeMyPayslip(detail.id, values)
    Message.success('工资条申诉已提交')
    setDisputeVisible(false)
    setDetailVisible(false)
    loadData()
  }, [detail, disputeForm, loadData])

  const columns = useMemo(() => [
    { title: '月份', render: (_: unknown, record: any) => `${record.year}-${String(record.month).padStart(2, '0')}` },
    { title: '实发工资', dataIndex: 'netPayMasked' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="payslip" value={value} />,
    },
    { title: '发布时间', dataIndex: 'publishedAt' },
    {
      title: '操作',
      render: (_: unknown, record: any) => (
        <Button type="primary" size="small" onClick={() => openVerify(record.id)}>
          二级密码查看
        </Button>
      ),
    },
  ], [openVerify])

  const itemColumns = useMemo(() => [
    { title: '项目', render: (_: unknown, record: any) => record.component?.name || '-' },
    { title: '类型', dataIndex: 'type' },
    { title: '金额', dataIndex: 'amount' },
  ], [])

  const disputeColumns = useMemo(() => [
    { title: '申诉原因', dataIndex: 'reason' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="payslipDispute" value={value} />,
    },
    { title: '处理回复', dataIndex: 'handlerReply' },
  ], [])

  return (
    <div className={styles['my-payslips']}>
      <Card bordered={false} className={styles['my-payslips__card']}>
        <PageHeader
          title="我的工资条"
          description="工资金额默认脱敏，查看明细前必须验证二级密码；首次验证时会自动设置二级密码。"
        />
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          data={data}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal focusLock
        title="工资条二级密码"
        visible={verifyVisible}
        onOk={handleVerify}
        onCancel={() => setVerifyVisible(false)}
        className={styles['my-payslips__modal--verify']}
      >
        <Form form={form} layout="vertical">
          <FormItem
            label="二级密码"
            field="password"
            rules={[{ required: true, message: '请输入工资条二级密码' }]}
          >
            <Input.Password placeholder="首次输入将作为二级密码保存" />
          </FormItem>
        </Form>
      </Modal>

      <Modal focusLock
        title="工资条明细"
        visible={detailVisible}
        footer={detail?.status === 'disputed' ? null : (
          <Space>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            <Button status="warning" onClick={openDispute}>发起申诉</Button>
            {detail?.status !== 'confirmed' && <Button type="primary" onClick={handleConfirm}>确认工资条</Button>}
          </Space>
        )}
        onCancel={() => setDetailVisible(false)}
        className={styles['my-payslips__modal--detail']}
      >
        {detail && (
          <Space direction="vertical" className={styles['my-payslips__space']}>
            <Descriptions
              column={2}
              data={[
                { label: '应发工资', value: detail.grossPay },
                { label: '扣款合计', value: detail.totalDeduction },
                { label: '实发工资', value: detail.netPay },
                { label: '状态', value: detail.status },
              ]}
            />
            <Table
              rowKey="id"
              pagination={false}
              data={detail.items || []}
              columns={itemColumns}
            />
            {detail.disputes && detail.disputes.length > 0 && (
              <Table
                rowKey="id"
                pagination={false}
                data={detail.disputes}
                columns={disputeColumns}
              />
            )}
          </Space>
        )}
      </Modal>

      <Modal focusLock
        title="工资条申诉"
        visible={disputeVisible}
        onOk={handleDispute}
        onCancel={() => setDisputeVisible(false)}
        className={styles['my-payslips__modal--dispute']}
      >
        <Form form={disputeForm} layout="vertical">
          <FormItem label="申诉原因" field="reason" rules={[{ required: true, message: '请输入申诉原因' }]}>
            <Input.TextArea placeholder="请说明工资条中的疑问或异常项" autoSize={{ minRows: 4, maxRows: 8 }} />
          </FormItem>
        </Form>
      </Modal>
    </div>
  )
}

export default MyPayslipsPage
