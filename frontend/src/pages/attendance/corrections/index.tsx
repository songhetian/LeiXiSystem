import { useCallback, useMemo, useState } from 'react'
import { Button, Card, Form, Input, Message, Modal, Select, Space, Table, Tag, Typography } from '@arco-design/web-react'
import {
  approveAttendanceCorrection,
  createAttendanceCorrection,
  getAttendanceCorrections,
  rejectAttendanceCorrection,
} from '@/api/attendance'
import ApprovalActionModal from '@/components/ApprovalActionModal'
import StatusTag from '@/components/StatusTag'
import { useTableData } from '@/hooks/useTableData'

const { Title, Text } = Typography
const FormItem = Form.Item
const Option = Select.Option

function AttendanceCorrectionsPage() {
  const [visible, setVisible] = useState(false)
  const [actionState, setActionState] = useState<{ visible: boolean; record?: any; action?: 'approve' | 'reject' }>({ visible: false })
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  const { data, total, page, loading, loadData, handleSearch, handleReset } = useTableData({
    fetcher: getAttendanceCorrections,
    form: filterForm,
  })

  const openCreate = useCallback(() => {
    form.resetFields()
    form.setFieldsValue({ logType: 'in' })
    setVisible(true)
  }, [form])

  const handleCreate = useCallback(async () => {
    const values = await form.validate()
    await createAttendanceCorrection(values)
    Message.success('补卡申请已提交')
    setVisible(false)
    loadData(1)
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
      await approveAttendanceCorrection(actionState.record.id, { opinion: values.comment })
      Message.success('补卡已通过并重算考勤')
    } else {
      await rejectAttendanceCorrection(actionState.record.id, { opinion: values.comment })
      Message.success('补卡已驳回')
    }
    closeAction()
    loadData(page)
  }, [actionState, closeAction, loadData, page])

  const columns = useMemo(() => [
    { title: '员工', render: (_: unknown, record: any) => record.employee?.user?.realName || '-' },
    { title: '部门', render: (_: unknown, record: any) => record.employee?.user?.department?.name || '-' },
    { title: '补卡日期', dataIndex: 'date' },
    {
      title: '类型',
      dataIndex: 'logType',
      render: (value: string) => <Tag color={value === 'in' ? 'green' : 'blue'}>{value === 'in' ? '上班卡' : '下班卡'}</Tag>,
    },
    { title: '补卡时间', dataIndex: 'checkTime' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <StatusTag preset="attendanceCorrection" value={value} />,
    },
    { title: '原因', dataIndex: 'reason' },
    {
      title: '操作',
      width: 160,
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
            <Title heading={5} style={{ margin: 0 }}>补卡申请</Title>
            <Button type="primary" onClick={openCreate}>发起补卡</Button>
          </div>
          <Text type="secondary">补卡审批通过后会写入一条来源为 correction 的原始打卡，并自动重算当天日考勤和月考勤。</Text>
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
          pagination={{ total, current: page, pageSize: 10, onChange: (current) => loadData(current) }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title="发起补卡"
        visible={visible}
        onOk={handleCreate}
        onCancel={() => setVisible(false)}
        style={{ width: 520 }}
      >
        <Form form={form} layout="vertical">
          <FormItem label="补卡日期" field="date" rules={[{ required: true, message: '请输入补卡日期' }]}>
            <Input placeholder="YYYY-MM-DD" />
          </FormItem>
          <FormItem label="补卡类型" field="logType" rules={[{ required: true, message: '请选择补卡类型' }]}>
            <Select>
              <Option value="in">上班卡</Option>
              <Option value="out">下班卡</Option>
            </Select>
          </FormItem>
          <FormItem label="补卡时间" field="checkTime" rules={[{ required: true, message: '请输入补卡时间' }]}>
            <Input placeholder="YYYY-MM-DD HH:mm:ss" />
          </FormItem>
          <FormItem label="补卡原因" field="reason" rules={[{ required: true, message: '请输入补卡原因' }]}>
            <Input.TextArea placeholder="请说明忘打卡、设备异常等原因" autoSize={{ minRows: 3, maxRows: 6 }} />
          </FormItem>
        </Form>
      </Modal>
      <ApprovalActionModal
        visible={actionState.visible}
        title={actionState.action === 'approve' ? '通过补卡申请' : '驳回补卡申请'}
        commentLabel="审批意见"
        commentPlaceholder="请输入补卡审批意见"
        defaultComment={actionState.action === 'approve' ? '同意补卡' : '驳回补卡'}
        onOk={submitAction}
        onCancel={closeAction}
      />
    </div>
  )
}

export default AttendanceCorrectionsPage
