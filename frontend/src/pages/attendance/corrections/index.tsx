import { useCallback, useMemo, useState } from 'react'
import { Button, Card, Form, Input, Message, Modal, Select, Table, Tag } from '@arco-design/web-react'
import {
  approveAttendanceCorrection,
  createAttendanceCorrection,
  getAttendanceCorrections,
  rejectAttendanceCorrection,
} from '@/api/attendance'
import { PageHeader, FilterBar, ApprovalActionModal, StatusTag, ApproveRejectButtons, employeeColumn, departmentColumn } from '@/components'
import { useTableData } from '@/hooks/useTableData'
import styles from './style.module.css'
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
    employeeColumn(),
    departmentColumn(),
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
        <ApproveRejectButtons
          disabled={record.status !== 'pending'}
          onApprove={() => openAction(record, 'approve')}
          onReject={() => openAction(record, 'reject')}
        />
      ),
    },
  ], [openAction])

  return (
    <div className={styles['attendance-corrections']}>
      <Card bordered={false} className={styles['attendance-corrections__card']}>
        <PageHeader
          title="补卡申请"
          description="补卡审批通过后会写入一条来源为 correction 的原始打卡，并自动重算当天日考勤和月考勤。"
          extra={<Button type="primary" onClick={openCreate}>发起补卡</Button>}
        />
      </Card>

      <Card bordered={false} className={styles['attendance-corrections__card']}>
        <FilterBar
          filters={
            <FormItem label="状态" field="status">
              <Select allowClear placeholder="全部状态" className={styles['attendance-corrections__select']}>
                <Option value="pending">待审批</Option>
                <Option value="approved">已通过</Option>
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
          pagination={{ total, current: page, pageSize: 10, onChange: (current) => loadData(current) }}
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal focusLock
        title="发起补卡"
        visible={visible}
        onOk={handleCreate}
        onCancel={() => setVisible(false)}
        className={styles['attendance-corrections__modal']}
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
